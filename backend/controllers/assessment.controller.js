const supabase = require('../config/supabase');
const { ROLES } = require('../middleware/auth');
const { resolveTermId } = require('./term.controller');
const { gradeFor } = require('./marksheet.controller');
const { assertCanRecordMarks } = require('../utils/classAccess');
const {
    BadRequestError, ForbiddenError, NotFoundError, asyncHandler,
} = require('../utils/errors');

/**
 * Multiple assessments per subject.
 *
 * An assessment column is worth `max_marks` — its share of the 100-mark
 * total. Students get a raw score per column; the final mark for
 * (student, subject, term) is the SUM of the columns, written back into the
 * marksheets table so report cards and everything downstream still read it.
 */

const fetchOwned = async (table, columns, ids, schoolId, label) => {
    const unique = [...new Set(ids)];
    if (unique.length === 0) return [];
    const { data, error } = await supabase
        .from(table)
        .select(columns)
        .eq('school_id', schoolId)
        .in('id', unique);
    if (error) throw error;
    if ((data || []).length !== unique.length) {
        throw new BadRequestError(`Unknown or foreign ${label} in request`);
    }
    return data;
};

/**
 * Recompute the final marksheet row for every student with marks in the
 * given (class, subject, term) and write it to the marksheets table.
 * Final = sum of assessment marks; max = sum of assessment max_marks.
 */
const recomputeFinals = async (req, classId, subjectId, termId) => {
    const { data: assessments, error: aErr } = await supabase
        .from('assessments')
        .select('id, max_marks')
        .eq('class_id', classId)
        .eq('subject_id', subjectId)
        .eq('term_id', termId);
    if (aErr) throw aErr;

    const ids = (assessments || []).map((a) => a.id);
    if (ids.length === 0) return;

    const maxByAssessment = new Map(assessments.map((a) => [a.id, Number(a.max_marks)]));

    const { data: marks, error: mErr } = await supabase
        .from('assessment_marks')
        .select('assessment_id, student_id, marks')
        .in('assessment_id', ids);
    if (mErr) throw mErr;

    // Sum per student.
    const totals = new Map(); // studentId -> { marks, max }
    for (const m of marks || []) {
        const t = totals.get(m.student_id) || { marks: 0, max: 0 };
        t.marks += Number(m.marks);
        t.max += maxByAssessment.get(m.assessment_id) || 0;
        totals.set(m.student_id, t);
    }

    for (const [studentId, t] of totals) {
        const percentage = t.max > 0 ? Number(((t.marks / t.max) * 100).toFixed(2)) : 0;
        await supabase.from('marksheets').upsert({
            school_id: req.user.school_id,
            student_id: studentId,
            subject_id: subjectId,
            class_id: classId,
            term_id: termId,
            marks: t.marks,
            max_marks: t.max || 100,
            percentage,
            grade: gradeFor(percentage),
            entered_by: req.user.id,
        }, { onConflict: 'student_id,subject_id,term_id' });
    }

    return totals;
};

/** POST /api/assessments — create an assessment column. */
const createAssessment = asyncHandler(async (req, res) => {
    const { classId, subjectId, label, maxMarks } = req.body;
    const termId = await resolveTermId(req);

    if (!label || !String(label).trim()) throw new BadRequestError('A label is required');
    const max = Number(maxMarks ?? 100);
    if (!(max > 0)) throw new BadRequestError('maxMarks must be greater than zero');

    await fetchOwned('classes', 'id', [classId], req.user.school_id, 'class');
    await fetchOwned('subjects', 'id', [subjectId], req.user.school_id, 'subject');
    await assertCanRecordMarks(req, classId, subjectId);

    const { data: year } = await supabase
        .from('academic_years')
        .select('id')
        .eq('school_id', req.user.school_id)
        .eq('is_current', true)
        .maybeSingle();

    // sort_order = after the last existing column.
    const { data: existing } = await supabase
        .from('assessments')
        .select('sort_order')
        .eq('class_id', classId)
        .eq('subject_id', subjectId)
        .eq('term_id', termId);
    const nextOrder = (existing || []).reduce((mx, a) => Math.max(mx, a.sort_order || 0), 0) + 1;

    const { data, error } = await supabase
        .from('assessments')
        .insert({
            school_id: req.user.school_id,
            academic_year_id: year?.id ?? null,
            class_id: classId,
            subject_id: subjectId,
            term_id: termId,
            label: String(label).trim(),
            max_marks: max,
            sort_order: nextOrder,
            created_by: req.user.id,
        })
        .select('*')
        .single();

    if (error) {
        if (error.code === '23505') throw new BadRequestError('An assessment with that name already exists');
        throw error;
    }

    res.status(201).json({ assessment: data });
});

