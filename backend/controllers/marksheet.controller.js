const supabase = require('../config/supabase');
const { ROLES } = require('../middleware/auth');
const { resolveTermId } = require('./term.controller');
const { resolveYearId: resolveAcademicYearId } = require('./academicYear.controller');
const {
    BadRequestError, ForbiddenError, NotFoundError, asyncHandler,
} = require('../utils/errors');

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

// ---------------------------------------------------------------------------
// Authorisation helpers
//
// Writes are scoped the same way the timetable scopes visibility:
//   * admins may record anywhere in their school
//   * a main teacher may record any subject of a class they run (their seat
//     in class_staff), plus any subject explicitly assigned to them
//   * a subject teacher may record only a (class, subject) pair that names
//     them in class_subjects for the current academic year
// Everything is also checked against req.user.school_id, so ids from another
// school can never be attached to a marksheet.
// ---------------------------------------------------------------------------

/**
 * Confirm every id exists in the caller's school and return the rows.
 * Throws when anything is foreign or unknown.
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
 * Assert the caller may record marks for every (classId, subjectId) pair.
 * Admins are exempt. Throws ForbiddenError otherwise.
 */
const assertCanRecord = async (req, pairs) => {
    if (req.user.role === ROLES.ADMIN || pairs.length === 0) return;

    const yearId = await resolveAcademicYearId(req);
    const classIds = [...new Set(pairs.map((p) => p.classId))];

    // Main teachers: classes they run are fully theirs.
    let mainClassIds = new Set();
    if (req.user.role === ROLES.MAIN_TEACHER) {
        const { data, error } = await supabase
            .from('class_staff')
            .select('class_id')
            .eq('academic_year_id', yearId)
            .eq('user_id', req.user.id)
            .eq('position', 'main')
            .in('class_id', classIds);

        if (error) throw error;
        mainClassIds = new Set((data || []).map((r) => r.class_id));
    }

    const remaining = pairs.filter((p) => !mainClassIds.has(p.classId));
    if (remaining.length === 0) return;

    // Otherwise an explicit teaching assignment must name them.
    const { data: assignments, error } = await supabase
        .from('class_subjects')
        .select('class_id, subject_id')
        .eq('academic_year_id', yearId)
        .eq('teacher_id', req.user.id)
        .in('class_id', [...new Set(remaining.map((p) => p.classId))]);

    if (error) throw error;

    const have = new Set((assignments || []).map((a) => `${a.class_id}|${a.subject_id}`));
    if (remaining.some((p) => !have.has(`${p.classId}|${p.subjectId}`))) {
        throw new ForbiddenError(
            'You are not assigned to teach this subject for this class'
        );
    }
};

/**
 * Resolve the student's class and reconcile it with any client-claimed class.
 * The student's own placement wins, which also keeps the
 * (student_id, subject_id, term_id) upsert from ever crossing classes.
 * Returns { classId, pairs } where classId may be null for unplaced students.
 */
const resolveStudentClass = async (req, studentId, claimedClassId) => {
    const [student] = await fetchOwned(
        'students', 'id, class_id', [studentId], req.user.school_id, 'student'
    );

    const actualClassId = student.class_id ?? null;

    if (claimedClassId && actualClassId && claimedClassId !== actualClassId) {
        throw new BadRequestError('Student is not enrolled in the stated class');
    }
    if (claimedClassId && !actualClassId) {
        throw new BadRequestError('Student is not placed in a class');
    }

    const classId = actualClassId ?? claimedClassId ?? null;

    if (!classId && req.user.role !== ROLES.ADMIN) {
        throw new ForbiddenError('Student is not placed in a class');
    }
    if (classId) {
        await fetchOwned('classes', 'id', [classId], req.user.school_id, 'class');
    }

    return classId;
};

/**
 * PUT /api/marksheets — create or update one result.
 * Percentage and grade are always derived server-side so a client cannot
 * submit a grade that disagrees with the marks.
 */
const upsertMarksheet = asyncHandler(async (req, res) => {
    const { studentId, subjectId, classId, marks, maxMarks } = req.body;
    const termId = await resolveTermId(req);

    await fetchOwned('subjects', 'id', [subjectId], req.user.school_id, 'subject');

    const effectiveClassId = await resolveStudentClass(req, studentId, classId ?? null);
    await assertCanRecord(req, effectiveClassId
        ? [{ classId: effectiveClassId, subjectId }]
        : []);

    const max = maxMarks ?? 100;
    const percentage = Number(((marks / max) * 100).toFixed(2));

    const { data, error } = await supabase
        .from('marksheets')
        .upsert(
            {
                school_id: req.user.school_id,
                student_id: studentId,
                subject_id: subjectId,
                class_id: effectiveClassId,
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

    // School membership — every referenced student and subject must be ours.
    const students = await fetchOwned(
        'students', 'id, class_id',
        entries.map((e) => e.studentId), req.user.school_id, 'student'
    );
    const studentClass = new Map(students.map((s) => [s.id, s.class_id ?? null]));

    await fetchOwned(
        'subjects', 'id',
        entries.map((e) => e.subjectId), req.user.school_id, 'subject'
    );

    const claimedClassIds = [...new Set(
        [classId, ...entries.map((e) => e.classId)].filter(Boolean)
    )];
    if (claimedClassIds.length > 0) {
        await fetchOwned('classes', 'id', claimedClassIds, req.user.school_id, 'class');
    }

    // Reconcile each entry against the student's actual class.
    const rows = [];
    const pairs = [];

    for (const e of entries) {
        const claimed = e.classId ?? classId ?? null;
        const actual = studentClass.get(e.studentId);

        if (claimed && actual && claimed !== actual) {
            throw new BadRequestError('Student is not enrolled in the stated class');
        }
        if (claimed && !actual) {
            throw new BadRequestError('Student is not placed in a class');
        }

        const effectiveClassId = actual ?? claimed ?? null;

        if (!effectiveClassId && req.user.role !== ROLES.ADMIN) {
            throw new ForbiddenError('Student is not placed in a class');
        }
        if (effectiveClassId) pairs.push({ classId: effectiveClassId, subjectId: e.subjectId });

        const max = e.maxMarks ?? 100;
        const percentage = Number(((e.marks / max) * 100).toFixed(2));

        rows.push({
            school_id: req.user.school_id,
            student_id: e.studentId,
            subject_id: e.subjectId,
            class_id: effectiveClassId,
            term_id: termId,
            marks: e.marks,
            max_marks: max,
            percentage,
            grade: gradeFor(percentage),
            entered_by: req.user.id,
        });
    }

    // Ownership — one check covering every (class, subject) pair in the sheet.
    const distinctPairs = [...new Map(
        pairs.map((p) => [`${p.classId}|${p.subjectId}`, p])
    ).values()];
    await assertCanRecord(req, distinctPairs);

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
    assertCanRecord, // exported for tests
};
