/**
 * Telegram linking diagnostics — `GET /api/auth/telegram-link/diagnostics`
 *
 * Admin-only. Answers the three questions that decide whether linking can
 * work at all, in one response:
 *
 *   1. Is the bot configured, and which bot is it?
 *   2. Where does Telegram deliver its updates — this deployment, or another
 *      one (preview URL, old host, Render box)?
 *   3. Is the linking table provisioned, and does this deployment see the
 *      caller's own tokens?
 *
 * Nothing secret is returned: no bot token, no service key, and the database
 * reference is masked. The webhook URL is included because mis-registration
 * is the failure being diagnosed, and Telegram already hands it out through
 * `getWebhookInfo` to anyone holding the token.
 */
const env = require('../config/env');
const supabase = require('../config/supabase');
const { callTelegramApi } = require('../utils/telegram');
const { deploymentInfo, isPreviewHost } = require('../utils/deployment');
const { isLinkStorageReady, countTokensForUser } = require('../services/telegramLink');
const { asyncHandler } = require('../utils/errors');

/** getWebhookInfo changes rarely; cache it so the endpoint is safe to re-run. */
const WEBHOOK_TTL_MS = 30 * 1000;
let webhookCache = { at: 0, data: null };

const resetWebhookCache = () => {
    webhookCache = { at: 0, data: null };
};

const fetchWebhookInfo = async ({ now = Date.now(), force = false } = {}) => {
    if (!force && webhookCache.data && now - webhookCache.at < WEBHOOK_TTL_MS) return webhookCache.data;

    const res = await callTelegramApi('getWebhookInfo', {});
    const result = res?.ok ? res.result : null;

    const data = result
        ? {
            url: result.url || '',
            pendingUpdates: result.pending_update_count ?? 0,
            lastErrorDate: result.last_error_date ? new Date(result.last_error_date * 1000).toISOString() : null,
            lastErrorMessage: result.last_error_message || null,
            maxConnections: result.max_connections ?? null,
        }
        : null;

    // Only cache a real answer; a transport failure should be retried next time.
    if (data) webhookCache = { at: now, data };
    return data;
};

/** `https://host/path` -> `host`, tolerating an empty or malformed URL. */
const hostOfWebhook = (url) => {
    try {
        return new URL(url).host;
    } catch {
        return null;
    }
};

/**
 * A single pass/fail line with a plain-English explanation.
 *
 * `severity: 'warning'` marks a hardening item (e.g. no webhook secret) that
 * does not by itself stop linking; `blocker` marks anything that does.
 */
const check = (id, ok, detail, severity = 'blocker') => ({
    id,
    ok: Boolean(ok),
    severity,
    detail,
});

