const supabase = require('../config/supabase');
const { resolveYearId } = require('./academicYear.controller');
const { NotFoundError, ConflictError, BadRequestError, asyncHandler } = require('../utils/errors');

/**
 * Staffing and teaching assignments.
 *
 *   class_staff     — one main + one assistant teacher per class
 *   class_subjects  — which teacher takes which subject in which class
 *
 * Everything here is scoped to an academic year.
 */

// ---------------------------------------------------------------------------
// Class staffing
// ---------------------------------------------------------------------------

/** GET /api/assignments/class-staff?classId= */
const listClassStaff = asyncHandler(async (req, res) => {
    const yearId = await resolveYearId(req);

    let query = supabase
        .from('class_staff')
        .select('id, position, class_id, class:classes(id, name), user:users(id, name, email, role)')
        .eq('school_id', req.user.school_id)
        .eq('academic_year_id', yearId);

    if (req.query.classId) query = query.eq('class_id', req.query.classId);

    const { data, error } = await query;
    if (error) throw error;

    res.json({
        academicYearId: yearId,
        staff: data.map((s) => ({
            id: s.id,
            position: s.position,
            classId: s.class_id,
            class: s.class,
            user: s.user,
        })),
    });
});

/**
 * PUT /api/assignments/class-staff
 * Assign a teacher as a class's main or assistant.
 */
const assignClassStaff = asyncHandler(async (req, res) => {
    const { classId, userId, position } = req.body;
    const yearId = await resolveYearId(req);

    const { data, error } = await supabase.rpc('assign_class_staff', {
        p_class_id: classId,
        p_user_id: userId,
        p_position: position,
        p_year_id: yearId,
        p_school_id: req.user.school_id,
    });

    if (error) {
        if (error.message?.includes('CLASS_NOT_FOUND')) throw new NotFoundError('Class not found');
        if (error.message?.includes('USER_NOT_FOUND')) throw new NotFoundError('Staff member not found');
        if (error.message?.includes('INVALID_POSITION')) throw new BadRequestError('Invalid position');
        throw error;
    }

    res.json({ assignment: data });
});

/**
 * POST /api/assignments/rotate
 *
 * Swaps the main (or assistant) teachers of two classes. Runs in one DB
 * transaction that frees both seats before refilling them, so the
 * one-holder-per-position rule is never briefly violated.
 */
const rotateClassStaff = asyncHandler(async (req, res) => {
    const { classAId, classBId, position } = req.body;
    const yearId = await resolveYearId(req);

    const { data, error } = await supabase.rpc('rotate_class_staff', {
        p_class_a: classAId,
        p_class_b: classBId,
        p_position: position,
        p_year_id: yearId,
        p_school_id: req.user.school_id,
    });

    if (error) {
        if (error.message?.includes('SAME_CLASS')) {
            throw new BadRequestError('Choose two different classes');
        }
        if (error.message?.includes('NOTHING_TO_ROTATE')) {
            throw new ConflictError('Neither class has anyone in that position yet');
        }
        if (error.message?.includes('INVALID_POSITION')) throw new BadRequestError('Invalid position');
        throw error;
    }

    res.json({ message: 'Teachers rotated', result: data });
});

/** DELETE /api/assignments/class-staff/:id */
const removeClassStaff = asyncHandler(async (req, res) => {
    const { data, error } = await supabase
        .from('class_staff')
        .delete()
        .eq('id', req.params.id)
        .eq('school_id', req.user.school_id)
        .select()
        .maybeSingle();

    if (error) throw error;
    if (!data) throw new NotFoundError('Assignment not found');

    res.json({ message: 'Assignment removed' });
});

// ---------------------------------------------------------------------------
// Subject teaching assignments
// ---------------------------------------------------------------------------

const SUBJECT_SELECT = `
    id, class_id, subject_id, teacher_id, sessions_per_week,
    class:classes(id, name),
    subject:subjects(id, name, code),
    teacher:users(id, name, email)
`;

const shapeAssignment = (a) => ({
    id: a.id,
    classId: a.class_id,
    subjectId: a.subject_id,
    teacherId: a.teacher_id,
    sessionsPerWeek: a.sessions_per_week,
    class: a.class,
    subject: a.subject,
    teacher: a.teacher,
});

/** GET /api/assignments/subjects?classId=&teacherId=&subjectId= */
const listSubjectAssignments = asyncHandler(async (req, res) => {
    const yearId = await resolveYearId(req);
    const { classId, teacherId, subjectId } = req.query;

    let query = supabase
        .from('class_subjects')
        .select(SUBJECT_SELECT)
        .eq('school_id', req.user.school_id)
        .eq('academic_year_id', yearId);

    if (classId) query = query.eq('class_id', classId);
    if (teacherId) query = query.eq('teacher_id', teacherId);
    if (subjectId) query = query.eq('subject_id', subjectId);

    const { data, error } = await query;
    if (error) throw error;

    res.json({ academicYearId: yearId, assignments: data.map(shapeAssignment) });
});

