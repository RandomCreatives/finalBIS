const supabase = require('../config/supabase');
const { resolveTermId, requireTerm, weekCount } = require('./term.controller');
const {
    NotFoundError, ConflictError, ForbiddenError, BadRequestError, asyncHandler,
} = require('../utils/errors');
const { isFixtureSubject } = require('../utils/subjects');

/**
 * Schemes of work and weekly lesson plans.
 *
 * Ownership: a teacher writes and edits their own documents. The admin
 * reviews them. Once approved, a document is locked to its author —
 * reopening it is a review action, not an edit.
 */

const SCHEME_SELECT = `
    id, title, aims, assessment_plan, resources, status, submitted_at,
    reviewed_at, review_note, term_id, class_subject_id, author_id,
    author:users!author_id(id, name),
    reviewer:users!reviewed_by(id, name),
    assignment:class_subjects(id, class:classes(id, name), subject:subjects(id, name, code))
`;

const PLAN_SELECT = `
    id, week_number, topic, objectives, activities, resources, homework,
    reflection, status, submitted_at, reviewed_at, review_note,
    term_id, class_subject_id, scheme_id, author_id,
    author:users!author_id(id, name),
    reviewer:users!reviewed_by(id, name),
    assignment:class_subjects(id, class:classes(id, name), subject:subjects(id, name, code))
`;

const shapeScheme = (s) => ({
    id: s.id,
    title: s.title,
    aims: s.aims,
    assessmentPlan: s.assessment_plan,
    resources: s.resources,
    status: s.status,
    submittedAt: s.submitted_at,
    reviewedAt: s.reviewed_at,
    reviewNote: s.review_note,
    termId: s.term_id,
    classSubjectId: s.class_subject_id,
    authorId: s.author_id,
    author: s.author,
    reviewer: s.reviewer,
    class: s.assignment?.class ?? null,
    subject: s.assignment?.subject ?? null,
    weeks: (s.weeks || [])
        .map((w) => ({ id: w.id, weekNumber: w.week_number, topic: w.topic, objectives: w.objectives }))
        .sort((a, b) => a.weekNumber - b.weekNumber),
});

const shapePlan = (p) => ({
    id: p.id,
    weekNumber: p.week_number,
    topic: p.topic,
    objectives: p.objectives,
    activities: p.activities,
    resources: p.resources,
    homework: p.homework,
    reflection: p.reflection,
    status: p.status,
    submittedAt: p.submitted_at,
    reviewedAt: p.reviewed_at,
    reviewNote: p.review_note,
    termId: p.term_id,
    classSubjectId: p.class_subject_id,
    schemeId: p.scheme_id,
    authorId: p.author_id,
    author: p.author,
    reviewer: p.reviewer,
    class: p.assignment?.class ?? null,
    subject: p.assignment?.subject ?? null,
});

// Reviews and the whole-staff overview belong to the admin alone. Main
// teachers author their own documents like every other teacher.
const canReview = (user) => user.role === 'admin';

/** Authors edit their own work; nobody else does. */
const requireAuthor = (doc, user) => {
    if (doc.author_id !== user.id) {
        throw new ForbiddenError('Only the author can edit this document');
    }
    if (doc.status === 'approved') {
        throw new ConflictError('This document has been approved and can no longer be edited');
    }
};

// ---------------------------------------------------------------------------
// Schemes of work
// ---------------------------------------------------------------------------

/** GET /api/planning/schemes?termId=&mine=true&status= */
const listSchemes = asyncHandler(async (req, res) => {
    const termId = await resolveTermId(req);
    const { mine, status, classSubjectId } = req.query;

    let query = supabase
        .from('schemes_of_work')
        .select(SCHEME_SELECT)
        .eq('school_id', req.user.school_id)
        .eq('term_id', termId);

    // Teachers who cannot review only ever see their own.
    if (mine === 'true' || !canReview(req.user)) query = query.eq('author_id', req.user.id);
    if (status) query = query.eq('status', status);
    if (classSubjectId) query = query.eq('class_subject_id', classSubjectId);

    const { data, error } = await query;
    if (error) throw error;

    res.json({ termId, schemes: data.map(shapeScheme) });
});

