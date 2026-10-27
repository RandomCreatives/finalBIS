/**
 * Zero-dependency production-only Telegram webhook & command sync.
 *
 * Executed safely during Vercel Production builds (`VERCEL_ENV === 'production'`).
 * Skips silently in local dev, CI tests, and Vercel Preview builds so preview
 * deployments never overwrite the production webhook. Never fails a build.
 */
const DEFAULT_ORIGIN = 'https://final-bis.vercel.app';

function resolvePublicOrigin() {
    const raw = String(process.env.FRONTEND_URL || '').trim().replace(/\/+$/, '');
    if (!raw) return DEFAULT_ORIGIN;
    try {
        const parsed = new URL(raw);
        if (
            parsed.protocol === 'https:' &&
            parsed.hostname &&
            parsed.hostname !== 'localhost' &&
            parsed.hostname !== '127.0.0.1'
        ) {
            return `${parsed.origin}${parsed.pathname.replace(/\/+$/, '')}`;
        }
    } catch {
        /* use default */
    }
    return DEFAULT_ORIGIN;
}

(async () => {
    if (process.env.VERCEL_ENV !== 'production') return;
    const token = String(process.env.TELEGRAM_BOT_TOKEN || '').trim();
    if (!token) return;

    const origin = resolvePublicOrigin();
    const webhookUrl = `${origin}/api/telegram/webhook`;
    const secret = String(process.env.TELEGRAM_WEBHOOK_SECRET || '').trim();

    const call = async (method, payload) => {
        const res = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
        });
        return res.json();
    };

    try {
        const hookRes = await call('setWebhook', {
            url: webhookUrl,
            allowed_updates: ['message', 'edited_message', 'callback_query'],
            drop_pending_updates: false,
            ...(secret ? { secret_token: secret } : {}),
        });
        console.log('[telegram-prod-sync] setWebhook:', webhookUrl, hookRes?.ok ? 'ok' : hookRes?.description);

        const cmdRes = await call('setMyCommands', {
            commands: [
                { command: 'start', description: 'Open your BIS NOC home menu' },
                { command: 'menu', description: 'Show quick actions & classes' },
                { command: 'today', description: "Today's timetable & tasks" },
                { command: 'classes', description: 'Your classes & pupils' },
                { command: 'notices', description: 'School notices & receipts' },
            ],
        });
        console.log('[telegram-prod-sync] setMyCommands:', cmdRes?.ok ? 'ok' : cmdRes?.description);
    } catch (err) {
        console.warn('[telegram-prod-sync] skipped:', err.message);
    }
})();
