/**
 * Zero-dependency production-only Telegram webhook, Mini App menu button,
 * `/` commands, and bot profile crest sync.
 *
 * Executed safely during Vercel Production builds (`VERCEL_ENV === 'production'`).
 * Skips silently in local dev, CI tests, and Vercel Preview builds so preview
 * deployments never overwrite the production webhook. Never fails a build.
 */
const fs = require('fs');
const path = require('path');

const DEFAULT_ORIGIN = 'https://bis-gerji-primary2.vercel.app';
const LEGACY_HOSTS = new Set(['final-bis.vercel.app', 'localhost', '127.0.0.1']);

function resolvePublicOrigin() {
    const raw = String(process.env.FRONTEND_URL || '').trim().replace(/\/+$/, '');
    if (!raw) return DEFAULT_ORIGIN;
    try {
        const parsed = new URL(raw);
        if (
            parsed.protocol === 'https:' &&
            parsed.hostname &&
            !LEGACY_HOSTS.has(parsed.hostname.toLowerCase())
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
    const miniAppUrl = `${origin}/tma/`;
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

        const menuBtnRes = await call('setChatMenuButton', {
            menu_button: {
                type: 'web_app',
                text: 'Open App',
                web_app: { url: miniAppUrl },
            },
        });
        console.log('[telegram-prod-sync] setChatMenuButton:', miniAppUrl, menuBtnRes?.ok ? 'ok' : menuBtnRes?.description);

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

        // Set the official BIS NOC crest avatar if @bisnocbot has no profile photo yet.
        const iconPath = path.join(__dirname, '..', '..', 'frontend', 'public', 'pwa-icon-512.png');
        if (fs.existsSync(iconPath) && typeof FormData !== 'undefined' && typeof Blob !== 'undefined') {
            const me = await call('getMe', {});
            if (me?.ok && me.result?.id) {
                const photos = await call('getUserProfilePhotos', { user_id: me.result.id, limit: 1 });
                if (photos?.ok && photos.result?.total_count === 0) {
                    const buf = fs.readFileSync(iconPath);
                    const form = new FormData();
                    form.append('photo', JSON.stringify({ type: 'static', photo: 'attach://bis_crest' }));
                    form.append('bis_crest', new Blob([buf], { type: 'image/png' }), 'bis-crest.png');
                    const photoRes = await fetch(`https://api.telegram.org/bot${token}/setMyProfilePhoto`, {
                        method: 'POST',
                        body: form,
                    }).then((r) => r.json());
                    console.log('[telegram-prod-sync] setMyProfilePhoto:', photoRes?.ok ? 'ok' : photoRes?.description);
                }
            }
        }
    } catch (err) {
        console.warn('[telegram-prod-sync] skipped:', err.message);
    }
})();
