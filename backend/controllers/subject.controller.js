const supabase = require('../config/supabase');
const { NotFoundError, ConflictError, asyncHandler } = require('../utils/errors');

/**
 * Subjects are a school-wide catalogue: "English" is one row.
 * Which classes take it and who teaches each is in class_subjects, handled by
 * the assignment controller.
 */

const shape = (s) => ({
    id: s.id,
    name: s.name,
    code: s.code,
    taughtBy: s.taught_by,
    isSemester: s.is_semester,
    classCount: Array.isArray(s.class_subjects) ? (s.class_subjects[0]?.count ?? 0) : undefined,
});

/** GET /api/subjects */
const listSubjects = asyncHandler(async (req, res) => {
    const { data, error } = await supabase
        .from('subjects')
        .select('id, name, code, taught_by, is_semester, class_subjects(count)')
        .eq('school_id', req.user.school_id)
        .order('name');

    if (error) throw error;
    res.json({ subjects: data.map(shape) });
});

/** POST /api/subjects */
const createSubject = asyncHandler(async (req, res) => {
    const { name, code, taughtBy, isSemester } = req.body;

    const { data, error } = await supabase
        .from('subjects')
        .insert({
            school_id: req.user.school_id,
            name,
            code,
            taught_by: taughtBy ?? 'subject_teacher',
            is_semester: Boolean(isSemester),
        })
        .select('id, name, code, taught_by, is_semester')
        .single();

    if (error?.code === '23505') {
        throw new ConflictError(`A subject with that name or code already exists`);
    }
    if (error) throw error;

    res.status(201).json({ subject: shape(data) });
});

/** PATCH /api/subjects/:id */
const updateSubject = asyncHandler(async (req, res) => {
    const { name, code, taughtBy, isSemester } = req.body;

    const patch = {};
    if (name !== undefined) patch.name = name;
    if (code !== undefined) patch.code = code;
    if (taughtBy !== undefined) patch.taught_by = taughtBy;
    if (isSemester !== undefined) patch.is_semester = isSemester;

    const { data, error } = await supabase
        .from('subjects')
        .update(patch)
        .eq('id', req.params.id)
        .eq('school_id', req.user.school_id)
        .select('id, name, code, taught_by, is_semester')
        .maybeSingle();

    if (error?.code === '23505') throw new ConflictError('That subject name or code is already in use');
    if (error) throw error;
    if (!data) throw new NotFoundError('Subject not found');

    res.json({ subject: shape(data) });
});

/** DELETE /api/subjects/:id */
const deleteSubject = asyncHandler(async (req, res) => {
    const { data, error } = await supabase
        .from('subjects')
        .delete()
        .eq('id', req.params.id)
        .eq('school_id', req.user.school_id)
        .select()
        .maybeSingle();

    if (error) throw error;
    if (!data) throw new NotFoundError('Subject not found');

    res.json({ message: 'Subject deleted' });
});

module.exports = { listSubjects, createSubject, updateSubject, deleteSubject };
