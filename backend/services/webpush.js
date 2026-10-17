const webpush = require('web-push');
const supabase = require('../config/supabase');

/**
 * Web Push (VAPID) for PWA notifications.
 *
 * The browser subscribes with the public key and POSTs the subscription to
 * /api/push/subscribe. The backend stores it and later delivers with
 * web-push using the private key. Everything is best-effort: a dead
 * endpoint is unsubscribed silently so we never retry a gone subscription.
 */

const publicKey = process.env.VAPID_PUBLIC_KEY;
const privateKey = process.env.VAPID_PRIVATE_KEY;
const email = process.env.VAPID_EMAIL || 'mailto:admin@bisnoc.local';

const vapidConfigured = Boolean(publicKey && privateKey);
if (vapidConfigured) {
    webpush.setVapidDetails(email, publicKey, privateKey);
}

const publicVapidKey = publicKey || null;

/** Push payload delivered to the browser's service worker. */
const makePayload = ({ title, body, url = '/' }) =>
    JSON.stringify({
        title,
        body,
        url,
        icon: '/pwa-icon-192.png',
        data: { dateOfIssue: Date.now() },
    });

const options = {
    TTL: 86400, // 24 h — a teacher offline overnight still gets it next morning
    vapidDetails: { subject: email, publicKey, privateKey },
    headers: { Urgency: 'normal' },
};

/** Send one notification to one subscription. Resolves true/false. */
const sendPush = async (subscription, { title, body, url = '/' }) => {
    if (!vapidConfigured) {
        console.warn('[webpush] VAPID not configured — push skipped');
        return false;
    }
    try {
        await webpush.sendNotification(
            {
                endpoint: subscription.endpoint,
                keys: { p256: subscription.p256dh_key, auth: subscription.auth_key },
            },
            makePayload({ title, body, url }),
            options,
        );
        return true;
    } catch (error) {
        const status = error.statusCode;
        // 404 Gone / 410: the subscription is invalid — stop sending to it.
        if (status === 404 || status === 410) {
            try {
                await supabase
                    .from('push_subscriptions')
                    .delete()
                    .eq('endpoint', subscription.endpoint);
            } catch (deleteError) {
                console.warn('[webpush] could not drop dead subscription:', deleteError.message);
            }
        } else {
            console.warn('[webpush] push failed:', error.message);
        }
        return false;
    }
};

/** Every subscription for the given users. */
const subscriptionsForUsers = async (userIds) => {
    const ids = userIds.filter(Boolean);
    if (ids.length === 0) return [];
    const { data, error } = await supabase
        .from('push_subscriptions')
        .select('endpoint, p256dh_key, auth_key')
        .in('user_id', ids);
    if (error) throw error;
    return data || [];
};

/** How many active users in the school have push enabled. */
const subscribedUserCount = async (schoolId) => {
    const { data, error } = await supabase
        .from('push_subscriptions')
        .select('user_id, users!inner(school_id)')
        .eq('users.school_id', schoolId);
    if (error) throw error;
    const users = new Set((data || []).map((row) => row.user_id));
    return users.size;
};

module.exports = {
    webpush,
    sendPush,
    subscriptionsForUsers,
    subscribedUserCount,
    publicVapidKey,
    vapidConfigured,
};
