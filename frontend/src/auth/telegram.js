import client from '../api/client';

/**
 * Telegram bot config shared by the login page and the Settings linking card.
 *
 * The backend is the single source of truth: GET /api/auth/telegram-config
 * reports whether the bot is configured and its public username. The old
 * build-time REACT_APP_TELEGRAM_BOT_USERNAME is kept only as an offline
 * fallback, so setting TELEGRAM_BOT_USERNAME on the server is now enough.
 */
const FALLBACK_BOT_USERNAME = process.env.REACT_APP_TELEGRAM_BOT_USERNAME || '';

let cachedPromise = null;

export const fetchTelegramConfig = () => {
    if (!cachedPromise) {
        cachedPromise = client
            .get('/auth/telegram-config')
            .then((res) => ({
                enabled: Boolean(res.data?.enabled && res.data?.botUsername),
                botUsername: res.data?.botUsername || '',
            }))
            .catch(() => ({
                enabled: Boolean(FALLBACK_BOT_USERNAME),
                botUsername: FALLBACK_BOT_USERNAME,
            }));
    }
    return cachedPromise;
};

/** Direct chat link for the school bot, e.g. https://t.me/bis_noc_bot. */
export const botChatUrl = (botUsername) =>
    botUsername ? `https://t.me/${botUsername.replace(/^@/, '')}` : null;