/** GET /api/assessments?classId=&subjectId=&termId= — columns + marks + finals. */
const listAssessments = asyncHandler(async (req, res) => {
    const { classId, subjectId } = req.query;
    const termId = req.query.termId || (await resolveTermId(req));

    await assertCanRecordMarks(req, classId, subjectId);

    const { data: assessments, error } = await supabase
        .from('assessments')
        .select('*')
        .eq('class_id', classId)
        .eq('subject_id', subjectId)
        .eq('term_id', termId)
        .order('sort_order', { ascending: true });
    if (error) throw error;

    const ids = (assessments || []).map((a) => a.id);
    let marks = [];
    if (ids.length > 0) {
        const m = await supabase
            .from('assessment_marks')
            .select('assessment_id, student_id, marks')
            .in('assessment_id', ids);
        if (m.error) throw m.error;
        marks = m.data || [];
    }

    // marks[assessmentId][studentId] = marks
    const markMap = {};
    for (const mm of marks) {
        (markMap[mm.assessment_id] ||= {})[mm.student_id] = Number(mm.marks);
    }

    res.json({
        assessments: (assessments || []).map((a) => ({
            id: a.id,
            label: a.label,
            maxMarks: Number(a.max_marks),
            sortOrder: a.sort_order,
            marks: markMap[a.id] || {},
        })),
    });
});

/** POST /api/assessments/marks/bulk — save marks across columns, recompute finals. */
const bulkSaveAssessmentMarks = asyncHandler(async (req, res) => {
    const { classId, subjectId, entries } = req.body;
    const termId = req.body.termId || (await resolveTermId(req));

    if (!Array.isArray(entries) || entries.length === 0) {
        throw new BadRequestError('entries must be a non-empty array');
    }

    await fetchOwned('classes', 'id', [classId], req.user.school_id, 'class');
    await fetchOwned('subjects', 'id', [subjectId], req.user.school_id, 'subject');
    await assertCanRecordMarks(req, classId, subjectId);

    // Load the referenced assessments to validate marks against their max.
    const assessmentIds = [...new Set(entries.map((e) => e.assessmentId))];
    const assessments = await fetchOwned('assessments', 'id, max_marks', assessmentIds, req.user.school_id, 'assessment');
    const maxBy = new Map(assessments.map((a) => [a.id, Number(a.max_marks)]));

    for (const e of entries) {
        const max = maxBy.get(e.assessmentId);
        const marks = Number(e.marks);
        if (Number.isNaN(marks) || marks < 0) throw new BadRequestError('Marks must be zero or greater');
        if (max !== undefined && marks > max) {
            throw new BadRequestError(`Marks exceed the assessment's maximum of ${max}`);
        }
    }

    const rows = entries.map((e) => ({
        school_id: req.user.school_id,
        assessment_id: e.assessmentId,
        student_id: e.studentId,
        marks: Number(e.marks),
        entered_by: req.user.id,
    }));

    const { data, error } = await supabase
        .from('assessment_marks')
        .upsert(rows, { onConflict: 'assessment_id,student_id' })
        .select('*');
    if (error) throw error;

    await recomputeFinals(req, classId, subjectId, termId);

    res.json({ saved: rows.length, marks: data });
});

/** DELETE /api/assessments/:id — remove a column and recompute finals. */
const deleteAssessment = asyncHandler(async (req, res) => {
    const { data: assessment, error: findErr } = await supabase
        .from('assessments')
        .select('*')
        .eq('id', req.params.id)
        .eq('school_id', req.user.school_id)
        .maybeSingle();
    if (findErr) throw findErr;
    if (!assessment) throw new NotFoundError('Assessment not found');

    await assertCanRecordMarks(req, assessment.class_id, assessment.subject_id);

    // Students marked in this column — their finals must be re-derived, and
    // anyone left with no remaining marks loses their final entirely.
    const { data: affected, error: affErr } = await supabase
        .from('assessment_marks')
        .select('student_id')
        .eq('assessment_id', assessment.id);
    if (affErr) throw affErr;
    const affectedIds = new Set((affected || []).map((m) => m.student_id));

    const { error: delErr } = await supabase
        .from('assessments')
        .delete()
        .eq('id', assessment.id);
    if (delErr) throw delErr;

    const totals = await recomputeFinals(req, assessment.class_id, assessment.subject_id, assessment.term_id);

    for (const studentId of affectedIds) {
        if (!totals.has(studentId)) {
            await supabase.from('marksheets')
                .delete()
                .eq('school_id', req.user.school_id)
                .eq('student_id', studentId)
                .eq('subject_id', assessment.subject_id)
                .eq('term_id', assessment.term_id);
        }
    }

    res.json({ message: 'Assessment deleted' });
});

module.exports = {
    createAssessment, listAssessments, bulkSaveAssessmentMarks, deleteAssessment,
};
