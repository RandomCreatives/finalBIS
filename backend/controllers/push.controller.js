const supabase = require('../config/supabase');
const { asyncHandler, BadRequestError } = require('../utils/errors');
const {
    sendPush,
    subscriptionsForUsers,
    subscribedUserCount,
    publicVapidKey,
    vapidConfigured,
} = require('../services/webpush');

const ROLES_WEB_PUSH = ['admin', 'main_teacher', 'assistant_teacher', 'subject_teacher'];

/** GET /api/push/config — public VAPID key so the browser can subscribe. */
const getConfig = asyncHandler(async (req, res) => {
    res.json({
        publicKey: publicVapidKey,
        enabled: vapidConfigured,
    });
});

/** GET /api/push/stats — how many users in this school have push enabled. */
const getStats = asyncHandler(async (req, res) => {
    const count = await subscribedUserCount(req.user.school_id);
    res.json({ subscribedUsers: count });
});

/** POST /api/push/subscribe — body { endpoint, keys: { p256dh, auth } } */
const subscribe = asyncHandler(async (req, res) => {
    const { endpoint, keys } = req.body || {};
    if (!endpoint || !keys || !keys.p256dh || !keys.auth) {
        throw new BadRequestError('endpoint and keys.p256dh/keys.auth are required');
    }
    const { error } = await supabase
        .from('push_subscriptions')
        .upsert(
            {
                user_id: req.user.id,
                endpoint,
                p256dh_key: keys.p256dh,
                auth_key: keys.auth,
                updated_at: new Date().toISOString(),
            },
            { onConflict: 'user_id, endpoint' },
        );
    if (error) throw error;
    res.json({ subscribed: true });
});

/** POST /api/push/unsubscribe — body { endpoint } */
const unsubscribe = asyncHandler(async (req, res) => {
    const { endpoint } = req.body || {};
    if (!endpoint) throw new BadRequestError('endpoint is required');
    await supabase
        .from('push_subscriptions')
        .delete()
        .eq('user_id', req.user.id)
        .eq('endpoint', endpoint);
    res.json({ subscribed: false });
});

/** POST /api/push/send — admin broadcast to role or explicit users. */
const send = asyncHandler(async (req, res) => {
    if (!vapidConfigured) {
        throw new BadRequestError('Push notifications are not configured on this server.');
    }
    const { title, body, url = '/', audience, userIds } = req.body || {};
    if (!title || !body) throw new BadRequestError('Title and body are required');

    let targets = userIds;
    if (!Array.isArray(targets) || targets.length === 0) {
        const roles = audience ? [audience] : ROLES_WEB_PUSH;
        const { data, error } = await supabase
            .from('users')
            .select('id')
            .eq('school_id', req.user.school_id)
            .eq('is_active', true)
            .in('role', roles);
        if (error) throw error;
        targets = (data || []).map((u) => u.id);
    }

    const subs = await subscriptionsForUsers(targets);
    const results = await Promise.allSettled(
        subs.map((s) =>
            sendPush(
                { endpoint: s.endpoint, p256dhKey: s.p256dh_key, authKey: s.auth_key },
                { title, body, url },
            ),
        ),
    );

    const sent = results.filter((r) => r.status === 'fulfilled' && r.value === true).length;
    const failed = results.length - sent;

    res.json({ sent, failed, total: results.length });
});

module.exports = { getConfig, getStats, subscribe, unsubscribe, send };
