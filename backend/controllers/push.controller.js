const crypto = require('crypto');
const supabase = require('../config/supabase');
const { asyncHandler, BadRequestError } = require('../utils/errors');
const { notify } = require('../utils/nudges');
const { sendTelegramMessage, publicWebOrigin } = require('../utils/telegram');
const {
    sendPush,
    subscriptionsForUsers,
    subscribedUserCount,
    publicVapidKey,
    vapidConfigured,
} = require('../services/webpush');

const ROLES_WEB_PUSH = ['admin', 'main_teacher', 'assistant_teacher', 'subject_teacher'];

const normalizeTargetPath = (rawUrl) => {
    const trimmed = String(rawUrl || '').trim();
    if (!trimmed) return '/app';
    if (trimmed.startsWith('/')) return trimmed;
    try {
        const parsed = new URL(trimmed);
        return `${parsed.pathname}${parsed.search}${parsed.hash}` || '/app';
    } catch {
        return `/${trimmed}`;
    }
};

/** GET /api/push/config — public VAPID key so the browser can subscribe. */
const getConfig = asyncHandler(async (req, res) => {
    res.json({
        publicKey: publicVapidKey,
        enabled: vapidConfigured,
    });
});

/** GET /api/push/stats — channel readiness & subscribed recipient counts for this school. */
const getStats = asyncHandler(async (req, res) => {
    const [subscribedUsers, staffRes] = await Promise.all([
        subscribedUserCount(req.user.school_id),
        supabase
            .from('users')
            .select('id, telegram_id')
            .eq('school_id', req.user.school_id)
            .eq('is_active', true)
            .in('role', ROLES_WEB_PUSH),
    ]);
    if (staffRes.error) throw staffRes.error;

    const activeStaff = staffRes.data || [];
    const telegramLinkedUsers = activeStaff.filter(
        (u) => u.telegram_id !== null && u.telegram_id !== undefined && String(u.telegram_id).trim() !== '',
    ).length;

    res.json({
        subscribedUsers,
        webPushEnabled: vapidConfigured,
        telegramLinkedUsers,
        activeStaffUsers: activeStaff.length,
    });
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

/** POST|DELETE /api/push/unsubscribe — body { endpoint } */
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

/**
 * POST /api/push/send — admin broadcast across:
 *   1. In-app notification bell (`notifications`)
 *   2. Telegram (`@bisnocbot`) for linked staff
 *   3. Browser / PWA Web Push (when VAPID keys + device subscriptions exist)
 */
const send = asyncHandler(async (req, res) => {
    const { title, body, url = '/app', audience, userIds } = req.body || {};
    const cleanTitle = String(title || '').trim();
    const cleanBody = String(body || '').trim();
    if (!cleanTitle || !cleanBody) throw new BadRequestError('Title and body are required');

    const targetPath = normalizeTargetPath(url);

    let recipientQuery = supabase
        .from('users')
        .select('id, role, telegram_id')
        .eq('school_id', req.user.school_id)
        .eq('is_active', true);

    if (Array.isArray(userIds) && userIds.length > 0) {
        recipientQuery = recipientQuery.in('id', userIds);
    } else {
        const roles = audience && audience !== 'all' ? [audience] : ROLES_WEB_PUSH;
        recipientQuery = recipientQuery.in('role', roles);
    }

    const { data: recipientsData, error } = await recipientQuery;
    if (error) throw error;

    const recipients = recipientsData || [];
    const targetIds = recipients.map((u) => u.id);

    // 1. In-app bell notification
    const dedupeKey = `broadcast:${crypto.randomUUID()}`;
    const inAppIds = await notify({
        schoolId: req.user.school_id,
        userIds: targetIds,
        kind: 'broadcast',
        title: cleanTitle,
        body: cleanBody,
        link: targetPath,
        dedupeKey,
    });
    const inAppSent = inAppIds.length;

    // 2. Telegram (@bisnocbot) push for linked staff
    const origin = publicWebOrigin();
    const telegramRecipients = recipients.filter(
        (u) => u.telegram_id !== null && u.telegram_id !== undefined && String(u.telegram_id).trim() !== '',
    );
    const tgText = `📢 Office Broadcast\n\n${cleanTitle}\n\n${cleanBody}`;
    const tgResults = await Promise.allSettled(
        telegramRecipients.map((u) => {
            const webLink =
                targetPath === '/app' && u.role === 'subject_teacher'
                    ? `${origin}/subject-home`
                    : `${origin}${targetPath}`;
            return sendTelegramMessage(u.telegram_id, tgText, {
                replyMarkup: {
                    inline_keyboard: [
                        [
                            { text: '🌐 Mini App', web_app: { url: `${origin}/tma/` }, style: 'primary' },
                            { text: '🌐 Open Web', url: webLink },
                        ],
                        [{ text: '🏠 Menu', callback_data: 'menu' }],
                    ],
                },
            });
        }),
    );
    const telegramSent = tgResults.filter(
        (r) => r.status === 'fulfilled' && r.value && r.value.ok !== false,
    ).length;
    const telegramFailed = telegramRecipients.length - telegramSent;

    // 3. Browser / PWA Web Push (when VAPID is configured)
    let webPushSent = 0;
    let webPushFailed = 0;
    if (vapidConfigured && targetIds.length > 0) {
        const subs = await subscriptionsForUsers(targetIds);
        const pushResults = await Promise.allSettled(
            subs.map((s) =>
                sendPush(
                    { endpoint: s.endpoint, p256dhKey: s.p256dh_key, authKey: s.auth_key },
                    { title: cleanTitle, body: cleanBody, url: targetPath },
                ),
            ),
        );
        webPushSent = pushResults.filter((r) => r.status === 'fulfilled' && r.value === true).length;
        webPushFailed = pushResults.length - webPushSent;
    }

    const sent = telegramSent + webPushSent + inAppSent;
    const failed = telegramFailed + webPushFailed;

    res.json({
        sent,
        failed,
        total: sent + failed,
        telegramSent,
        webPushSent,
        inAppSent,
    });
});

module.exports = { getConfig, getStats, subscribe, unsubscribe, send };