/** GET /api/planning/schemes/:id */
const getScheme = asyncHandler(async (req, res) => {
    const { data, error } = await supabase
        .from('schemes_of_work')
        .select(SCHEME_SELECT)
        .eq('id', req.params.id)
        .eq('school_id', req.user.school_id)
        .maybeSingle();

    if (error) throw error;
    if (!data) throw new NotFoundError('Scheme of work not found');

    if (data.author_id !== req.user.id && !canReview(req.user)) {
        throw new ForbiddenError('This scheme belongs to another teacher');
    }

    const { data: weeks, error: weekError } = await supabase
        .from('scheme_weeks')
        .select('id, week_number, topic, objectives')
        .eq('scheme_id', req.params.id)
        .order('week_number');

    if (weekError) throw weekError;

    res.json({ scheme: shapeScheme({ ...data, weeks }) });
});

/**
 * POST /api/planning/schemes
 * Creates the scheme and scaffolds one row per teaching week.
 */
const createScheme = asyncHandler(async (req, res) => {
    const { classSubjectId, title, aims } = req.body;
    const termId = await resolveTermId(req);

    const { data, error } = await supabase.rpc('create_scheme_with_weeks', {
        p_school_id: req.user.school_id,
        p_term_id: termId,
        p_class_subject_id: classSubjectId,
        p_author_id: req.user.id,
        p_title: title,
        p_aims: aims ?? null,
    });

    if (error) {
        if (error.message?.includes('SCHEME_EXISTS')) {
            throw new ConflictError('A scheme already exists for this subject and term');
        }
        if (error.message?.includes('TERM_NOT_FOUND')) throw new NotFoundError('Term not found');
        throw error;
    }

    res.status(201).json({ scheme: data });
});

/** PATCH /api/planning/schemes/:id */
const updateScheme = asyncHandler(async (req, res) => {
    const { data: existing, error: lookupError } = await supabase
        .from('schemes_of_work')
        .select('author_id, status')
        .eq('id', req.params.id)
        .eq('school_id', req.user.school_id)
        .maybeSingle();

    if (lookupError) throw lookupError;
    if (!existing) throw new NotFoundError('Scheme of work not found');
    requireAuthor(existing, req.user);

    const map = {
        title: 'title', aims: 'aims',
        assessmentPlan: 'assessment_plan', resources: 'resources',
    };
    const patch = {};
    for (const [key, column] of Object.entries(map)) {
        if (req.body[key] !== undefined) patch[column] = req.body[key];
    }

    // Editing after a change request puts it back in the teacher's hands.
    if (existing.status === 'changes_requested') patch.status = 'draft';

    const { data, error } = await supabase
        .from('schemes_of_work')
        .update(patch)
        .eq('id', req.params.id)
        .select(SCHEME_SELECT)
        .single();

    if (error) throw error;
    res.json({ scheme: shapeScheme(data) });
});

/** PUT /api/planning/schemes/:id/weeks/:weekNumber */
const updateSchemeWeek = asyncHandler(async (req, res) => {
    const { topic, objectives } = req.body;

    const { data: scheme, error: lookupError } = await supabase
        .from('schemes_of_work')
        .select('author_id, status')
        .eq('id', req.params.id)
        .eq('school_id', req.user.school_id)
        .maybeSingle();

    if (lookupError) throw lookupError;
    if (!scheme) throw new NotFoundError('Scheme of work not found');
    requireAuthor(scheme, req.user);

    const { data, error } = await supabase
        .from('scheme_weeks')
        .upsert(
            {
                scheme_id: req.params.id,
                week_number: Number(req.params.weekNumber),
                topic: topic ?? '',
                objectives: objectives ?? null,
            },
            { onConflict: 'scheme_id,week_number' }
        )
        .select('id, week_number, topic, objectives')
        .single();

    if (error) throw error;

    res.json({
        week: {
            id: data.id,
            weekNumber: data.week_number,
            topic: data.topic,
            objectives: data.objectives,
        },
    });
});

