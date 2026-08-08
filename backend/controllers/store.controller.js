const supabase = require('../config/supabase');
const { NotFoundError, ForbiddenError, ConflictError, asyncHandler } = require('../utils/errors');

/**
 * Store Requests — class resource requisitions.
 *
 * Teachers request classroom items (books, markers, pens, pencils, ...) for
 * their class. Two-stage approval:
 *   pending        -> store manager approves  -> store_approved
 *   store_approved -> admin gives final approval -> approved
 * A rejection at either stage is final and records who/why.
 */

const SELECT = `
    id, request_number, items, purpose, status, created_at, updated_at,
    requester:users!requester_id(id, name, role),
    class:classes(id, name),
    store_reviewer:users!store_reviewed_by(id, name),
    store_reviewed_at, store_review_note,
    admin_reviewer:users!admin_reviewed_by(id, name),
    admin_reviewed_at, admin_review_note
`;

const shape = (r) => ({
    id: r.id,
    requestNumber: r.request_number,
    items: r.items || [],
    purpose: r.purpose,
    status: r.status,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
    requester: r.requester,
    class: r.class,
    storeReviewer: r.store_reviewer,
    storeReviewedAt: r.store_reviewed_at,
    storeReviewNote: r.store_review_note,
    adminReviewer: r.admin_reviewer,
    adminReviewedAt: r.admin_reviewed_at,
    adminReviewNote: r.admin_review_note,
});

/** Normalise + validate the items array from the request body. */
const cleanItems = (items) => {
    if (!Array.isArray(items) || items.length === 0) {
        throw new Error('At least one item is required');
    }
    return items.map((it) => {
        const item = typeof it.item === 'string' ? it.item.trim() : '';
        const quantity = Number.parseInt(it.quantity, 10);
        if (!item) throw new Error('Every item needs a name');
        if (!Number.isInteger(quantity) || quantity <= 0) {
            throw new Error(`Quantity for "${item}" must be a positive number`);
        }
        const note = typeof it.note === 'string' ? it.note.trim() : '';
        return { item, quantity, note };
    });
};

/** Next request number for a school: REQ-YYYY-NNNN */
const nextRequestNumber = async (schoolId) => {
    const year = new Date().getFullYear();
    const { data, error } = await supabase
        .from('store_requests')
        .select('request_number')
        .eq('school_id', schoolId)
        .ilike('request_number', `REQ-${year}-%`);
    if (error) throw error;
    const maxSeq = (data || []).reduce((max, row) => {
        const m = /REQ-\d+-(\d+)/.exec(row.request_number);
        return m ? Math.max(max, Number.parseInt(m[1], 10)) : max;
    }, 0);
    return `REQ-${year}-${String(maxSeq + 1).padStart(4, '0')}`;
};

/**
 * GET /api/store/requests?status=
 *
 * Teachers see only their own; the store manager and admin see the whole
 * queue so the request can move through both approval stages.
 */
const listRequests = asyncHandler(async (req, res) => {
    const { status } = req.query;

    let query = supabase
        .from('store_requests')
        .select(SELECT)
        .eq('school_id', req.user.school_id)
        .order('created_at', { ascending: false });

    if (req.user.role !== 'admin' && req.user.role !== 'store_manager') {
        query = query.eq('requester_id', req.user.id);
    }

    if (status) query = query.eq('status', status);

    const { data, error } = await query;
    if (error) throw error;

    res.json({ requests: (data || []).map(shape) });
});

/** GET /api/store/requests/:id */
const getRequest = asyncHandler(async (req, res) => {
    const { data, error } = await supabase
        .from('store_requests')
        .select(SELECT)
        .eq('id', req.params.id)
        .eq('school_id', req.user.school_id)
        .maybeSingle();

    if (error) throw error;
    if (!data) throw new NotFoundError('Request not found');

    const visible =
        req.user.role === 'admin' ||
        req.user.role === 'store_manager' ||
        data.requester_id === req.user.id;
    if (!visible) throw new ForbiddenError('You cannot view this request');

    res.json({ request: shape(data) });
});

/** POST /api/store/requests — teachers (any staff) request items for a class. */
const createRequest = asyncHandler(async (req, res) => {
    const { classId, purpose } = req.body;
    const items = cleanItems(req.body.items);

    const { data: year } = await supabase
        .from('academic_years')
        .select('id')
        .eq('school_id', req.user.school_id)
        .eq('is_current', true)
        .maybeSingle();

    const { data, error } = await supabase
        .from('store_requests')
        .insert({
            school_id: req.user.school_id,
            academic_year_id: year?.id ?? null,
            request_number: await nextRequestNumber(req.user.school_id),
            requester_id: req.user.id,
            class_id: classId ?? null,
            items,
            purpose: purpose?.trim() || null,
            status: 'pending',
        })
        .select(SELECT)
        .single();

    if (error) {
        // Collision on request_number from two requests racing — retry once.
        if (error.code === '23505') {
            const { data: retry, error: retryError } = await supabase
                .from('store_requests')
                .insert({
                    school_id: req.user.school_id,
                    academic_year_id: year?.id ?? null,
                    request_number: await nextRequestNumber(req.user.school_id),
                    requester_id: req.user.id,
                    class_id: classId ?? null,
                    items,
                    purpose: purpose?.trim() || null,
                    status: 'pending',
                })
                .select(SELECT)
                .single();
            if (retryError) throw retryError;
            return res.status(201).json({ request: shape(retry) });
        }
        throw error;
    }

    res.status(201).json({ request: shape(data) });
});