const diagnostics = asyncHandler(async (req, res) => {
    const where = deploymentInfo();
    const botConfigured = Boolean(env.telegram.botToken && env.telegram.botUsername);

    // ── bot identity (masked id — it is public, but the token never is) ───
    let bot = { configured: botConfigured, username: env.telegram.botUsername || null, id: null, reachable: null };
    if (botConfigured) {
        const me = await callTelegramApi('getMe', {});
        bot = {
            ...bot,
            reachable: Boolean(me?.ok),
            id: me?.ok && me.result?.id ? Number(me.result.id) : null,
            username: (me?.ok && me.result?.username) || bot.username,
        };
    }

    // ── webhook ──────────────────────────────────────────────────────────
    const webhookInfo = botConfigured ? await fetchWebhookInfo() : null;
    const webhookHost = hostOfWebhook(webhookInfo?.url);
    const webhookHere = Boolean(webhookHost && where.host && webhookHost.toLowerCase() === where.host.toLowerCase());

    const webhook = {
        configured: Boolean(webhookInfo?.url),
        url: webhookInfo?.url || null,
        host: webhookHost,
        pointsHere: webhookHere,
        preview: webhookHost ? isPreviewHost(webhookHost, { productionHost: where.host }) : null,
        pendingUpdates: webhookInfo?.pendingUpdates ?? null,
        lastErrorDate: webhookInfo?.lastErrorDate ?? null,
        lastErrorMessage: webhookInfo?.lastErrorMessage ?? null,
        secretConfigured: Boolean(env.telegram.webhookSecret),
    };

    // ── database ─────────────────────────────────────────────────────────
    let linkTableReady = false;
    let myTokens = { total: null, unused: null, lastUsedAt: null, lastCreatedAt: null };
    try {
        linkTableReady = await isLinkStorageReady();
        if (linkTableReady) myTokens = await countTokensForUser({ userId: req.user.id });
    } catch (err) {
        console.error('[telegram-diagnostics] database probe failed:', err.message);
    }

    const database = {
        ref: where.database,
        linkTableReady,
        telegramIdsLinked: null,
        myTokens,
    };

    // How many staff this database thinks are linked — a zero here while the
    // bot keeps saying "✅ Linked" is the signature of two databases.
    try {
        const { count, error } = await supabase
            .from('users')
            .select('id', { count: 'exact', head: true })
            .not('telegram_id', 'is', null);
        if (!error) database.telegramIdsLinked = count ?? 0;
    } catch {
        /* the count is a nicety, not a requirement */
    }

    const checks = [
        check('bot_configured', botConfigured,
            botConfigured ? `Bot @${bot.username} is configured.` : 'TELEGRAM_BOT_TOKEN / TELEGRAM_BOT_USERNAME are not set on this deployment.'),
        check('bot_reachable', bot.reachable,
            bot.reachable ? 'Telegram accepted the bot token.' : 'Telegram did not accept the token from this deployment.'),
        check('webhook_set', webhook.configured,
            webhook.configured ? `Telegram delivers updates to ${webhook.url}.` : 'No webhook is registered for this bot — /start never reaches a server.'),
        check('webhook_points_here', webhook.configured ? webhookHere : null,
            webhook.configured
                ? (webhookHere
                    ? 'The webhook points at this deployment — links made here are consumed here.'
                    : `The webhook points at ${webhookHost || 'another host'}, not ${where.host || 'this deployment'}. Links created here are consumed by that server instead, usually against a different database. Re-register it: node backend/scripts/set-telegram-webhook.js https://${where.host || '<prod-domain>'}/api/telegram/webhook`)
                : 'Cannot compare: no webhook is registered.'),
        check('webhook_not_preview', webhook.configured ? !webhook.preview : null,
            webhook.preview
                ? 'The webhook is registered on a preview/ephemeral URL. Preview deployments are deleted, so the bot will silently stop working (or keep writing to a stale database).'
                : 'The webhook is on a stable host.'),
        check('webhook_secret', webhook.secretConfigured,
            webhook.secretConfigured
                ? 'TELEGRAM_WEBHOOK_SECRET is set; the server only accepts updates carrying it (make sure it was registered with the webhook).'
                : 'TELEGRAM_WEBHOOK_SECRET is not set — anyone who learns the webhook URL could post updates. Recommended in production.',
            'warning'),
        check('link_table', linkTableReady,
            linkTableReady ? 'telegram_link_tokens exists.' : 'telegram_link_tokens is missing — apply supabase/migrations/031_telegram_link_tokens.sql.'),
        check('deployment_stable', !where.preview,
            where.preview ? 'This deployment looks like a preview/ephemeral host.' : 'This deployment is on a stable host.',
            'warning'),
    ];

    const blockers = checks.filter((c) => c.ok === false && c.severity === 'blocker');
    const warnings = checks.filter((c) => c.ok === false && c.severity === 'warning');

    res.json({
        // `ok` answers one question only: can linking work on this deployment?
        ok: blockers.length === 0,
        deployment: where,
        bot,
        webhook,
        database,
        checks,
        hint: blockers[0]?.detail
            || warnings[0]?.detail
            || 'Everything checks out on this deployment.',
        blockers: blockers.map((c) => c.id),
        warnings: warnings.map((c) => c.id),
        generatedAt: new Date().toISOString(),
    });
});

module.exports = { diagnostics, resetWebhookCache, fetchWebhookInfo };
