const crypto = require('crypto');

// Telegram recommends checking freshness; 24 hours (86400 s) is the
// industry-standard window — tight enough to block replays, loose enough
// not to reject legitimate users on slow connections.
const TELEGRAM_AUTH_MAX_AGE_MS = 24 * 60 * 60 * 1000; // 24 hours

/**
 * Verify the payload returned by the Telegram Login Widget.
 *
 * The widget posts `{ id, first_name, last_name, username, photo_url,
 * auth_date, hash }`. The `hash` is an HMAC-SHA256 over a data-check-string
 * (every field except `hash`, sorted by key, joined as `key=value` lines)
 * keyed by the SHA-256 of the bot token. We recompute it and compare. If the
 * signature is valid, `auth_date` freshness also guards against replay.
 *
 * @param {object} data Raw widget payload.
 * @param {string} botToken Telegram bot token (server-side secret).
 * @returns {{ telegramId: number, username: string|null, firstName: string,
 *            lastName: string|null }} Verified identity, or null when invalid.
 */
const verifyTelegramLogin = (data, botToken) => {
    if (!data || typeof data !== 'object') return null;
    if (!botToken) return null;

    const hash = data.hash;
    if (!hash || (typeof data.auth_date !== 'string' && typeof data.auth_date !== 'number')) {
        return null;
    }

    // Validate hash is exactly 64 lowercase hex chars before touching Buffers.
    if (!/^[0-9a-f]{64}$/.test(hash)) return null;

    const secretKey = crypto.createHash('sha256').update(botToken).digest();

    const dataCheckString = Object.keys(data)
        .filter((key) => key !== 'hash')
        .sort()
        .map((key) => `${key}=${data[key]}`)
        .join('\n');

    const hmac = crypto.createHmac('sha256', secretKey).update(dataCheckString).digest('hex');

    // Compare in constant time — the hash arrives over the wire.
    const a = Buffer.from(hmac, 'hex');
    const b = Buffer.from(hash, 'hex');
    if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
        return null;
    }

    const authDate = new Date(Number(data.auth_date) * 1000);
    if (Date.now() - authDate.getTime() > TELEGRAM_AUTH_MAX_AGE_MS) {
        return null;
    }

    // Telegram IDs are large integers; keep them as strings to avoid any
    // future precision loss when JS Number can no longer represent them exactly.
    return {
        telegramId: String(data.id),
        username: data.username ? String(data.username) : null,
        firstName: data.first_name ? String(data.first_name) : '',
        lastName: data.last_name ? String(data.last_name) : null,
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
    callTelegramApi,
    sendTelegramMessage,
    editMessageText,
    answerCallbackQuery,
    setWebhook,
    deleteWebhook,
    getMe,
};
