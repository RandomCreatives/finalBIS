const crypto = require('crypto');

// Telegram recommends checking freshness; 24 hours (86400 s) is the
// industry-standard window — tight enough to block replays, loose enough
// not to reject legitimate users on slow connections.
const TELEGRAM_AUTH_MAX_AGE_MS = 24 * 60 * 60 * 1000; // 24 hours

// Allow a little clock drift between Telegram's servers and ours, but reject
// `auth_date` values that are meaningfully in the future (a forged/rolled-back
// clock must not buy an unlimited validity window).
const TELEGRAM_AUTH_MAX_FUTURE_SKEW_MS = 5 * 60 * 1000; // 5 minutes

// Telegram's initData is normally a few hundred bytes. Cap it so a hostile
// caller cannot make us parse an unbounded query string.
const TELEGRAM_INIT_DATA_MAX_LENGTH = 8192;

// The documented sentinel used to derive the Mini App secret key. It is a
// public constant, not a secret.
const WEBAPP_DATA_KEY = 'WebAppData';

/**
 * Constant-time comparison of two lowercase hex digests. Returns false for
 * anything that is not exactly 64 lowercase hex characters, so malformed
 * input never reaches `timingSafeEqual` (which throws on length mismatch).
 */
const timingSafeEqualHex = (expectedHex, receivedHex) => {
    if (typeof expectedHex !== 'string' || typeof receivedHex !== 'string') return false;
    if (!/^[0-9a-f]{64}$/.test(expectedHex) || !/^[0-9a-f]{64}$/.test(receivedHex)) return false;
    const a = Buffer.from(expectedHex, 'hex');
    const b = Buffer.from(receivedHex, 'hex');
    return a.length === b.length && crypto.timingSafeEqual(a, b);
};

/**
 * Build Telegram's bot-token data-check-string: every received field except
 * `hash`, sorted by key, formatted `key=value`, joined by '\n'.
 *
 * `signature` (the newer Ed25519 proof for third parties) is deliberately
 * KEPT: Telegram hashes every received field except `hash`, so dropping
 * `signature` would reject every real launch from a modern client. Only the
 * separate third-party Ed25519 check excludes both `hash` and `signature`.
 * @see https://core.telegram.org/bots/webapps#validating-data-received-via-the-mini-app
 */
const buildDataCheckString = (entries) =>
    entries
        .filter(([key]) => key !== 'hash')
        .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
        .map(([key, value]) => `${key}=${value}`)
        .join('\n');

/**
 * Validate `auth_date` (a Unix timestamp in seconds) against both the maximum
 * age and a small future-skew allowance. Accepts numbers or decimal strings,
 * rejects anything else (NaN, arrays, objects, empty strings, floats).
 */
const isAuthDateFresh = (
    value,
    { now = Date.now(), maxAgeMs = TELEGRAM_AUTH_MAX_AGE_MS, maxFutureSkewMs = TELEGRAM_AUTH_MAX_FUTURE_SKEW_MS } = {},
) => {
    let raw;
    if (typeof value === 'number') raw = String(value);
    else if (typeof value === 'string') raw = value;
    else return false;

    if (!/^\d{1,12}$/.test(raw)) return false;

    const seconds = Number(raw);
    if (!Number.isSafeInteger(seconds) || seconds <= 0) return false;

    const timestampMs = seconds * 1000;
    if (timestampMs - now > maxFutureSkewMs) return false; // from the future
    if (now - timestampMs > maxAgeMs) return false; // stale
    return true;
};

/**
 * Verify the payload returned by the Telegram Login Widget.
 *
 * The widget posts `{ id, first_name, last_name, username, photo_url,
 * auth_date, hash }`. The `hash` is an HMAC-SHA256 over a data-check-string
 * (every field except `hash`, sorted by key, joined as `key=value` lines)
 * keyed by the SHA-256 of the bot token (Login Widget algorithm). We
 * recompute it and compare. If the signature is valid, `auth_date` freshness
 * also guards against replay.
 *
 * @param {object} data Raw widget payload.
 * @param {string} botToken Telegram bot token (server-side secret).
 * @param {{ now?: number, maxAgeMs?: number }} [opts] Test hooks.
 * @returns {{ telegramId: string, username: string|null, firstName: string,
 *            lastName: string|null, authDate: number }} Verified identity, or null when invalid.
 */
