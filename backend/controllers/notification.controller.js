const supabase = require('../config/supabase');
const { NotFoundError, asyncHandler } = require('../utils/errors');

/**
 * The notification bell feed.
 *
 * Two streams are merged into one list for the signed-in user:
 *  - announcements: rows from `notices` addressed to 'all' or the caller's
 *    role, with the caller's read/acknowledge receipt joined in;
 *  - nudges: per-user rows from `notifications` written by the system when
 *    something happens (plan handed in, attendance submitted, ...).
 *
 * The `notifications` table arrives with migration 018; until it exists the
 * bell must keep working on announcements alone, so the nudge query
 * tolerates a missing table (42P01) and simply contributes nothing.
 */

const missingTable = (error) =>
    error?.code === '42P01' || /notifications.*does not exist/i.test(error?.message || '');

const NUDGE_SELECT = 'id, kind, title, body, link, read_at, created_at';
const NOTICE_SELECT = 'id, title, body, audience, requires_ack, is_pinned, posted_on, author:users!created_by(name)';

const shapeAnnouncement = (n, receipt = null) => ({
    id: n.id,
    type: 'announcement',
    title: n.title,
    body: n.body,
    link: null,
    createdAt: n.posted_on,
    readAt: receipt?.read_at ?? null,
    requiresAck: n.requires_ack,
    acknowledgedAt: receipt?.acknowledged_at ?? null,
    isPinned: n.is_pinned,
    author: n.author || null,
});

const shapeNudge = (n) => ({
    id: n.id,
    type: 'nudge',
    kind: n.kind,
    title: n.title,
    body: n.body,
    link: n.link,
    createdAt: n.created_at,
    readAt: n.read_at,
    requiresAck: false,
    acknowledgedAt: null,
    isPinned: false,
    author: null,
});

/**
 * GET /api/notifications
 * Latest items for the bell plus the unread badge count.
 */
const listNotifications = asyncHandler(async (req, res) => {
    // Announcements addressed to this user (same targeting as /api/notices).
    const { data: notices, error: noticesError } = await supabase
        .from('notices')
        .select(NOTICE_SELECT)
        .eq('school_id', req.user.school_id)
        .in('audience', ['all', req.user.role])
        .order('posted_on', { ascending: false })
        .limit(20);

    if (noticesError) throw noticesError;

    let receipts = [];
    if (notices.length > 0) {
        const { data, error } = await supabase
            .from('notice_receipts')
            .select('notice_id, read_at, acknowledged_at')
            .eq('user_id', req.user.id)
            .in('notice_id', notices.map((n) => n.id));

        if (error) throw error;
        receipts = data || [];
    }

    // Nudges aimed at this user specifically. Until migration 018 lands the
    // table does not exist — the bell then shows announcements only.
    let nudges = [];
    {
        const { data, error } = await supabase
            .from('notifications')
            .select(NUDGE_SELECT)
            .eq('user_id', req.user.id)
            .order('created_at', { ascending: false })
            .limit(20);

        if (error) {
            if (missingTable(error)) nudges = [];
            else throw error;
        } else {
            nudges = data || [];
        }
    }

    const byNotice = new Map(receipts.map((r) => [r.notice_id, r]));
    const feed = [
        ...notices.map((n) => shapeAnnouncement(n, byNotice.get(n.id))),
        ...nudges.map(shapeNudge),
    ].sort((a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || '')))
        .slice(0, 25);

    const unreadCount = feed.filter((item) => !item.readAt).length;

    res.json({ notifications: feed, unreadCount });
});

/**
 * POST /api/notifications/:id/read
 * Mark one bell nudge as read. (Announcements keep their own endpoint,
 * POST /api/notices/:id/read, so acknowledgement flows stay intact.)
 */
const markNotificationRead = asyncHandler(async (req, res) => {
    const { data, error } = await supabase
        .from('notifications')
        .update({ read_at: new Date().toISOString() })
        .eq('id', req.params.id)
        .eq('user_id', req.user.id)
        .select(NUDGE_SELECT)
        .maybeSingle();

    if (error) {
        // Pre-migration nothing can be read — report success quietly.
        if (missingTable(error)) return res.json({ receipt: { readAt: null } });
        throw error;
    }
    if (!data) throw new NotFoundError('Notification not found');

    res.json({ receipt: { readAt: data.read_at } });
});

module.exports = { listNotifications, markNotificationRead };
