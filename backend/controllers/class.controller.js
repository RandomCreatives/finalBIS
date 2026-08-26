const supabase = require('../config/supabase');
const { resolveYearId } = require('./academicYear.controller');
const { NotFoundError, ConflictError, asyncHandler } = require('../utils/errors');

const shapeClass = (c, staff = [], studentCount) => ({
    id: c.id,
    name: c.name,
    yearLevel: c.year_level,
    capacity: c.capacity,
    studentCount:
        studentCount ?? (Array.isArray(c.students) ? (c.students[0]?.count ?? 0) : undefined),
    mainTeacher: staff.find((s) => s.position === 'main')?.user ?? null,
    assistantTeacher: staff.find((s) => s.position === 'assistant')?.user ?? null,
});

/** GET /api/classes */
const listClasses = asyncHandler(async (req, res) => {
    let yearId = null;
    try {
        yearId = await resolveYearId(req);
    } catch {
        // No year configured yet — classes still list, just without staffing.
    }

    const { data: classes, error } = await supabase
        .from('classes')
        .select('id, name, year_level, capacity, students(count)')
        .eq('school_id', req.user.school_id)
        .order('name');

    if (error) throw error;

    let staffRows = [];
    if (yearId && classes.length > 0) {
        const { data, error: staffError } = await supabase
            .from('class_staff')
            .select('class_id, position, user:users(id, name, email, role)')
            .eq('academic_year_id', yearId)
            .in('class_id', classes.map((c) => c.id));

        if (staffError) throw staffError;
        staffRows = data || [];
    }

    res.json({
        academicYearId: yearId,
        classes: classes.map((c) =>
            shapeClass(c, staffRows.filter((s) => s.class_id === c.id))
        ),
    });
});

/** GET /api/classes/:id — detail with staff, subjects and roster size. */
const getClass = asyncHandler(async (req, res) => {
    const { data: klass, error } = await supabase
        .from('classes')
        .select('id, name, year_level, capacity, students(count)')
        .eq('id', req.params.id)
        .eq('school_id', req.user.school_id)
        .maybeSingle();

    if (error) throw error;
    if (!klass) throw new NotFoundError('Class not found');

    let yearId = null;
    try {
        yearId = await resolveYearId(req);
    } catch {
        /* no year configured */
    }

    let staffRows = [];
    let subjects = [];

    if (yearId) {
        const [staffRes, subjectRes] = await Promise.all([
            supabase
                .from('class_staff')
                .select('position, user:users(id, name, email, role)')
                .eq('class_id', req.params.id)
                .eq('academic_year_id', yearId),
            supabase
                .from('class_subjects')
                .select('id, sessions_per_week, subject:subjects(id, name, code), teacher:users(id, name)')
                .eq('class_id', req.params.id)
                .eq('academic_year_id', yearId),
        ]);

        if (staffRes.error) throw staffRes.error;
        if (subjectRes.error) throw subjectRes.error;

        staffRows = staffRes.data || [];
        subjects = (subjectRes.data || []).map((s) => ({
            assignmentId: s.id,
            sessionsPerWeek: s.sessions_per_week,
            subject: s.subject,
            teacher: s.teacher,
        }));
    }

    res.json({
        academicYearId: yearId,
        class: { ...shapeClass(klass, staffRows), subjects },
    });
});

/** POST /api/classes */
const createClass = asyncHandler(async (req, res) => {
    const { name, yearLevel, capacity } = req.body;

    const { data, error } = await supabase
        .from('classes')
        .insert({
            school_id: req.user.school_id,
            name,
            year_level: yearLevel ?? null,
            capacity: capacity ?? null,
        })
        .select('id, name, year_level, capacity')
        .single();

    if (error?.code === '23505') throw new ConflictError(`Class "${name}" already exists`);
    if (error) throw error;

    res.status(201).json({ class: shapeClass(data, [], 0) });
});

/** PATCH /api/classes/:id */
const updateClass = asyncHandler(async (req, res) => {
    const { name, yearLevel, capacity } = req.body;

    const patch = {};
    if (name !== undefined) patch.name = name;
    if (yearLevel !== undefined) patch.year_level = yearLevel;
    if (capacity !== undefined) patch.capacity = capacity;

    const { data, error } = await supabase
        .from('classes')
        .update(patch)
        .eq('id', req.params.id)
        .eq('school_id', req.user.school_id)
        .select('id, name, year_level, capacity, students(count)')
        .maybeSingle();

    if (error?.code === '23505') throw new ConflictError(`Class "${name}" already exists`);
    if (error) throw error;
    if (!data) throw new NotFoundError('Class not found');

    res.json({ class: shapeClass(data) });
});

/** DELETE /api/classes/:id — refused while students are enrolled. */
const deleteClass = asyncHandler(async (req, res) => {
    const { count, error: countError } = await supabase
        .from('students')
        .select('id', { count: 'exact', head: true })
        .eq('school_id', req.user.school_id)
        .eq('class_id', req.params.id);

    if (countError) throw countError;
    if (count > 0) {
        throw new ConflictError(
            `Cannot delete a class with ${count} enrolled student(s). Move them first.`
        );
    }

    const { data, error } = await supabase
        .from('classes')
        .delete()
        .eq('id', req.params.id)
        .eq('school_id', req.user.school_id)
        .select()
        .maybeSingle();

    if (error) throw error;
    if (!data) throw new NotFoundError('Class not found');

    res.json({ message: 'Class deleted' });
});

module.exports = { listClasses, getClass, createClass, updateClass, deleteClass };
