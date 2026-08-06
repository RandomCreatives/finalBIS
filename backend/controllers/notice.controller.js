const supabase = require('../config/supabase');
const { NotFoundError, asyncHandler } = require('../utils/errors');

/**
 * Broadcast announcements with read receipts.
 *
 * A notice can be targeted at a role and can demand acknowledgement, so an
 * admin can see who has actually seen it rather than assuming.
 */

const SELECT = 'id, title, body, audience, requires_ack, is_pinned, posted_on, author:users!created_by(id, name)';

const shape = (n, receipt = null, stats = null) => ({
    id: n.id,
    title: n.title,
    body: n.body,
    audience: n.audience,
    requiresAck: n.requires_ack,
    isPinned: n.is_pinned,
    postedOn: n.posted_on,
    author: n.author || null,
    readAt: receipt?.read_at ?? null,
    acknowledgedAt: receipt?.acknowledged_at ?? null,
    ...(stats ? { stats } : {}),
});

/** GET /api/notices — those addressed to the caller. */
const listNotices = asyncHandler(async (req, res) => {
    const { data: notices, error } = await supabase
        .from('notices')
        .select(SELECT)
        .eq('school_id', req.user.school_id)
        .in('audience', ['all', req.user.role])
        .order('is_pinned', { ascending: false })
        .order('posted_on', { ascending: false });

    if (error) throw error;
    if (notices.length === 0) return res.json({ notices: [] });

    const { data: receipts, error: receiptError } = await supabase
        .from('notice_receipts')
        .select('notice_id, read_at, acknowledged_at')
        .eq('user_id', req.user.id)
        .in('notice_id', notices.map((n) => n.id));

    if (receiptError) throw receiptError;

    const byNotice = new Map(receipts.map((r) => [r.notice_id, r]));

    // Admins additionally see how far each notice has landed.
    let statsByNotice = new Map();
    if (req.user.role === 'admin') {
        const { data: allReceipts, error: allError } = await supabase
            .from('notice_receipts')
            .select('notice_id, acknowledged_at')
            .in('notice_id', notices.map((n) => n.id));

        if (allError) throw allError;

        const { count: audienceSize, error: countError } = await supabase
            .from('users')
            .select('id', { count: 'exact', head: true })
            .eq('school_id', req.user.school_id)
            .eq('is_active', true);

        if (countError) throw countError;

        statsByNotice = new Map(
            notices.map((n) => {
                const rows = allReceipts.filter((r) => r.notice_id === n.id);
                return [n.id, {
                    readCount: rows.length,
                    ackCount: rows.filter((r) => r.acknowledged_at).length,
                    audienceSize: audienceSize ?? 0,
                }];
            })
        );
    }

    res.json({
        notices: notices.map((n) => shape(n, byNotice.get(n.id), statsByNotice.get(n.id))),
    });
});

/** POST /api/notices */
const createNotice = asyncHandler(async (req, res) => {
    const { title, body, audience, requiresAck, isPinned } = req.body;

    const { data, error } = await supabase
        .from('notices')
        .insert({
            school_id: req.user.school_id,
            title,
            body,
            audience: audience ?? 'all',
            requires_ack: Boolean(requiresAck),
            is_pinned: Boolean(isPinned),
            created_by: req.user.id,
        })
        .select(SELECT)
        .single();

    if (error) throw error;
    res.status(201).json({ notice: shape(data) });
});

/** PATCH /api/notices/:id */
const updateNotice = asyncHandler(async (req, res) => {
    const map = {
        title: 'title', body: 'body', audience: 'audience',
        requiresAck: 'requires_ack', isPinned: 'is_pinned',
    };

    const patch = {};
    for (const [key, column] of Object.entries(map)) {
        if (req.body[key] !== undefined) patch[column] = req.body[key];
    }

    const { data, error } = await supabase
        .from('notices')
        .update(patch)
        .eq('id', req.params.id)
        .eq('school_id', req.user.school_id)
        .select(SELECT)
        .maybeSingle();

    if (error) throw error;
    if (!data) throw new NotFoundError('Notice not found');

    res.json({ notice: shape(data) });
});

/**
 * POST /api/notices/:id/read
 * Records a read, and an acknowledgement when asked for.
 */
const markRead = asyncHandler(async (req, res) => {
    const acknowledge = req.body.acknowledge === true;

    const { data, error } = await supabase
        .from('notice_receipts')
        .upsert(
            {
                notice_id: req.params.id,
                user_id: req.user.id,
                read_at: new Date().toISOString(),
                ...(acknowledge ? { acknowledged_at: new Date().toISOString() } : {}),
            },
            { onConflict: 'notice_id,user_id' }
        )
        .select()
        .single();

    if (error) throw error;

    res.json({ receipt: { readAt: data.read_at, acknowledgedAt: data.acknowledged_at } });
});

/** GET /api/notices/:id/receipts — who has seen it (admin). */
const getReceipts = asyncHandler(async (req, res) => {
    const { data: notice, error: noticeError } = await supabase
        .from('notices')
        .select('id, title, audience, requires_ack')
        .eq('id', req.params.id)
        .eq('school_id', req.user.school_id)
        .maybeSingle();

    if (noticeError) throw noticeError;
    if (!notice) throw new NotFoundError('Notice not found');

    let audienceQuery = supabase
        .from('users')
        .select('id, name, role')
        .eq('school_id', req.user.school_id)
        .eq('is_active', true);

    if (notice.audience !== 'all') audienceQuery = audienceQuery.eq('role', notice.audience);

    const [{ data: audience, error: audienceError }, { data: receipts, error: receiptError }] =
        await Promise.all([
            audienceQuery,
            supabase
                .from('notice_receipts')
                .select('user_id, read_at, acknowledged_at')
                .eq('notice_id', req.params.id),
        ]);

    if (audienceError) throw audienceError;
    if (receiptError) throw receiptError;

    const byUser = new Map(receipts.map((r) => [r.user_id, r]));

    res.json({
        notice: { id: notice.id, title: notice.title, requiresAck: notice.requires_ack },
        recipients: audience.map((u) => ({
            id: u.id,
            name: u.name,
            role: u.role,
            readAt: byUser.get(u.id)?.read_at ?? null,
            acknowledgedAt: byUser.get(u.id)?.acknowledged_at ?? null,
        })),
    });
});

/** DELETE /api/notices/:id */
const deleteNotice = asyncHandler(async (req, res) => {
    const { data, error } = await supabase
        .from('notices')
        .delete()
        .eq('id', req.params.id)
        .eq('school_id', req.user.school_id)
        .select()
        .maybeSingle();

    if (error) throw error;
    if (!data) throw new NotFoundError('Notice not found');

    res.json({ message: 'Notice deleted' });
});

module.exports = { listNotices, createNotice, updateNotice, markRead, getReceipts, deleteNotice };
