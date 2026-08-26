const supabase = require('../config/supabase');
const { resolveTermId } = require('./term.controller');
const { NotFoundError, BadRequestError, asyncHandler } = require('../utils/errors');

/** Hard ceiling for one bulk save — a roster of 30 classes stays well under. */
const BULK_LIMIT = 200;

/** Percentage → letter grade. Single source of truth for grading. */
const gradeFor = (percentage) => {
    if (percentage >= 90) return 'A+';
    if (percentage >= 80) return 'A';
    if (percentage >= 70) return 'B+';
    if (percentage >= 60) return 'B';
    if (percentage >= 50) return 'C';
    if (percentage >= 40) return 'D';
    return 'F';
};

const shape = (m) => ({
    id: m.id,
    termId: m.term_id,
    term: m.term ?? null,
    marks: Number(m.marks),
    maxMarks: Number(m.max_marks),
    percentage: m.percentage === null ? null : Number(m.percentage),
    grade: m.grade,
    student: m.student,
    subject: m.subject,
});

const SELECT = `
    id, term_id, marks, max_marks, percentage, grade,
    term:terms(id, name, term_index),
    student:students(id, name, admission_no, roll_num),
    subject:subjects(id, name, code)
`;

/**
 * PUT /api/marksheets — create or update one result.
 * Percentage and grade are always derived server-side so a client cannot
 * submit a grade that disagrees with the marks.
 */
const upsertMarksheet = asyncHandler(async (req, res) => {
    const { studentId, subjectId, classId, marks, maxMarks } = req.body;
    const termId = await resolveTermId(req);

    const max = maxMarks ?? 100;
    if (max <= 0) throw new BadRequestError('maxMarks must be a positive number');
    const percentage = Number(((marks / max) * 100).toFixed(2));

    const { data, error } = await supabase
        .from('marksheets')
        .upsert(
            {
                school_id: req.user.school_id,
                student_id: studentId,
                subject_id: subjectId,
                class_id: classId ?? null,
                term_id: termId,
                marks,
                max_marks: max,
                percentage,
                grade: gradeFor(percentage),
                entered_by: req.user.id,
            },
            { onConflict: 'student_id,subject_id,term_id' }
        )
        .select(SELECT)
        .single();

    if (error) throw error;

    res.json({ marksheet: shape(data) });
});

/**
 * POST /api/marksheets/bulk — save a whole sheet in one request.
 *
 * A subject teacher facing 30 students across six classes should not pay one
 * round-trip per cell. `entries` is an array of { studentId, subjectId,
 * marks, maxMarks?, classId? }; `classId`/`termId` at the top level apply to
 * any entry that does not name its own. Percentage and grade are derived
 * server-side per entry, exactly as in the single-row upsert.
 */
const bulkUpsertMarksheets = asyncHandler(async (req, res) => {
    const { entries, classId } = req.body;
    const termId = await resolveTermId(req);

    if (!Array.isArray(entries) || entries.length === 0) {
        throw new BadRequestError('No marksheet entries provided');
    }
    if (entries.length > BULK_LIMIT) {
        throw new BadRequestError(`At most ${BULK_LIMIT} entries per request`);
    }

    for (const e of entries) {
        const max = e.maxMarks ?? 100;
        if (Number(e.marks) > Number(max)) {
            throw new BadRequestError('Marks cannot exceed the maximum marks');
        }
    }

    const rows = entries.map((e) => {
        const max = e.maxMarks ?? 100;
        const percentage = Number(((e.marks / max) * 100).toFixed(2));

        return {
            school_id: req.user.school_id,
            student_id: e.studentId,
            subject_id: e.subjectId,
            class_id: e.classId ?? classId ?? null,
            term_id: termId,
            marks: e.marks,
            max_marks: max,
            percentage,
            grade: gradeFor(percentage),
            entered_by: req.user.id,
        };
    });

    const { data, error } = await supabase
        .from('marksheets')
        .upsert(rows, { onConflict: 'student_id,subject_id,term_id' })
        .select(SELECT);

    if (error) throw error;

    res.json({ saved: rows.length, marksheets: (data || []).map(shape) });
});

/** GET /api/marksheets?classId=&termId=&subjectId= */
const listMarksheets = asyncHandler(async (req, res) => {
    const { classId, termId, subjectId } = req.query;

    let query = supabase
        .from('marksheets')
        .select(SELECT)
        .eq('school_id', req.user.school_id);

    if (classId) query = query.eq('class_id', classId);
    if (termId) query = query.eq('term_id', termId);
    if (subjectId) query = query.eq('subject_id', subjectId);

    const { data, error } = await query;
    if (error) throw error;

    res.json({ marksheets: data.map(shape) });
});

/** GET /api/marksheets/student/:studentId?termId= */
const getStudentMarksheet = asyncHandler(async (req, res) => {
    let query = supabase
        .from('marksheets')
        .select(SELECT)
        .eq('student_id', req.params.studentId)
        .eq('school_id', req.user.school_id);

    if (req.query.termId) query = query.eq('term_id', req.query.termId);

    const { data, error } = await query;
    if (error) throw error;

    const results = data.map(shape);
    const average = results.length
        ? Number((results.reduce((s, m) => s + m.percentage, 0) / results.length).toFixed(2))
        : null;

    res.json({
        marksheets: results,
        stats: {
            subjectCount: results.length,
            averagePercentage: average,
            overallGrade: average === null ? null : gradeFor(average),
        },
    });
});

/** DELETE /api/marksheets/:id */
const deleteMarksheet = asyncHandler(async (req, res) => {
    const { data, error } = await supabase
        .from('marksheets')
        .delete()
        .eq('id', req.params.id)
        .eq('school_id', req.user.school_id)
        .select()
        .maybeSingle();

    if (error) throw error;
    if (!data) throw new NotFoundError('Marksheet not found');

    res.json({ message: 'Marksheet deleted' });
});

module.exports = {
    upsertMarksheet, bulkUpsertMarksheets, listMarksheets,
    getStudentMarksheet, deleteMarksheet, gradeFor,
};