// ---------------------------------------------------------------------------
// Lesson plans
// ---------------------------------------------------------------------------

/** GET /api/planning/lesson-plans?termId=&week=&mine=true&status= */
const listLessonPlans = asyncHandler(async (req, res) => {
    const termId = await resolveTermId(req);
    const { week, mine, status, classSubjectId } = req.query;

    let query = supabase
        .from('lesson_plans')
        .select(PLAN_SELECT)
        .eq('school_id', req.user.school_id)
        .eq('term_id', termId)
        .order('week_number');

    if (mine === 'true' || !canReview(req.user)) query = query.eq('author_id', req.user.id);
    if (week) query = query.eq('week_number', Number(week));
    if (status) query = query.eq('status', status);
    if (classSubjectId) query = query.eq('class_subject_id', classSubjectId);

    const { data, error } = await query;
    if (error) throw error;

    res.json({ termId, lessonPlans: data.map(shapePlan) });
});

/**
 * PUT /api/planning/lesson-plans
 * Creates or updates the plan for one week of one subject.
 */
const upsertLessonPlan = asyncHandler(async (req, res) => {
    const {
        classSubjectId, weekNumber, topic, objectives,
        activities, resources, homework, reflection, schemeId,
    } = req.body;

    const termId = await resolveTermId(req);
    const term = await requireTerm(termId, req.user.school_id);
    const total = weekCount(term.starts_on, term.ends_on);

    if (weekNumber > total) {
        throw new BadRequestError(`${term.name} only has ${total} teaching weeks`);
    }

    // Guard against overwriting a colleague's plan for the same slot.
    const { data: existing, error: lookupError } = await supabase
        .from('lesson_plans')
        .select('id, author_id, status')
        .eq('term_id', termId)
        .eq('class_subject_id', classSubjectId)
        .eq('week_number', weekNumber)
        .maybeSingle();

    if (lookupError) throw lookupError;
    if (existing) requireAuthor(existing, req.user);

    const payload = {
        school_id: req.user.school_id,
        term_id: termId,
        class_subject_id: classSubjectId,
        scheme_id: schemeId ?? null,
        author_id: existing?.author_id ?? req.user.id,
        week_number: weekNumber,
        topic,
        objectives: objectives ?? null,
        activities: activities ?? null,
        resources: resources ?? null,
        homework: homework ?? null,
        reflection: reflection ?? null,
        ...(existing?.status === 'changes_requested' ? { status: 'draft' } : {}),
    };

    const { data, error } = await supabase
        .from('lesson_plans')
        .upsert(payload, { onConflict: 'term_id,class_subject_id,week_number' })
        .select(PLAN_SELECT)
        .single();

    if (error) throw error;

    res.json({ lessonPlan: shapePlan(data) });
});

/** DELETE /api/planning/lesson-plans/:id */
const deleteLessonPlan = asyncHandler(async (req, res) => {
    const { data: existing, error: lookupError } = await supabase
        .from('lesson_plans')
        .select('author_id, status')
        .eq('id', req.params.id)
        .eq('school_id', req.user.school_id)
        .maybeSingle();

    if (lookupError) throw lookupError;
    if (!existing) throw new NotFoundError('Lesson plan not found');

    if (existing.author_id !== req.user.id && req.user.role !== 'admin') {
        throw new ForbiddenError('Only the author can delete this plan');
    }

    const { error } = await supabase.from('lesson_plans').delete().eq('id', req.params.id);
    if (error) throw error;

    res.json({ message: 'Lesson plan deleted' });
});

