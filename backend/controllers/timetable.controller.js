const supabase = require('../config/supabase');
const { resolveYearId } = require('./academicYear.controller');
const { NotFoundError, ConflictError, ForbiddenError, asyncHandler } = require('../utils/errors');

/**
 * Weekly timetable.
 *
 * Visibility rules:
 *   admin         — everything
 *   main_teacher  — the full weekly grid for the class they run, plus any
 *                   lesson they personally teach elsewhere
 *   assistant     — the full grid for the class they support
 *   subject_teacher — only their own lessons
 *
 * Double-booking is prevented by EXCLUDE constraints in the database, so two
 * admins editing at once still cannot produce a clash.
 */

const SELECT = `
    id, day_of_week, starts_at, ends_at, room, class_id, teacher_id,
    class:classes(id, name),
    teacher:users(id, name, role),
    assignment:class_subjects(id, subject:subjects(id, name, code, taught_by))
`;

const shape = (s) => ({
    id: s.id,
    dayOfWeek: s.day_of_week,
    startsAt: s.starts_at,
    endsAt: s.ends_at,
    room: s.room,
    classId: s.class_id,
    class: s.class,
    teacherId: s.teacher_id,
    teacher: s.teacher,
    classSubjectId: s.assignment?.id ?? null,
    subject: s.assignment?.subject ?? null,
});

/** The class ids a teacher runs or supports this year. */
const myClassIds = async (userId, yearId) => {
    const { data, error } = await supabase
        .from('class_staff')
        .select('class_id')
        .eq('user_id', userId)
        .eq('academic_year_id', yearId);

    if (error) throw error;
    return (data || []).map((r) => r.class_id);
};

/**
 * GET /api/timetable?classId=&teacherId=&day=
 *
 * Returns the slots the caller is allowed to see. A subject teacher asking for
 * a whole class gets only their own lessons within it rather than an error,
 * so the UI degrades gracefully.
 */
const getTimetable = asyncHandler(async (req, res) => {
    const yearId = await resolveYearId(req);
    const { classId, teacherId, day } = req.query;

    let query = supabase
        .from('timetable_slots')
        .select(SELECT)
        .eq('school_id', req.user.school_id)
        .eq('academic_year_id', yearId)
        .order('day_of_week')
        .order('starts_at');

    if (classId) query = query.eq('class_id', classId);
    if (teacherId) query = query.eq('teacher_id', teacherId);
    if (day) query = query.eq('day_of_week', Number(day));

    // Non-admins are constrained to what they are entitled to see.
    if (req.user.role !== 'admin') {
        const owned = await myClassIds(req.user.id, yearId);
        const seesWholeClass =
            ['main_teacher', 'assistant_teacher'].includes(req.user.role) &&
            (!classId || owned.includes(classId));

        if (!seesWholeClass) {
            query = query.eq('teacher_id', req.user.id);
        }
    }

    const { data, error } = await query;
    if (error) throw error;

    res.json({ academicYearId: yearId, slots: data.map(shape) });
});

/**
 * GET /api/timetable/my-week
 * Every lesson the signed-in teacher personally teaches.
 */
const getMyWeek = asyncHandler(async (req, res) => {
    const yearId = await resolveYearId(req);

    const { data, error } = await supabase
        .from('timetable_slots')
        .select(SELECT)
        .eq('academic_year_id', yearId)
        .eq('teacher_id', req.user.id)
        .order('day_of_week')
        .order('starts_at');

    if (error) throw error;

    res.json({ academicYearId: yearId, slots: data.map(shape) });
});

/**
 * GET /api/timetable/class/:classId/roster
 *
 * "Who is attending this class" — the enrolled students plus every member of
 * staff who teaches into it, with their subject and weekly load.
 */