/**
 * Checks an assignment against the school's teaching policy.
 *
 * Maths, Science and semester subjects are delivered by the class's own main
 * teacher; English, Amharic, Music, Arts, PE and French by subject teachers.
 * This returns advice rather than blocking, because cover arrangements and
 * one-off exceptions are a normal part of running a school.
 */
const policyNoteFor = async (subjectId, teacherId, classId, yearId) => {
    if (!teacherId) return null;

    const [{ data: subject }, { data: teacher }] = await Promise.all([
        supabase.from('subjects').select('name, taught_by').eq('id', subjectId).maybeSingle(),
        supabase.from('users').select('name, role').eq('id', teacherId).maybeSingle(),
    ]);

    if (!subject || !teacher) return null;

    if (subject.taught_by === 'main_teacher') {
        const { data: seat } = await supabase
            .from('class_staff')
            .select('user_id')
            .eq('class_id', classId)
            .eq('academic_year_id', yearId)
            .eq('position', 'main')
            .maybeSingle();

        if (seat && seat.user_id !== teacherId) {
            return `${subject.name} is normally taught by the class's own main teacher.`;
        }
        if (!seat) {
            return `${subject.name} is normally taught by the main teacher, but this class has none assigned yet.`;
        }
    }

    if (subject.taught_by === 'subject_teacher' && teacher.role === 'assistant_teacher') {
        return `${subject.name} is normally taught by a subject teacher.`;
    }

    return null;
};

/**
 * PUT /api/assignments/subjects
 * Assign (or reassign) the teacher for one subject in one class.
 */
const upsertSubjectAssignment = asyncHandler(async (req, res) => {
    const { classId, subjectId, teacherId, sessionsPerWeek } = req.body;
    const yearId = await resolveYearId(req);

    const { data, error } = await supabase
        .from('class_subjects')
        .upsert(
            {
                school_id: req.user.school_id,
                academic_year_id: yearId,
                class_id: classId,
                subject_id: subjectId,
                teacher_id: teacherId ?? null,
                sessions_per_week: sessionsPerWeek ?? 0,
            },
            { onConflict: 'class_id,subject_id,academic_year_id' }
        )
        .select(SUBJECT_SELECT)
        .single();

    if (error) throw error;

    const note = await policyNoteFor(subjectId, teacherId, classId, yearId);

    res.json({ assignment: shapeAssignment(data), ...(note ? { warning: note } : {}) });
});

/**
 * POST /api/assignments/auto-assign-main
 *
 * Gives every main-teacher subject (Maths, Science, semester subjects) to each
 * class's own main teacher in one pass — the school's default arrangement, so
 * it should not need twelve manual assignments.
 */
const autoAssignMainTeacherSubjects = asyncHandler(async (req, res) => {
    const yearId = await resolveYearId(req);
    const schoolId = req.user.school_id;

    const [{ data: subjects, error: subjectError }, { data: seats, error: seatError }] =
        await Promise.all([
            supabase.from('subjects').select('id').eq('school_id', schoolId).eq('taught_by', 'main_teacher'),
            supabase.from('class_staff').select('class_id, user_id')
                .eq('school_id', schoolId).eq('academic_year_id', yearId).eq('position', 'main'),
        ]);

    if (subjectError) throw subjectError;
    if (seatError) throw seatError;

    if (!subjects?.length) {
        throw new BadRequestError('No subjects are marked as taught by main teachers');
    }
    if (!seats?.length) {
        throw new BadRequestError('No classes have a main teacher assigned yet');
    }

    const rows = [];
    for (const seat of seats) {
        for (const subject of subjects) {
            rows.push({
                school_id: schoolId,
                academic_year_id: yearId,
                class_id: seat.class_id,
                subject_id: subject.id,
                teacher_id: seat.user_id,
                sessions_per_week: req.body.sessionsPerWeek ?? 0,
            });
        }
    }

    const { data, error } = await supabase
        .from('class_subjects')
        .upsert(rows, { onConflict: 'class_id,subject_id,academic_year_id' })
        .select('id');

    if (error) throw error;

    res.json({
        message: `Assigned ${subjects.length} subject(s) to ${seats.length} main teacher(s)`,
        count: data.length,
    });
});

