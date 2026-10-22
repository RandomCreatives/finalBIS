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

/**
 * Is this error simply "the table isn't there yet"?
 *
 * Supabase answers PGRST205 ("Could not find the table ... in the schema
 * cache") when a migration has not been applied; a direct Postgres
 * connection answers 42P01. Both mean the deployment is incomplete rather
 * than the request being wrong, so they get an explanatory message instead
 * of a generic 500. Same convention as utils/nudges.js and the other
 * optional-table callers in this codebase.
 */
const isMissingStorage = (error) =>
    error?.code === 'PGRST205' ||
    error?.code === 'PGRST204' ||
    error?.code === '42P01' ||
    /relation .*does not exist|could not find the table|schema cache/i.test(error?.message || '');

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
    if (purgeError) {
        if (isMissingStorage(purgeError)) {
            console.error('[telegram-link] telegram_link_tokens is missing — apply supabase/migrations/031_telegram_link_tokens.sql');
            return { ok: false, code: 'not_ready' };
        }
        throw purgeError;
    }

    const { token, tokenHash } = generateLinkToken();
    const expiresAt = new Date(now.getTime() + LINK_TOKEN_TTL_MS);

    const { error: insertError } = await supabase.from('telegram_link_tokens').insert({
        user_id: userId,
        token_hash: tokenHash,
        expires_at: expiresAt.toISOString(),
        created_at: now.toISOString(),
    });
    if (insertError) {
        if (isMissingStorage(insertError)) {
            console.error('[telegram-link] telegram_link_tokens is missing — apply supabase/migrations/031_telegram_link_tokens.sql');
            return { ok: false, code: 'not_ready' };
        }
        throw insertError;
    }

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

    if (error) {
        if (isMissingStorage(error)) return { status: 'unavailable' };
        throw error;
    }
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

    if (lookupError) {
        if (isMissingStorage(lookupError)) return { ok: false, code: 'not_ready' };
        throw lookupError;
    }
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

    // ------------------------------------------------------------------
    // Write order matters.
    //
    // Binding the staff account happens FIRST and the token is burnt LAST.
    // The other order had a silent failure mode: if the users update failed
    // for any reason the token was already marked used, nothing was bound,
    // and the staff member was left with a burnt link and no explanation.
    // This way a failed bind leaves the token intact, so the same link can
    // simply be opened again.
    // ------------------------------------------------------------------
    const username_value = normalizeUsername(username);
    const alreadyOurs = alreadyBound; // bind was verified above (same id)

    if (!alreadyOurs) {
        // Conditional update: only bind if the account is still unbound, so a
        // concurrent link cannot be silently overwritten.
        const { data: bound, error: bindError } = await supabase
            .from('users')
            .update({ telegram_id: telegramIdString, telegram_username: username_value })
            .eq('id', user.id)
            .is('telegram_id', null)
            .select()
            .maybeSingle();

        if (bindError) {
            // The unique index on users.telegram_id is the final backstop when
            // two staff consume different links with the same Telegram account
            // at once. The token stays usable.
            if (bindError.code === '23505') return { ok: false, code: 'telegram_already_linked' };
            if (isMissingStorage(bindError)) return { ok: false, code: 'not_ready' };
            console.error('[telegram-link] binding failed:', bindError.message);
            return { ok: false, code: 'error' };
        }

        if (!bound) {
            // Lost a race: the account was bound (or unbound) under us.
            const { data: latestUser } = await supabase
                .from('users')
                .select('id, telegram_id')
                .eq('id', user.id)
                .maybeSingle();
            return {
                ok: false,
                code: String(latestUser?.telegram_id) === telegramIdString ? 'used' : 'account_already_linked',
            };
        }
    }

    // Atomic single-use claim: only one caller can flip used_at from NULL.
    const claimed = await supabase
        .from('telegram_link_tokens')
        .update({
            used_at: now.toISOString(),
            telegram_id: telegramIdString,
            telegram_username: username_value,
        })
        .eq('id', row.id)
        .is('used_at', null)
        .gt('expires_at', now.toISOString())
        .select('id')
        .maybeSingle();

    if (claimed.error) {
        if (isMissingStorage(claimed.error)) return { ok: false, code: 'not_ready' };
        throw claimed.error;
    }

    if (!claimed.data) {
        // Lost the race, or the row expired in between. If we did the binding
        // in this call, undo it: an unconsumed token must not leave an
        // account bound, otherwise the link could be replayed.
        if (!alreadyOurs) {
            await supabase
                .from('users')
                .update({ telegram_id: null, telegram_username: null })
                .eq('id', user.id)
                .eq('telegram_id', telegramIdString)
                .then(({ error }) => {
                    if (error) console.error('[telegram-link] could not release binding:', error.message);
                });
        }

        const { data: latest } = await supabase
            .from('telegram_link_tokens')
            .select('used_at')
            .eq('id', row.id)
            .maybeSingle();
        return { ok: false, code: latest?.used_at ? 'used' : 'expired' };
    }

    const { data: updated, error: readError } = await supabase
        .from('users')
        .select()
        .eq('id', user.id)
        .single();

    if (readError) throw readError;

    return { ok: true, code: 'linked', user: updated };
};

/** How long a readiness probe is trusted before asking the database again. */
const READINESS_TTL_MS = 60 * 1000;
let readiness = { at: 0, ready: false };

/**
 * Is the linking table provisioned? Cheap `head` probe, memoised for a
 * minute so the public config endpoint can report the state without a
 * database round-trip on every page load.
 *
 * @returns {Promise<boolean>}
 */
const isLinkStorageReady = async ({ now = Date.now(), force = false } = {}) => {
    if (!force && readiness.at && now - readiness.at < READINESS_TTL_MS) return readiness.ready;

    const { error } = await supabase
        .from('telegram_link_tokens')
        .select('id', { count: 'exact', head: true })
        .limit(1);

    const ready = !error;
    if (error && !isMissingStorage(error)) throw error;
    readiness = { at: now, ready };
    return ready;
};

/**
 * What does THIS deployment see for one staff member? Used by the
 * diagnostics endpoint: if the bot said "linked" but this shows no used
 * token and no binding, the bot wrote to another database.
 *
 * @returns {Promise<{total:number, unused:number, lastUsedAt:string|null, lastCreatedAt:string|null}>}
 */
const countTokensForUser = async ({ userId }) => {
    const { data: rows, error } = await supabase
        .from('telegram_link_tokens')
        .select('used_at, created_at')
        .eq('user_id', userId);

    if (error) {
        if (isMissingStorage(error)) return { total: 0, unused: 0, lastUsedAt: null, lastCreatedAt: null };
        throw error;
    }

    const list = rows || [];
    const used = list.filter((r) => r.used_at).map((r) => r.used_at).sort();
    const created = list.map((r) => r.created_at).filter(Boolean).sort();

    return {
        total: list.length,
        unused: list.filter((r) => !r.used_at).length,
        lastUsedAt: used.length ? used[used.length - 1] : null,
        lastCreatedAt: created.length ? created[created.length - 1] : null,
    };
};

/** Forget the memoised probe (after a migration, or in tests). */
const resetReadinessCache = () => {
    readiness = { at: 0, ready: false };
};

module.exports = {
    LINK_TOKEN_TTL_MS,
    isMissingStorage,
    isLinkStorageReady,
    countTokensForUser,
    resetReadinessCache,
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
