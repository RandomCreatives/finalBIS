const crypto = require('crypto');

const TELEGRAM_AUTH_MAX_AGE_MS = 5 * 60 * 1000; // 5 minutes, as Telegram recommends

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
    if (!hash || typeof data.auth_date !== 'string' && typeof data.auth_date !== 'number') {
        return null;
    }

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

    return {
        telegramId: Number(data.id),
        username: data.username ? String(data.username) : null,
        firstName: data.first_name ? String(data.first_name) : '',
        lastName: data.last_name ? String(data.last_name) : null,
    };
};

/**
 * Send a plain-text message to a chat/user via the Telegram Bot API.
 * Returns the parsed API response, or null on failure.
 */
const sendTelegramMessage = async (chatId, text) => {
    const env = require('../config/env');
    const token = env.telegram.botToken;
    if (!token) return null;

    try {
        const response = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ chat_id: chatId, text }),
        });
        return await response.json();
    } catch (err) {
        console.error('[telegram] sendMessage failed:', err.message);
        return null;
    }
};

module.exports = { verifyTelegramLogin, sendTelegramMessage };