const verifyTelegramLogin = (data, botToken, opts = {}) => {
    if (!data || typeof data !== 'object') return null;
    if (!botToken) return null;

    const hash = data.hash;
    if (typeof hash !== 'string') return null;

    // Validate hash is exactly 64 lowercase hex chars before touching Buffers.
    if (!/^[0-9a-f]{64}$/.test(hash)) return null;

    if (!isAuthDateFresh(data.auth_date, { now: opts.now, maxAgeMs: opts.maxAgeMs })) return null;

    const secretKey = crypto.createHash('sha256').update(botToken).digest();

    const dataCheckString = buildDataCheckString(
        Object.keys(data).map((key) => [key, String(data[key])]),
    );

    const hmac = crypto.createHmac('sha256', secretKey).update(dataCheckString).digest('hex');

    // Compare in constant time — the hash arrives over the wire.
    if (!timingSafeEqualHex(hmac, hash)) return null;

    const authDate = Number(data.auth_date);

    // Telegram IDs are large integers; keep them as strings to avoid any
    // future precision loss when JS Number can no longer represent them exactly.
    return {
        telegramId: String(data.id),
        username: data.username ? String(data.username) : null,
        firstName: data.first_name ? String(data.first_name) : '',
        lastName: data.last_name ? String(data.last_name) : null,
        authDate,
    };
};

/**
 * Verify the `initData` payload of a Telegram Mini App (Web App), following
 * https://core.telegram.org/bots/webapps#validating-data-received-via-the-mini-app
 *
 *   secret_key        = HMAC_SHA256(key="WebAppData", message=<bot_token>)
 *   data_check_string = all fields except `hash` (including `signature`, if
 *                       the client sent one), sorted by key, as `key=value`,
 *                       joined by "\n"
 *   hash              = hex(HMAC_SHA256(key=secret_key, message=data_check_string))
 *
 * Note this is NOT the Login Widget algorithm: the widget hashes the bot token
 * directly (secret = SHA256(bot_token)), while a Mini App derives the secret
 * with the "WebAppData" HMAC key. Using the widget scheme here rejects every
 * genuine Mini App launch, so the two paths are kept separate.
 *
 * The bot token never leaves the server: callers pass `init_data` from the
 * client and the token comes from server-side configuration.
 *
 * @param {string} initData Raw `Telegram.WebApp.initData` query string.
 * @param {string} botToken Telegram bot token (server-side secret).
 * @param {{ now?: number, maxAgeMs?: number, maxFutureSkewMs?: number }} [opts]
 * @returns {{ telegramId: string, username: string|null, firstName: string,
 *             lastName: string|null, languageCode: string|null,
 *             authDate: number, queryId: string|null, startParam: string|null }|null}
 */
