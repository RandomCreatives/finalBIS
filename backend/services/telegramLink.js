/**
 * One-time Telegram account linking.
 *
 * A signed-in staff member asks for a link; we mint a high-entropy token,
 * store only its SHA-256 hash with a 10-minute TTL, and hand back a
 * `https://t.me/<bot>?start=link_<token>` deep link. Opening it in the bot
 * consumes the token exactly once and binds the Telegram identity to the
 * staff member's existing account.
 *
 * Rejected on purpose:
 *   - unknown / malformed tokens
 *   - expired tokens
 *   - tokens that were already consumed
 *   - deactivated staff accounts
 *   - staff accounts already bound to a different Telegram account
 *   - Telegram accounts already bound to a different staff member
 *
 * The raw token never touches the database or the logs. Consumption is an
 * atomic conditional UPDATE (used_at IS NULL AND expires_at > now), so two
 * simultaneous /start presses cannot both succeed.
 */
const crypto = require('crypto');
const supabase = require('../config/supabase');

/** How long a link stays usable. Deliberately short — it is a bearer token. */
const LINK_TOKEN_TTL_MS = 10 * 60 * 1000;

/** 32 random bytes -> 43 base64url characters. */
const LINK_TOKEN_BYTES = 32;
const LINK_TOKEN_PATTERN = /^[A-Za-z0-9_-]{43}$/;

/** Deep-link payload prefix Telegram echoes back as the /start argument. */
const LINK_PAYLOAD_PREFIX = 'link_';

/** Telegram user ids are positive integers; keep them as strings end to end. */
const TELEGRAM_ID_PATTERN = /^[1-9]\d{0,18}$/;

/** Cryptographically random, URL-safe link token. */
const generateLinkToken = () => {
    const token = crypto.randomBytes(LINK_TOKEN_BYTES).toString('base64url');
    return { token, tokenHash: hashLinkToken(token) };
};

/** SHA-256 hex — the only form of the token that is ever persisted. */
const hashLinkToken = (token) => crypto.createHash('sha256').update(String(token)).digest('hex');

/**
 * Normalise a Telegram user id to a canonical decimal string, or null when
 * it is missing, non-numeric, zero, or unsafe to represent as a JS number.
 */
const normalizeTelegramId = (value) => {
    if (typeof value === 'number') {
        if (!Number.isSafeInteger(value) || value <= 0) return null;
        return String(value);
    }
    if (typeof value === 'bigint') {
        return value > 0n ? value.toString() : null;
    }
    if (typeof value !== 'string') return null;
    if (!TELEGRAM_ID_PATTERN.test(value)) return null;
    return value;
};

const isValidLinkToken = (token) => typeof token === 'string' && LINK_TOKEN_PATTERN.test(token);

/** Build the t.me deep link that opens the bot with the link payload. */
const buildDeepLink = (botUsername, token) => {
    const handle = String(botUsername || '').replace(/^@/, '');
    if (!handle || !isValidLinkToken(token)) return null;
    return `https://t.me/${handle}?start=${LINK_PAYLOAD_PREFIX}${token}`;
};

/** Telegram usernames are optional and changeable; keep them informational. */
const normalizeUsername = (value) => {
    if (typeof value !== 'string') return null;
    const trimmed = value.trim().replace(/^@/, '');
    if (!trimmed || trimmed.length > 64) return null;
    return trimmed;
};

const isActive = (user) => user?.is_active === true || user?.is_active === 'true';

/**
 * MINT — issue a fresh one-time link for a staff account.
 *
 * Any outstanding token for that account is deleted first, so exactly one
 * link is live at a time (a re-request kills the previous link).
 *
 * @returns {Promise<{ok: true, token: string, expiresAt: Date}
 *                   | {ok: false, code: 'not_found'|'inactive'|'already_linked'}>}
 */
const createLinkToken = async ({ userId, now = new Date() }) => {
    const { data: user, error } = await supabase
        .from('users')
        .select('id, is_active, telegram_id')
        .eq('id', userId)
        .maybeSingle();

    if (error) throw error;
    if (!user) return { ok: false, code: 'not_found' };
    if (!isActive(user)) return { ok: false, code: 'inactive' };
    if (user.telegram_id !== null && user.telegram_id !== undefined) {
        return { ok: false, code: 'already_linked' };
    }

    // One live link per account: retire anything still outstanding.
    const { error: purgeError } = await supabase
        .from('telegram_link_tokens')
        .delete()
        .eq('user_id', userId)
        .is('used_at', null);
    if (purgeError) throw purgeError;

    const { token, tokenHash } = generateLinkToken();
    const expiresAt = new Date(now.getTime() + LINK_TOKEN_TTL_MS);

    const { error: insertError } = await supabase.from('telegram_link_tokens').insert({
        user_id: userId,
        token_hash: tokenHash,
        expires_at: expiresAt.toISOString(),
        created_at: now.toISOString(),
    });
    if (insertError) throw insertError;

    return { ok: true, token, expiresAt };
};

