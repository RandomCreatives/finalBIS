const supabase = require('../config/supabase');
const {
    NotFoundError, ForbiddenError, ConflictError, BadRequestError, asyncHandler,
} = require('../utils/errors');

/*
 * Permission requests (Admin Communications — "Request").
 *
 * A teacher asks the admin for permission tied to a specific roster
 * student — the everyday case being a parent collecting a child in the
 * middle of a lesson. The flow is intentionally light:
 *
 *   pending --(admin approves/declines)--> approved | declined
 *   pending --(requester deletes)-------> (removed, like store requests)
 */

const SELECT = `
    id, class_id, student_id, requester_id, reason, pickup_time, status,
    reviewed_by, reviewed_at, review_note, created_at, updated_at,
    student:students!student_id(id, name),
    klass:classes!class_id(id, name),
    requester:users!requester_id(id, name),
    reviewer:users!reviewed_by(id, name)
`;

const shape = (r) => ({
    id: r.id,
    status: r.status,
    reason: r.reason,
    pickupTime: r.pickup_time,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
    student: r.student,
    class: r.klass,
    requester: r.requester,
    reviewer: r.reviewer,
    reviewedAt: r.reviewed_at,
    reviewNote: r.review_note,
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

/** GET /api/permission-requests?status=&classId= */
const listRequests = asyncHandler(async (req, res) => {
    const { status, classId } = req.query;

    let query = supabase
        .from('permission_requests')
        .select(SELECT)
        .eq('school_id', req.user.school_id)
        .order('created_at', { ascending: false });

    // Admins see the whole school; teachers see their own requests.
    if (req.user.role !== 'admin') query = query.eq('requester_id', req.user.id);
    if (status) query = query.eq('status', status);
    if (classId) query = query.eq('class_id', classId);

    const { data, error } = await query;
    if (error) throw error;

    res.json({ requests: (data || []).map(shape) });
});

/**
 * POST /api/permission-requests
 * Body: { classId, studentId, reason, pickupTime? }
 *
 * A teacher may only request for a class they are the seated main teacher
 * of (admins may create for any class).
 */
const createRequest = asyncHandler(async (req, res) => {
    const { classId, studentId, pickupTime } = req.body;
    const reason = cleanText(req.body.reason, 1000);

    if (!classId || !studentId) throw new BadRequestError('classId and studentId are required');
    if (reason.length < 3) throw new BadRequestError('Please describe what you are asking permission for');

    let pickup = null;
    if (pickupTime) {
        pickup = new Date(pickupTime);
        if (Number.isNaN(pickup.getTime())) throw new BadRequestError('pickupTime must be a valid date/time');
    }

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
            throw new ForbiddenError('Only the class main teacher can request permissions for this class');
        }
    }

    const { data, error } = await supabase
        .from('permission_requests')
        .insert({
            school_id: req.user.school_id,
            academic_year_id: yearId,
            class_id: classId,
            student_id: studentId,
            requester_id: req.user.id,
            reason,
            pickup_time: pickup ? pickup.toISOString() : null,
            status: 'pending',
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
        })
        .select(SELECT)
        .single();
    if (error) throw error;

    res.status(201).json({ request: shape(data) });
});

/** POST /api/permission-requests/:id/review — admin approves or declines. */
const reviewRequest = asyncHandler(async (req, res) => {
    const { decision } = req.body;
    const note = cleanText(req.body.note, 500);
    if (!['approved', 'declined'].includes(decision)) {
        throw new BadRequestError("decision must be 'approved' or 'declined'");
    }

    const { data: existing, error: lookupError } = await supabase
        .from('permission_requests')
        .select('id, status')
        .eq('id', req.params.id)
        .eq('school_id', req.user.school_id)
        .maybeSingle();
    if (lookupError) throw lookupError;
    if (!existing) throw new NotFoundError('Request not found');
    if (existing.status !== 'pending') {
        throw new ConflictError(`This request was already ${existing.status}`);
    }

    const { data, error } = await supabase
        .from('permission_requests')
        .update({
            status: decision,
            reviewed_by: req.user.id,
            reviewed_at: new Date().toISOString(),
            review_note: note || null,
            updated_at: new Date().toISOString(),
        })
        .eq('id', req.params.id)
        .select(SELECT)
        .single();
    if (error) throw error;

    res.json({ request: shape(data) });
});

/** DELETE /api/permission-requests/:id — requester withdraws a pending request. */
const deleteRequest = asyncHandler(async (req, res) => {
    const { data: existing, error: lookupError } = await supabase
        .from('permission_requests')
        .select('requester_id, status')
        .eq('id', req.params.id)
        .eq('school_id', req.user.school_id)
        .maybeSingle();
    if (lookupError) throw lookupError;
    if (!existing) throw new NotFoundError('Request not found');
    if (existing.requester_id !== req.user.id && req.user.role !== 'admin') {
        throw new ForbiddenError('Only the requester can withdraw this request');
    }
    if (existing.status !== 'pending') {
        throw new ConflictError('Only pending requests can be withdrawn');
    }

    const { error } = await supabase.from('permission_requests').delete().eq('id', req.params.id);
    if (error) throw error;
    res.json({ message: 'Request withdrawn' });
});

/**
 * GET /api/communications/badge-counts — admin home badge: everything still
 * waiting on an admin decision across the Admin Communications channels
 * (store requests, permission requests, un-read conduct reports).
 */
const badgeCounts = asyncHandler(async (req, res) => {
    const school = req.user.school_id;

    const count = async (table, statusIn) => {
        const { data, error } = await supabase.from(table).select('id').eq('school_id', school).in('status', statusIn);
        if (error) throw error;
        return (data || []).length;
    };

    const [store, permission, conduct] = await Promise.all([
        // Anything not finally resolved still needs action — the admin stands
        // in for the store stage while there is no store-manager account.
        count('store_requests', ['pending', 'store_approved']),
        count('permission_requests', ['pending']),
        count('conduct_reports', ['new']),
    ]);

    res.json({
        badgeCounts: {
            storeRequestsPending: store,
            permissionRequestsPending: permission,
            conductReportsPending: conduct,
        },
    });
});

module.exports = {
    listRequests,
    createRequest,
    reviewRequest,
    deleteRequest,
    badgeCounts,
};