// ---------------------------------------------------------------------------
// Submission and review
// ---------------------------------------------------------------------------

/** POST /api/planning/:kind/:id/submit */
const submitDocument = asyncHandler(async (req, res) => {
    const table = req.params.kind === 'schemes' ? 'schemes_of_work' : 'lesson_plans';

    const { data: existing, error: lookupError } = await supabase
        .from(table)
        .select('author_id, status')
        .eq('id', req.params.id)
        .eq('school_id', req.user.school_id)
        .maybeSingle();

    if (lookupError) throw lookupError;
    if (!existing) throw new NotFoundError('Document not found');
    if (existing.author_id !== req.user.id) {
        throw new ForbiddenError('Only the author can submit this document');
    }
    if (existing.status === 'submitted') throw new ConflictError('Already submitted');
    if (existing.status === 'approved') throw new ConflictError('Already approved');

    const { data, error } = await supabase
        .from(table)
        .update({ status: 'submitted', submitted_at: new Date().toISOString() })
        .eq('id', req.params.id)
        .select('id, status, submitted_at')
        .single();

    if (error) throw error;

    res.json({ document: { id: data.id, status: data.status, submittedAt: data.submitted_at } });
});

/** POST /api/planning/:kind/:id/review */
const reviewDocument = asyncHandler(async (req, res) => {
    const { decision, note } = req.body;
    const kind = req.params.kind === 'schemes' ? 'scheme' : 'lesson_plan';

    const { data, error } = await supabase.rpc('review_planning_document', {
        p_kind: kind,
        p_document_id: req.params.id,
        p_decision: decision,
        p_note: note ?? null,
        p_reviewer_id: req.user.id,
        p_school_id: req.user.school_id,
    });

    if (error) {
        if (error.message?.includes('DOCUMENT_NOT_FOUND')) throw new NotFoundError('Document not found');
        if (error.message?.includes('NOT_SUBMITTED')) {
            throw new ConflictError('This document has not been submitted for review yet');
        }
        throw error;
    }

    res.json({ document: data });
});

/**
 * GET /api/planning/overview
 *
 * The admin's planning hub. Two shapes in one response:
 *  - rows: one per teaching assignment, showing the scheme's state, which
 *    weekly plans have been handed in, and which due weeks are missing;
 *  - awaiting: the review inbox — every submitted scheme and weekly plan,
 *    oldest first, with enough content to read and decide on the spot.
 */