/**
 * POST /api/assignments/subjects/bulk
 *
 * Assign one teacher to one subject across many classes at once — the common
 * case when staffing "English across 4 classes".
 */
const bulkAssignSubject = asyncHandler(async (req, res) => {
    const { subjectId, teacherId, classIds, sessionsPerWeek } = req.body;
    const yearId = await resolveYearId(req);

    if (!Array.isArray(classIds) || classIds.length === 0) {
        throw new BadRequestError('classIds must be a non-empty array');
    }

    const rows = classIds.map((classId) => ({
        school_id: req.user.school_id,
        academic_year_id: yearId,
        class_id: classId,
        subject_id: subjectId,
        teacher_id: teacherId ?? null,
        sessions_per_week: sessionsPerWeek ?? 0,
    }));

    const { data, error } = await supabase
        .from('class_subjects')
        .upsert(rows, { onConflict: 'class_id,subject_id,academic_year_id' })
        .select(SUBJECT_SELECT);

    if (error) throw error;

    res.json({
        message: `Assigned across ${data.length} class(es)`,
        assignments: data.map(shapeAssignment),
    });
});

/** DELETE /api/assignments/subjects/:id */
const removeSubjectAssignment = asyncHandler(async (req, res) => {
    const { data, error } = await supabase
        .from('class_subjects')
        .delete()
        .eq('id', req.params.id)
        .eq('school_id', req.user.school_id)
        .select()
        .maybeSingle();

    if (error) throw error;
    if (!data) throw new NotFoundError('Assignment not found');

    res.json({ message: 'Assignment removed' });
});

/**
 * GET /api/assignments/workload
 *
 * Staffing overview for admins: per teacher, how many classes they hold as
 * main/assistant and how many subject periods they carry. Surfaces gaps
 * (classes with no main teacher) and overload at a glance.
 */
const getWorkload = asyncHandler(async (req, res) => {
    const yearId = await resolveYearId(req);
    const schoolId = req.user.school_id;

    const [staffRes, subjectRes, teacherRes, classRes] = await Promise.all([
        supabase.from('class_staff')
            .select('user_id, position, class_id')
            .eq('school_id', schoolId).eq('academic_year_id', yearId),
        supabase.from('class_subjects')
            .select('teacher_id, class_id, subject_id, sessions_per_week, subject:subjects(id, name)')
            .eq('school_id', schoolId).eq('academic_year_id', yearId),
        supabase.from('users')
            .select('id, name, email, role')
            .eq('school_id', schoolId).eq('is_active', true).neq('role', 'admin'),
        supabase.from('classes').select('id, name').eq('school_id', schoolId),
    ]);

    for (const r of [staffRes, subjectRes, teacherRes, classRes]) {
        if (r.error) throw r.error;
    }

    const teachers = (teacherRes.data || []).map((t) => {
        const staffRows = (staffRes.data || []).filter((s) => s.user_id === t.id);
        const subjectRows = (subjectRes.data || []).filter((s) => s.teacher_id === t.id);

        return {
            id: t.id,
            name: t.name,
            email: t.email,
            role: t.role,
            mainOf: staffRows.filter((s) => s.position === 'main').length,
            assistantOf: staffRows.filter((s) => s.position === 'assistant').length,
            subjectClasses: subjectRows.length,
            weeklySessions: subjectRows.reduce((sum, s) => sum + (s.sessions_per_week || 0), 0),
            subjects: [...new Set(subjectRows.map((s) => s.subject?.name).filter(Boolean))],
        };
    });

    // Classes missing a main teacher — the thing an admin most needs to see.
    const staffedMain = new Set(
        (staffRes.data || []).filter((s) => s.position === 'main').map((s) => s.class_id)
    );
    const staffedAssistant = new Set(
        (staffRes.data || []).filter((s) => s.position === 'assistant').map((s) => s.class_id)
    );

    const gaps = (classRes.data || [])
        .filter((c) => !staffedMain.has(c.id) || !staffedAssistant.has(c.id))
        .map((c) => ({
            classId: c.id,
            className: c.name,
            missingMain: !staffedMain.has(c.id),
            missingAssistant: !staffedAssistant.has(c.id),
        }));

    res.json({
        academicYearId: yearId,
        teachers: teachers.sort((a, b) => b.weeklySessions - a.weeklySessions),
        gaps,
        unassignedSubjects: (subjectRes.data || []).filter((s) => !s.teacher_id).length,
    });
});

module.exports = {
    listClassStaff, assignClassStaff, rotateClassStaff, removeClassStaff,
    listSubjectAssignments, upsertSubjectAssignment, bulkAssignSubject,
    autoAssignMainTeacherSubjects, removeSubjectAssignment,
    getWorkload,
};
