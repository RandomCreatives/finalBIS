/**
 * Registers the Telegram webhook for the bot, then prints exactly what
 * Telegram now believes.
 *
 * Usage:
 *   node scripts/set-telegram-webhook.js https://your-domain/api/telegram/webhook
 *   (or set TELEGRAM_WEBHOOK_URL in the environment)
 *
 * Preview/ephemeral hosts are refused unless --force is passed: a webhook
 * left pointing at a preview deployment is the classic cause of "the bot
 * says linked but sign-in says not linked" — the preview has its own
 * database, and it is deleted on the next push.
 *
 * The bot token and optional secret are read from the app config
 * (TELEGRAM_BOT_TOKEN / TELEGRAM_WEBHOOK_SECRET). When a secret is set,
 * Telegram signs every update with the X-Telegram-Bot-Api-Secret-Token
 * header, which the server verifies.
 */
const env = require('../config/env');
const { setWebhook, getMe, callTelegramApi } = require('../utils/telegram');
const { isPreviewHost, deploymentInfo } = require('../utils/deployment');

const FORCE = process.argv.includes('--force');
const url = process.argv.slice(2).find((a) => !a.startsWith('--')) || process.env.TELEGRAM_WEBHOOK_URL;

if (!url) {
    console.error(
        'Usage: node scripts/set-telegram-webhook.js <https://your-domain/api/telegram/webhook> [--force]\n' +
            '       (or set TELEGRAM_WEBHOOK_URL)'
    );
    process.exit(1);
}

// Refuse an obviously-throwaway host unless the operator insists.
const webhookHost = (() => {
    try {
        return new URL(url).host;
    } catch {
        return null;
    }
})();

if (!webhookHost || !/^https:\/\//i.test(url)) {
    console.error(`[set-webhook] "${url}" is not an https URL. Telegram only accepts https.`);
    process.exit(1);
}

const productionHost = process.env.VERCEL_PROJECT_PRODUCTION_URL || env.telegram.botUsername || null;
if (isPreviewHost(webhookHost, { productionHost: productionHost && productionHost.includes('.') ? productionHost : null }) && !FORCE) {
    console.error(
        `[set-webhook] Refusing to point the bot at "${webhookHost}": that looks like a preview/` +
            'ephemeral host.\n' +
            '             A webhook on a preview deployment writes links into that deployment\'s\n' +
            '             database, which then disappears — leaving staff "linked" on a server the\n' +
            '             site never reads.\n' +
            `             Use the production domain instead, or add --force to override.`
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
        if (!res?.ok) {
            console.error('[set-webhook] Telegram rejected the request:', JSON.stringify(res));
            process.exit(1);
        }

        console.log('Webhook set to:', url);
        console.log('Secret token:', env.telegram.webhookSecret ? 'enabled' : 'disabled');

        // Read it back: "Telegram said ok" is not the same as "Telegram is
        // delivering here now".
        const info = await callTelegramApi('getWebhookInfo', {});
        const live = info?.ok ? info.result : null;

        console.log('\nTelegram now reports:');
        console.log('  url                :', live?.url || '(none)');
        console.log('  pending updates    :', live?.pending_update_count ?? '?');
        console.log('  last error         :', live?.last_error_message || 'none');
        console.log('  this deployment    :', deploymentInfo().host || '(unknown host)');

        if (live?.url !== url) {
            console.error('\n[set-webhook] Telegram reports a different URL than the one just set.');
            process.exit(1);
        }
        if (live?.last_error_message) {
            console.error(
                '\n[set-webhook] Telegram recorded a delivery error. If it is a 401, the server\'s ' +
                    'TELEGRAM_WEBHOOK_SECRET does not match the one registered here (or is unset on the server).'
            );
            process.exit(1);
        }
        console.log('\nDeliveries are reaching this webhook with no recorded errors.');
    } catch (err) {
        console.error('[set-webhook] Failed:', err.message);
        process.exit(1);
    }
})();