const getPlanningOverview = asyncHandler(async (req, res) => {
    const termId = await resolveTermId(req);
    const term = await requireTerm(termId, req.user.school_id);
    const expectedWeeks = weekCount(term.starts_on, term.ends_on);

    // Which teaching week are we in? Same math as GET /api/terms/current.
    const today = new Date().toISOString().slice(0, 10);
    let currentWeek = null;
    if (today >= term.starts_on && today <= term.ends_on) {
        const elapsed = (new Date(today) - new Date(term.starts_on)) / 86400000;
        currentWeek = Math.min(expectedWeeks, Math.floor(elapsed / 7) + 1);
    }

    const [assignmentRes, schemeRes, planRes] = await Promise.all([
        supabase
            .from('class_subjects')
            .select('id, class:classes(id, name), subject:subjects(id, name, code), teacher:users(id, name)')
            .eq('school_id', req.user.school_id)
            .eq('academic_year_id', term.academic_year_id),
        supabase
            .from('schemes_of_work')
            .select('id, class_subject_id, title, status, author_id, submitted_at')
            .eq('school_id', req.user.school_id)
            .eq('term_id', termId),
        supabase
            .from('lesson_plans')
            .select(`id, class_subject_id, week_number, status, author_id, submitted_at,
                     topic, objectives, activities, resources, homework, reflection`)
            .eq('school_id', req.user.school_id)
            .eq('term_id', termId),
    ]);

    for (const r of [assignmentRes, schemeRes, planRes]) {
        if (r.error) throw r.error;
    }

    const schemes = schemeRes.data || [];
    const plans = planRes.data || [];

    // Registration seats carry no planning obligation — roll call is not taught.
    const seats = (assignmentRes.data || [])
        .filter((a) => a.teacher && !isFixtureSubject(a.subject));

    const rows = seats.map((a) => {
        const scheme = schemes.find((s) => s.class_subject_id === a.id);
        const seatPlans = plans.filter((p) => p.class_subject_id === a.id);
        // A week only counts once its plan is handed in (submitted) or approved.
        const submittedWeeks = seatPlans
            .filter((p) => ['submitted', 'approved'].includes(p.status))
            .map((p) => p.week_number)
            .sort((x, y) => x - y);
        // Late = a week that has started (or passed) with no plan handed in.
        const missingWeeks = currentWeek
            ? Array.from({ length: currentWeek }, (_, i) => i + 1)
                .filter((w) => !submittedWeeks.includes(w))
            : [];

        return {
            classSubjectId: a.id,
            class: a.class,
            subject: a.subject,
            teacher: a.teacher,
            schemeId: scheme?.id ?? null,
            schemeStatus: scheme?.status ?? 'missing',
            lessonPlanCount: seatPlans.length,
            approvedPlans: seatPlans.filter((p) => p.status === 'approved').length,
            submittedWeeks,
            missingWeeks,
            expectedWeeks,
        };
    });

    // The review inbox: everything handed in and not yet decided, oldest first.
    const submittedDocs = [
        ...schemes
            .filter((s) => s.status === 'submitted')
            .map((s) => ({ kind: 'schemes', ...s })),
        ...plans
            .filter((p) => p.status === 'submitted')
            .map((p) => ({ kind: 'lesson-plans', ...p })),
    ];

    const authorIds = [...new Set(submittedDocs.map((d) => d.author_id).filter(Boolean))];
    const { data: authorRows, error: authorError } = authorIds.length
        ? await supabase.from('users').select('id, name').in('id', authorIds)
        : { data: [], error: null };
    if (authorError) throw authorError;

    const authorById = new Map((authorRows || []).map((u) => [u.id, u]));
    const seatById = new Map(seats.map((a) => [a.id, a]));

    const awaiting = submittedDocs
        .map((d) => {
            const seat = seatById.get(d.class_subject_id);
            const base = {
                kind: d.kind,
                id: d.id,
                classSubjectId: d.class_subject_id,
                status: d.status,
                author: authorById.get(d.author_id) ?? null,
                class: seat?.class ?? null,
                subject: seat?.subject ?? null,
                submittedAt: d.submitted_at ?? null,
            };
            if (d.kind === 'schemes') return { ...base, title: d.title };
            return {
                ...base,
                weekNumber: d.week_number,
                topic: d.topic,
                objectives: d.objectives ?? null,
                activities: d.activities ?? null,
                resources: d.resources ?? null,
                homework: d.homework ?? null,
                reflection: d.reflection ?? null,
            };
        })
        .sort((a, b) => new Date(a.submittedAt || 0) - new Date(b.submittedAt || 0));

    res.json({
        termId,
        term: {
            id: term.id, name: term.name, weekCount: expectedWeeks, currentWeek,
        },
        rows,
        awaiting,
        summary: {
            assignments: rows.length,
            schemesMissing: rows.filter((r) => r.schemeStatus === 'missing').length,
            awaitingReview: awaiting.length,
            schemesApproved: rows.filter((r) => r.schemeStatus === 'approved').length,
            lateTeachers: rows.filter((r) => r.missingWeeks.length > 0).length,
        },
    });
});

module.exports = {
    listSchemes, getScheme, createScheme, updateScheme, updateSchemeWeek,
    listLessonPlans, upsertLessonPlan, deleteLessonPlan,
    submitDocument, reviewDocument, getPlanningOverview,
};