/** PATCH /api/store/requests/:id — the requester edits their own draft. */
const updateRequest = asyncHandler(async (req, res) => {
    const { data: existing, error: lookupError } = await supabase
        .from('store_requests')
        .select('requester_id, status')
        .eq('id', req.params.id)
        .eq('school_id', req.user.school_id)
        .maybeSingle();

    if (lookupError) throw lookupError;
    if (!existing) throw new NotFoundError('Request not found');
    if (existing.requester_id !== req.user.id) {
        throw new ForbiddenError('Only the requester can edit this request');
    }
    if (existing.status !== 'pending') {
        throw new ConflictError('Only pending requests can be edited');
    }

    const patch = {};
    if (req.body.items !== undefined) patch.items = cleanItems(req.body.items);
    if (req.body.classId !== undefined) patch.class_id = req.body.classId ?? null;
    if (req.body.purpose !== undefined) patch.purpose = req.body.purpose?.trim() || null;

    const { data, error } = await supabase
        .from('store_requests')
        .update(patch)
        .eq('id', req.params.id)
        .select(SELECT)
        .single();

    if (error) throw error;
    res.json({ request: shape(data) });
});

/** DELETE /api/store/requests/:id — cancel a request while it is still pending. */
const cancelRequest = asyncHandler(async (req, res) => {
    const { data: existing, error: lookupError } = await supabase
        .from('store_requests')
        .select('requester_id, status')
        .eq('id', req.params.id)
        .eq('school_id', req.user.school_id)
        .maybeSingle();

    if (lookupError) throw lookupError;
    if (!existing) throw new NotFoundError('Request not found');
    if (existing.requester_id !== req.user.id && req.user.role !== 'admin') {
        throw new ForbiddenError('Only the requester can cancel this request');
    }
    if (existing.status !== 'pending') {
        throw new ConflictError('Only pending requests can be cancelled');
    }

    const { error } = await supabase.from('store_requests').delete().eq('id', req.params.id);
    if (error) throw error;
    res.json({ message: 'Request cancelled' });
});

/**
 * POST /api/store/requests/:id/store-review
 *
 * First stage: the store manager approves or rejects the request. Admins may
 * stand in for the store manager while there is no store-manager account.
 */
const storeReview = asyncHandler(async (req, res) => {
    const { decision, note } = req.body;

    const { data: existing, error: lookupError } = await supabase
        .from('store_requests')
        .select('status')
        .eq('id', req.params.id)
        .eq('school_id', req.user.school_id)
        .maybeSingle();

    if (lookupError) throw lookupError;
    if (!existing) throw new NotFoundError('Request not found');
    if (existing.status !== 'pending') {
        throw new ConflictError('This request is not waiting for the store manager');
    }

    const patch =
        decision === 'approved'
            ? { status: 'store_approved', store_reviewed_by: req.user.id, store_reviewed_at: new Date().toISOString(), store_review_note: note?.trim() || null }
            : { status: 'rejected', store_reviewed_by: req.user.id, store_reviewed_at: new Date().toISOString(), store_review_note: note?.trim() || null };

    const { data, error } = await supabase
        .from('store_requests')
        .update(patch)
        .eq('id', req.params.id)
        .select(SELECT)
        .single();

    if (error) throw error;
    res.json({ request: shape(data) });
});

/**
 * POST /api/store/requests/:id/admin-review
 *
 * Final stage: only the admin can approve a store-approved request.
 */
const adminReview = asyncHandler(async (req, res) => {
    const { decision, note } = req.body;

    const { data: existing, error: lookupError } = await supabase
        .from('store_requests')
        .select('status')
        .eq('id', req.params.id)
        .eq('school_id', req.user.school_id)
        .maybeSingle();

    if (lookupError) throw lookupError;
    if (!existing) throw new NotFoundError('Request not found');
    if (existing.status !== 'store_approved') {
        throw new ConflictError('This request has not passed the store-manager stage yet');
    }

    const patch =
        decision === 'approved'
            ? { status: 'approved', admin_reviewed_by: req.user.id, admin_reviewed_at: new Date().toISOString(), admin_review_note: note?.trim() || null }
            : { status: 'rejected', admin_reviewed_by: req.user.id, admin_reviewed_at: new Date().toISOString(), admin_review_note: note?.trim() || null };

    const { data, error } = await supabase
        .from('store_requests')
        .update(patch)
        .eq('id', req.params.id)
        .select(SELECT)
        .single();

    if (error) throw error;
    res.json({ request: shape(data) });
});

module.exports = {
    listRequests,
    getRequest,
    createRequest,
    updateRequest,
    cancelRequest,
    storeReview,
    adminReview,
};
