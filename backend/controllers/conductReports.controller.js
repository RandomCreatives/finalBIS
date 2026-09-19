const supabase = require('../config/supabase');
const {
    NotFoundError, ForbiddenError, ConflictError, BadRequestError, asyncHandler,
} = require('../utils/errors');

/*
 * Conduct reports (Admin Communications — "Conduct report").
 *
 * A teacher records student behavior for the admin. Three tones keep the
 * register clear:
 *
 *   praise  — something worth celebrating
 *   concern — a pattern the admin should watch
 *   serious — an incident needing immediate attention
 *
 * The workflow is forward-only so the teacher can always see how far a
 * report has travelled:
 *
 *   new --(admin reads & acknowledges)--> acknowledged --(action taken)--> actioned
 *   new --(reporter deletes)------------> (removed)
 */

const TYPES = ['praise', 'concern', 'serious'];
const STATUS_RANK = { new: 0, acknowledged: 1, actioned: 2 };

const SELECT = `
    id, class_id, student_id, reporter_id, type, body, status,
    handled_by, handled_at, action_note, created_at, updated_at,
    student:students!student_id(id, name),
    klass:classes!class_id(id, name),
    reporter:users!reporter_id(id, name),
    handler:users!handled_by(id, name)
`;

const shape = (r) => ({
    id: r.id,
    type: r.type,
    body: r.body,
    status: r.status,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
    student: r.student,
    class: r.klass,
    reporter: r.reporter,
    handler: r.handler,
    handledAt: r.handled_at,
    actionNote: r.action_note,
});

const cleanText = (v, max) => String(v || '').trim().slice(0, max);

const currentYearId = async (schoolId) => {
    const { data: year, error } = await supabase
        .from('academic_years')
        .select('id')
        .eq('school_id', schoolId)
        .eq('is_current', true)
        .maybeSingle();
    if (error) throw error;
    if (!year) throw new ConflictError('No current academic year is set');
    return year.id;
};

/** GET /api/conduct-reports?status=&type=&classId= */
const listReports = asyncHandler(async (req, res) => {
    const { status, type, classId } = req.query;

    let query = supabase
        .from('conduct_reports')
        .select(SELECT)
        .eq('school_id', req.user.school_id)
        .order('created_at', { ascending: false });

    // Admins see the whole school; teachers see the reports they filed.
    if (req.user.role !== 'admin') query = query.eq('reporter_id', req.user.id);
    if (status) query = query.eq('status', status);
    if (type) query = query.eq('type', type);
    if (classId) query = query.eq('class_id', classId);

    const { data, error } = await query;
    if (error) throw error;

    res.json({ reports: (data || []).map(shape) });
});

/**
 * POST /api/conduct-reports
 * Body: { classId, studentId, type, body }
 *
 * Like permission requests, a teacher may only report on their own class:
 * they must be the seated main teacher (admins may file for any class).
 */
const createReport = asyncHandler(async (req, res) => {
    const { classId, studentId, type } = req.body;
    const body = cleanText(req.body.body, 2000);

    if (!classId || !studentId) throw new BadRequestError('classId and studentId are required');
    if (!TYPES.includes(type)) throw new BadRequestError("type must be 'praise', 'concern' or 'serious'");
    if (body.length < 5) throw new BadRequestError('Please describe the behavior you are reporting');

    const yearId = await currentYearId(req.user.school_id);

    const { data: klass, error: classError } = await supabase
        .from('classes').select('id').eq('id', classId).eq('school_id', req.user.school_id).maybeSingle();
    if (classError) throw classError;
    if (!klass) throw new NotFoundError('Class not found');

    const { data: student, error: studentError } = await supabase
        .from('students').select('id, class_id, is_active')
        .eq('id', studentId).eq('school_id', req.user.school_id).maybeSingle();
    if (studentError) throw studentError;
    if (!student || student.class_id !== classId) {
        throw new BadRequestError('The student is not enrolled in this class');
    }

    if (req.user.role !== 'admin') {
        const { data: seat, error: seatError } = await supabase
            .from('class_staff')
            .select('id')
            .eq('class_id', classId)
            .eq('user_id', req.user.id)
            .eq('academic_year_id', yearId)
            .eq('position', 'main')
            .maybeSingle();
        if (seatError) throw seatError;
        if (!seat) {
            throw new ForbiddenError('Only the class main teacher can file conduct reports for this class');
        }
    }

    const { data, error } = await supabase
        .from('conduct_reports')
        .insert({
            school_id: req.user.school_id,
            academic_year_id: yearId,
            class_id: classId,
            student_id: studentId,
            reporter_id: req.user.id,
            type,
            body,
            status: 'new',
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
        })
        .select(SELECT)
        .single();
    if (error) throw error;

    res.status(201).json({ report: shape(data) });
});

/**
 * POST /api/conduct-reports/:id/status — admin moves a report forward.
 * Body: { status: 'acknowledged' | 'actioned', note? }
 * Transitions are forward-only: new → acknowledged → actioned (skipping
 * acknowledged is allowed — a quick incident can go straight to actioned).
 */
const updateStatus = asyncHandler(async (req, res) => {
    const { status } = req.body;
    const note = cleanText(req.body.note, 500);
    if (!['acknowledged', 'actioned'].includes(status)) {
        throw new BadRequestError("status must be 'acknowledged' or 'actioned'");
    }

    const { data: existing, error: lookupError } = await supabase
        .from('conduct_reports')
        .select('id, status')
        .eq('id', req.params.id)
        .eq('school_id', req.user.school_id)
        .maybeSingle();
    if (lookupError) throw lookupError;
    if (!existing) throw new NotFoundError('Conduct report not found');

    if (STATUS_RANK[status] <= STATUS_RANK[existing.status]) {
        throw new ConflictError(`This report was already ${existing.status}`);
    }

    const { data, error } = await supabase
        .from('conduct_reports')
        .update({
            status,
            handled_by: req.user.id,
            handled_at: new Date().toISOString(),
            action_note: note || null,
            updated_at: new Date().toISOString(),
        })
        .eq('id', req.params.id)
        .select(SELECT)
        .single();
    if (error) throw error;

    res.json({ report: shape(data) });
});

/** DELETE /api/conduct-reports/:id — reporter withdraws a report still marked new. */
const deleteReport = asyncHandler(async (req, res) => {
    const { data: existing, error: lookupError } = await supabase
        .from('conduct_reports')
        .select('reporter_id, status')
        .eq('id', req.params.id)
        .eq('school_id', req.user.school_id)
        .maybeSingle();
    if (lookupError) throw lookupError;
    if (!existing) throw new NotFoundError('Conduct report not found');
    if (existing.reporter_id !== req.user.id && req.user.role !== 'admin') {
        throw new ForbiddenError('Only the reporter can withdraw this report');
    }
    if (existing.status !== 'new') {
        throw new ConflictError('Only reports the admin has not picked up yet can be withdrawn');
    }

    const { error } = await supabase.from('conduct_reports').delete().eq('id', req.params.id);
    if (error) throw error;
    res.json({ message: 'Report withdrawn' });
});

module.exports = {
    listReports,
    createReport,
    updateStatus,
    deleteReport,
    TYPES,
};