const verifyTelegramInitData = (initData, botToken, opts = {}) => {
    if (typeof initData !== 'string' || initData.length === 0) return null;
    if (initData.length > TELEGRAM_INIT_DATA_MAX_LENGTH) return null;
    if (!botToken) return null;

    let params;
    try {
        params = new URLSearchParams(initData);
    } catch {
        return null;
    }

    // Telegram sends each field once. Duplicate keys are ambiguous (which one
    // did the client display vs. which one did we verify?) — refuse them.
    const entries = [...params.entries()];
    if (new Set(entries.map(([key]) => key)).size !== entries.length) return null;

    const hash = params.get('hash');
    if (!hash || !/^[0-9a-f]{64}$/.test(hash)) return null;

    const authDateRaw = params.get('auth_date');
    if (!authDateRaw || !/^\d{1,12}$/.test(authDateRaw)) return null;

    // Verify the signature first, then freshness, then parse the user.
    const secretKey = crypto
        .createHmac('sha256', WEBAPP_DATA_KEY)
        .update(botToken)
        .digest();

    const dataCheckString = buildDataCheckString(entries);
    const expected = crypto.createHmac('sha256', secretKey).update(dataCheckString).digest('hex');

    if (!timingSafeEqualHex(expected, hash)) return null;

    if (
        !isAuthDateFresh(authDateRaw, {
            now: opts.now,
            maxAgeMs: opts.maxAgeMs,
            maxFutureSkewMs: opts.maxFutureSkewMs,
        })
    ) {
        return null;
    }

    let user;
    try {
        user = JSON.parse(params.get('user') || '');
    } catch {
        return null;
    }
    if (!user || typeof user !== 'object' || Array.isArray(user)) return null;
    if (!Number.isSafeInteger(user.id) || user.id <= 0) return null;

    return {
        telegramId: String(user.id),
        username: user.username ? String(user.username) : null,
        firstName: user.first_name ? String(user.first_name) : '',
        lastName: user.last_name ? String(user.last_name) : null,
        languageCode: user.language_code ? String(user.language_code) : null,
        authDate: Number(authDateRaw),
        queryId: params.get('query_id') || null,
        startParam: params.get('start_param') || null,
    };
};

/**
 * Low-level caller for any Telegram Bot API method.
 * Returns the parsed JSON response, or null on transport failure.
 */
const callTelegramApi = async (method, payload = {}) => {
    const env = require('../config/env');
    const token = env.telegram.botToken;
    if (!token) return null;

    try {
        const response = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
        });
        return await response.json();
    } catch (err) {
        console.error(`[telegram] ${method} failed:`, err.message);
        return null;
    }
};

/**
 * Send a message. `opts.replyMarkup` is a Telegram reply_markup object
 * (e.g. an inline keyboard); `opts.parseMode` is optional.
 */
const sendTelegramMessage = async (chatId, text, opts = {}) => {
    return callTelegramApi('sendMessage', {
        chat_id: chatId,
        text,
        ...(opts.parseMode ? { parse_mode: opts.parseMode } : {}),
        ...(opts.replyMarkup ? { reply_markup: opts.replyMarkup } : {}),
    });
};

/** Edit an existing message's text and/or keyboard. */
const editMessageText = async (chatId, messageId, text, opts = {}) => {
    return callTelegramApi('editMessageText', {
        chat_id: chatId,
        message_id: messageId,
        text,
        ...(opts.parseMode ? { parse_mode: opts.parseMode } : {}),
        ...(opts.replyMarkup ? { reply_markup: opts.replyMarkup } : {}),
    });
};

/** Acknowledge a callback query (shows a toast / alert to the user). */
const answerCallbackQuery = async (callbackQueryId, opts = {}) => {
    return callTelegramApi('answerCallbackQuery', {
        callback_query_id: callbackQueryId,
        ...(opts.text ? { text: opts.text } : {}),
        ...(opts.showAlert ? { show_alert: true } : {}),
    });
};

/** Register the webhook. `secret` sets the X-Telegram-Bot-Api-Secret-Token header. */
const setWebhook = (url, secret) => {
    return callTelegramApi('setWebhook', {
        url,
        allowed_updates: ['message', 'callback_query'],
        drop_pending_updates: true,
        ...(secret ? { secret_token: secret } : {}),
    });
};

const deleteWebhook = () => callTelegramApi('deleteWebhook', { drop_pending_updates: true });

const getMe = () => callTelegramApi('getMe', {});

module.exports = {
    verifyTelegramLogin,
    verifyTelegramInitData,
    isAuthDateFresh,
    buildDataCheckString,
    TELEGRAM_AUTH_MAX_AGE_MS,
    TELEGRAM_AUTH_MAX_FUTURE_SKEW_MS,
    TELEGRAM_INIT_DATA_MAX_LENGTH,
    callTelegramApi,
    sendTelegramMessage,
    editMessageText,
    answerCallbackQuery,
    setWebhook,
    deleteWebhook,
    getMe,
};
