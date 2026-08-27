/**
 * Registers the Telegram webhook for the bot.
 *
 * Usage:
 *   node scripts/set-telegram-webhook.js https://your-domain/api/telegram/webhook
 *   (or set TELEGRAM_WEBHOOK_URL in the environment)
 *
 * The bot token and optional secret are read from the app config
 * (TELEGRAM_BOT_TOKEN / TELEGRAM_WEBHOOK_SECRET). When a secret is set,
 * Telegram signs every update with the X-Telegram-Bot-Api-Secret-Token
 * header, which the server verifies.
 */
const env = require('../config/env');
const { setWebhook, getMe } = require('../utils/telegram');

const url = process.argv[2] || process.env.TELEGRAM_WEBHOOK_URL;

if (!url) {
    console.error(
        'Usage: node scripts/set-telegram-webhook.js <https://your-domain/api/telegram/webhook>\n' +
            '       (or set TELEGRAM_WEBHOOK_URL)'
    );
    process.exit(1);
}

(async () => {
    try {
        const me = await getMe();
        if (!me?.result?.username) {
            console.error('[set-webhook] Could not authenticate with Telegram. Check TELEGRAM_BOT_TOKEN.');
            process.exit(1);
        }
        console.log('Bot:', `@${me.result.username}`);

        const res = await setWebhook(url, env.telegram.webhookSecret || undefined);
        if (res?.ok) {
            console.log('Webhook set to:', url);
            console.log('Secret token:', env.telegram.webhookSecret ? 'enabled' : 'disabled');
        } else {
            console.error('[set-webhook] Telegram rejected the request:', JSON.stringify(res));
            process.exit(1);
        }
    } catch (err) {
        console.error('[set-webhook] Failed:', err.message);
        process.exit(1);
    }
})();