const getClassRoster = asyncHandler(async (req, res) => {
    const yearId = await resolveYearId(req);
    const { classId } = req.params;

    const [klass, staffRes, subjectRes, studentRes, slotRes] = await Promise.all([
        supabase
            .from('classes')
            .select('id, name, capacity')
            .eq('id', classId)
            .eq('school_id', req.user.school_id)
            .maybeSingle(),
        supabase
            .from('class_staff')
            .select('position, user:users(id, name, email, role)')
            .eq('class_id', classId)
            .eq('academic_year_id', yearId),
        supabase
            .from('class_subjects')
            .select('id, sessions_per_week, subject:subjects(id, name, code, taught_by), teacher:users(id, name, role)')
            .eq('class_id', classId)
            .eq('academic_year_id', yearId),
        supabase
            .from('students')
            .select('id, name, admission_no, roll_num, special_needs')
            .eq('class_id', classId)
            .eq('is_active', true)
            .order('name'),
        supabase
            .from('timetable_slots')
            .select('id, day_of_week, starts_at, ends_at')
            .eq('class_id', classId)
            .eq('academic_year_id', yearId),
    ]);

    for (const r of [klass, staffRes, subjectRes, studentRes, slotRes]) {
        if (r.error) throw r.error;
    }
    if (!klass.data) throw new NotFoundError('Class not found');

    const staff = staffRes.data || [];
    const assignments = subjectRes.data || [];

    res.json({
        academicYearId: yearId,
        class: { id: klass.data.id, name: klass.data.name, capacity: klass.data.capacity },
        mainTeacher: staff.find((s) => s.position === 'main')?.user ?? null,
        assistantTeacher: staff.find((s) => s.position === 'assistant')?.user ?? null,
        // Everyone who teaches into this class.
        teachingStaff: assignments.map((a) => ({
            assignmentId: a.id,
            subject: a.subject,
            teacher: a.teacher,
            sessionsPerWeek: a.sessions_per_week,
        })),
        students: (studentRes.data || []).map((s) => ({
            id: s.id,
            name: s.name,
            admissionNo: s.admission_no,
            rollNum: s.roll_num,
            specialNeeds: s.special_needs,
        })),
        studentCount: (studentRes.data || []).length,
        scheduledPeriods: (slotRes.data || []).length,
    });
});

/** POST /api/timetable — add a period. */
const createSlot = asyncHandler(async (req, res) => {
    const { classSubjectId, dayOfWeek, startsAt, endsAt, room } = req.body;
    const yearId = await resolveYearId(req);

    // class_id and teacher_id are filled by a DB trigger from the assignment.
    const { data, error } = await supabase
        .from('timetable_slots')
        .insert({
            school_id: req.user.school_id,
            academic_year_id: yearId,
            class_subject_id: classSubjectId,
            class_id: '00000000-0000-0000-0000-000000000000',
            day_of_week: dayOfWeek,
            starts_at: startsAt,
            ends_at: endsAt,
            room: room ?? null,
        })
        .select(SELECT)
        .single();

    if (error) {
        // 23P01 = exclusion_violation, raised by the double-booking constraints.
        if (error.code === '23P01') {
            throw new ConflictError(
                error.message?.includes('teacher')
                    ? 'That teacher is already teaching another class at this time'
                    : 'This class already has a lesson at this time'
            );
        }
        if (error.message?.includes('ASSIGNMENT_NOT_FOUND')) {
            throw new NotFoundError('Subject assignment not found');
        }
        throw error;
    }

    res.status(201).json({ slot: shape(data) });
});

/** PATCH /api/timetable/:id */
const updateSlot = asyncHandler(async (req, res) => {
    const { dayOfWeek, startsAt, endsAt, room, classSubjectId } = req.body;

    const patch = {};
    if (dayOfWeek !== undefined) patch.day_of_week = dayOfWeek;
    if (startsAt !== undefined) patch.starts_at = startsAt;
    if (endsAt !== undefined) patch.ends_at = endsAt;
    if (room !== undefined) patch.room = room;
    if (classSubjectId !== undefined) patch.class_subject_id = classSubjectId;

    const { data, error } = await supabase
        .from('timetable_slots')
        .update(patch)
        .eq('id', req.params.id)
        .eq('school_id', req.user.school_id)
        .select(SELECT)
        .maybeSingle();

    if (error) {
        if (error.code === '23P01') {
            throw new ConflictError(
                error.message?.includes('teacher')
                    ? 'That teacher is already teaching another class at this time'
                    : 'This class already has a lesson at this time'
            );
        }
        throw error;
    }
    if (!data) throw new NotFoundError('Timetable period not found');

    res.json({ slot: shape(data) });
});

/** DELETE /api/timetable/:id */
const deleteSlot = asyncHandler(async (req, res) => {
    const { data, error } = await supabase
        .from('timetable_slots')
        .delete()
        .eq('id', req.params.id)
        .eq('school_id', req.user.school_id)
        .select()
        .maybeSingle();

    if (error) throw error;
    if (!data) throw new NotFoundError('Timetable period not found');

    res.json({ message: 'Period removed' });
});

module.exports = {
    getTimetable, getMyWeek, getClassRoster, createSlot, updateSlot, deleteSlot,
    myClassIds, ForbiddenError,
};