/**
 * STATUS — poll a link the caller minted. Scoped to `userId`, so one staff
 * member can never inspect another member's token.
 *
 * @returns {Promise<{status: 'invalid'|'expired'|'used'|'pending',
 *                    expiresAt?: string}>}
 */
const getLinkStatus = async ({ userId, token, now = new Date() }) => {
    if (!isValidLinkToken(token)) return { status: 'invalid' };

    const { data: row, error } = await supabase
        .from('telegram_link_tokens')
        .select('expires_at, used_at')
        .eq('token_hash', hashLinkToken(token))
        .eq('user_id', userId)
        .maybeSingle();

    if (error) throw error;
    if (!row) return { status: 'invalid' };
    if (row.used_at) return { status: 'used' };
    if (new Date(row.expires_at).getTime() <= now.getTime()) return { status: 'expired' };

    return { status: 'pending', expiresAt: row.expires_at };
};

/**
 * CONSUME — bind a Telegram identity to the staff account behind a token.
 * Called only from the bot, with the identity Telegram itself delivered.
 *
 * @param {object} args
 * @param {string} args.token Raw token from the /start payload.
 * @param {string|number} args.telegramId Telegram user id of the sender.
 * @param {string|null} [args.username]
 * @param {Date} [args.now] Test hook.
 * @returns {Promise<{ok: true, code: 'linked', user: object}
 *                   | {ok: false, code: 'invalid'|'expired'|'used'|'inactive'
 *                                      |'account_already_linked'|'telegram_already_linked'}>}
 */
const consumeLinkToken = async ({ token, telegramId, username = null, now = new Date() }) => {
    const telegramIdString = normalizeTelegramId(telegramId);
    if (!isValidLinkToken(token) || !telegramIdString) return { ok: false, code: 'invalid' };

    const tokenHash = hashLinkToken(token);

    const { data: row, error: lookupError } = await supabase
        .from('telegram_link_tokens')
        .select('id, user_id, expires_at, used_at')
        .eq('token_hash', tokenHash)
        .maybeSingle();

    if (lookupError) throw lookupError;
    if (!row) return { ok: false, code: 'invalid' };
    if (row.used_at) return { ok: false, code: 'used' };
    if (new Date(row.expires_at).getTime() <= now.getTime()) return { ok: false, code: 'expired' };

    const { data: user, error: userError } = await supabase
        .from('users')
        .select('id, school_id, name, is_active, telegram_id')
        .eq('id', row.user_id)
        .maybeSingle();

    if (userError) throw userError;
    if (!user) return { ok: false, code: 'invalid' };
    if (!isActive(user)) return { ok: false, code: 'inactive' };

    // The staff account can only be bound to one Telegram account.
    const alreadyBound = user.telegram_id !== null && user.telegram_id !== undefined;
    if (alreadyBound && String(user.telegram_id) !== telegramIdString) {
        return { ok: false, code: 'account_already_linked' };
    }

    // ... and the Telegram account can only be bound to one staff account.
    const { data: owner, error: ownerError } = await supabase
        .from('users')
        .select('id')
        .eq('telegram_id', telegramIdString)
        .neq('id', user.id)
        .maybeSingle();

    if (ownerError) throw ownerError;
    if (owner) return { ok: false, code: 'telegram_already_linked' };

    // Atomic single-use claim: only one caller can flip used_at from NULL.
    const claimed = await supabase
        .from('telegram_link_tokens')
        .update({
            used_at: now.toISOString(),
            telegram_id: telegramIdString,
            telegram_username: normalizeUsername(username),
        })
        .eq('id', row.id)
        .is('used_at', null)
        .gt('expires_at', now.toISOString())
        .select('id')
        .maybeSingle();

    if (claimed.error) throw claimed.error;
    if (!claimed.data) {
        // Lost the race (or the row expired in between): report accurately.
        const { data: latest } = await supabase
            .from('telegram_link_tokens')
            .select('used_at')
            .eq('id', row.id)
            .maybeSingle();
        return { ok: false, code: latest?.used_at ? 'used' : 'expired' };
    }

    const { data: updated, error: updateError } = await supabase
        .from('users')
        .update({
            telegram_id: telegramIdString,
            telegram_username: normalizeUsername(username),
        })
        .eq('id', user.id)
        .select()
        .single();

    if (updateError) {
        // The unique index on users.telegram_id is the final backstop when two
        // staff consume different links with the same Telegram account at once.
        if (updateError.code === '23505') return { ok: false, code: 'telegram_already_linked' };
        throw updateError;
    }

    return { ok: true, code: 'linked', user: updated };
};

module.exports = {
    LINK_TOKEN_TTL_MS,
    LINK_TOKEN_BYTES,
    LINK_TOKEN_PATTERN,
    LINK_PAYLOAD_PREFIX,
    generateLinkToken,
    hashLinkToken,
    normalizeTelegramId,
    isValidLinkToken,
    buildDeepLink,
    createLinkToken,
    getLinkStatus,
    consumeLinkToken,
};
