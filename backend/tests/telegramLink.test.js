/**
 * One-time Telegram account linking.
 *
 * Covers the whole path: minting a link over the API, opening it through the
 * bot (`/start link_<token>`), and every rejection the brief calls for —
 * expired, reused, unknown and already-linked identities — plus the
 * containment rules (one live link per account, tokens stored only as
 * hashes, no cross-account poking).
 */
const { test, describe, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');

const { reset, rowsOf, db } = require('./helpers');
const request = require('./request');
const app = require('../app');
const { signToken } = require('../middleware/auth');
const { telegramLinkLimiter } = require('../middleware/security');
const { handleUpdate } = require('../services/telegramBot');
const {
    LINK_TOKEN_TTL_MS,
    LINK_TOKEN_PATTERN,
    hashLinkToken,
    normalizeTelegramId,
    generateLinkToken,
    buildDeepLink,
} = require('../services/telegramLink');

const SCHOOL = '0a5eae91-5307-4125-b24f-876bb3f529b8';
const ADMIN = 'd4f1a2b8-7c63-4e59-9f21-3a8e6b0d5c74';
const TEACHER = '5be2c1a4-9f0d-4c1b-8a6e-2d3f4a5b6c7d';
const OTHER = '6cf3d2b5-0a1e-4d2c-9b7f-3e4a5b6c7d8e';

const BOT_USERNAME = process.env.TELEGRAM_BOT_USERNAME; // bis_noc_test_bot
const TG_ID = '700100200'; // the staff member's Telegram account
const TG_OTHER = '900800700'; // somebody else's Telegram account

const user = (overrides = {}) => ({
    id: ADMIN,
    school_id: SCHOOL,
    name: 'Test Admin',
    email: 'admin@school.et',
    password_hash: 'x',
    role: 'admin',
    is_active: true,
    telegram_id: null,
    telegram_username: null,
    ...overrides,
});

const seed = ({ users: overrides = [], tokens = [] } = {}) => {
    const base = [
        user(),
        user({ id: TEACHER, name: 'Test Teacher', email: 'teacher@school.et', role: 'main_teacher' }),
        user({ id: OTHER, name: 'Other Teacher', email: 'other@school.et', role: 'subject_teacher' }),
    ];
    const byId = new Map(base.map((u) => [u.id, u]));
    overrides.forEach((u) => byId.set(u.id, { ...(byId.get(u.id) || {}), ...u }));

    reset({ users: [...byId.values()], telegram_link_tokens: tokens });
};

const tokenFor = (id) => rowsOf('telegram_link_tokens').find((t) => t.user_id === id);

/** Send `/start link_<token>` to the bot as Telegram would deliver it. */
const openInBot = (token, { from = TG_ID, chatType = 'private', username = 'test_staff' } = {}) =>
    handleUpdate({
        message: {
            message_id: 1,
            chat: { id: from, type: chatType },
            from: { id: from, username },
            text: `/start link_${token}`,
        },
    });

// Capture Telegram Bot API calls instead of hitting the network.
const realFetch = global.fetch;
let telegram = [];
/** Everything the bot said during the test, newest last. */
const botSaid = () =>
    telegram
        .filter((c) => c.method === 'sendMessage')
        .map((c) => c.body.text || '')
        .join('\n—\n');

beforeEach(() => {
    telegram = [];
    // Each case starts with a clean per-account budget: the limiter's store
    // outlives a single test run, exactly as it does in production.
    [ADMIN, TEACHER, OTHER].forEach((id) => telegramLinkLimiter.resetKey(`user:${id}`));
    global.fetch = async (url, init) => {
        if (String(url).startsWith('https://api.telegram.org/')) {
            telegram.push({ method: String(url).split('/').pop(), body: JSON.parse(init.body) });
            return { json: async () => ({ ok: true, result: {} }) };
        }
        return realFetch(url, init);
    };
});

afterEach(() => {
    global.fetch = realFetch;
});

/* ── token primitives ───────────────────────────────────────────────────── */

describe('link token primitives', () => {
    test('tokens are 43-character URL-safe strings', () => {
        const { token, tokenHash } = generateLinkToken();
        assert.match(token, LINK_TOKEN_PATTERN);
        assert.equal(token.length, 43);
        assert.match(tokenHash, /^[0-9a-f]{64}$/);
    });

    test('each mint is unique and the hash is the SHA-256 of the token', () => {
        const a = generateLinkToken();
        const b = generateLinkToken();
        assert.notEqual(a.token, b.token);
        assert.equal(a.tokenHash, crypto.createHash('sha256').update(a.token).digest('hex'));
        assert.equal(hashLinkToken(a.token), a.tokenHash);
    });

    test('Telegram ids are normalised, and anything not a positive integer is refused', () => {
        assert.equal(normalizeTelegramId(700100200), '700100200');
        assert.equal(normalizeTelegramId('700100200'), '700100200');
        assert.equal(normalizeTelegramId(0), null);
        assert.equal(normalizeTelegramId(-5), null);
        assert.equal(normalizeTelegramId(1.5), null);
        assert.equal(normalizeTelegramId('abc'), null);
        assert.equal(normalizeTelegramId(' 12'), null);
        assert.equal(normalizeTelegramId(null), null);
        assert.equal(normalizeTelegramId(Number.MAX_SAFE_INTEGER + 1), null);
    });

    test('deep link carries the bot handle and the link_ payload', () => {
        const { token } = generateLinkToken();
        assert.equal(
            buildDeepLink(`@${BOT_USERNAME}`, token),
            `https://t.me/${BOT_USERNAME}?start=link_${token}`
        );
        assert.equal(buildDeepLink('', token), null);
        assert.equal(buildDeepLink(BOT_USERNAME, 'not-a-token'), null);
    });
});

/* ── minting ────────────────────────────────────────────────────────────── */

describe('POST /api/auth/telegram-link', () => {
    test('requires a signed-in staff member', async () => {
        seed();
        const res = await request(app).post('/api/auth/telegram-link');
        assert.equal(res.status, 401);
    });

    test('mints a short-lived one-time deep link for the signed-in staff member', async () => {
        seed();

        const res = await request(app)
            .post('/api/auth/telegram-link')
            .auth(signToken({ id: ADMIN, role: 'admin' }));

        assert.equal(res.status, 201);
        assert.match(res.body.token, LINK_TOKEN_PATTERN);
        assert.equal(
            res.body.deepLink,
            `https://t.me/${BOT_USERNAME}?start=link_${res.body.token}`
        );
        assert.equal(res.body.botUsername, BOT_USERNAME);
        assert.equal(res.body.expiresInSeconds, LINK_TOKEN_TTL_MS / 1000);
        assert.ok(new Date(res.body.expiresAt).getTime() > Date.now());

        // The raw token is never persisted — only its SHA-256 hash.
        const stored = tokenFor(ADMIN);
        assert.equal(stored.token_hash, hashLinkToken(res.body.token));
        assert.ok(!JSON.stringify(db.tables.telegram_link_tokens).includes(res.body.token));
        assert.equal(stored.used_at, undefined);
    });

    test('refuses a deactivated staff account', async () => {
        seed({ users: [user({ id: TEACHER, is_active: false })] });

        const res = await request(app)
            .post('/api/auth/telegram-link')
            .auth(signToken({ id: TEACHER, role: 'main_teacher' }));

        // authenticate() rejects deactivated accounts outright.
        assert.equal(res.status, 401);
        assert.equal(tokenFor(TEACHER), undefined);
    });

    test('refuses to re-link an account that already has a Telegram identity', async () => {
        seed({ users: [user({ id: TEACHER, telegram_id: TG_ID, telegram_username: 'test_staff' })] });

        const res = await request(app)
            .post('/api/auth/telegram-link')
            .auth(signToken({ id: TEACHER, role: 'main_teacher' }));

        assert.equal(res.status, 409);
        assert.match(res.body.message, /already linked/i);
        assert.equal(tokenFor(TEACHER), undefined);
    });

    test('throttles repeated minting for the same account', async () => {
        seed();
        const auth = signToken({ id: ADMIN, role: 'admin' });

        for (let i = 0; i < 10; i += 1) {
            const ok = await request(app).post('/api/auth/telegram-link').auth(auth);
            assert.equal(ok.status, 201, `request ${i + 1} should be allowed`);
        }

        const throttled = await request(app).post('/api/auth/telegram-link').auth(auth);
        assert.equal(throttled.status, 429);
        assert.match(throttled.body.message, /too many/i);
    });

    test('minting again invalidates the previous link', async () => {
        seed();
        const auth = signToken({ id: ADMIN, role: 'admin' });

        const first = await request(app).post('/api/auth/telegram-link').auth(auth);
        const second = await request(app).post('/api/auth/telegram-link').auth(auth);

        assert.equal(first.status, 201);
        assert.equal(second.status, 201);
        assert.equal(rowsOf('telegram_link_tokens').length, 1, 'only one live link per account');

        // The superseded link must no longer work.
        await openInBot(first.body.token);
        assert.match(botSaid(), /not valid/i);
        assert.equal(rowsOf('users')[0].telegram_id, null);

        await openInBot(second.body.token);
        assert.match(botSaid(), /Linked/i);
        assert.equal(rowsOf('users')[0].telegram_id, TG_ID);
    });
});

/* ── status polling ─────────────────────────────────────────────────────── */

describe('GET /api/auth/telegram-link/:token', () => {
    test('reports pending, then used once the bot consumes it', async () => {
        seed();
        const auth = signToken({ id: ADMIN, role: 'admin' });
        const minted = await request(app).post('/api/auth/telegram-link').auth(auth);

        const pending = await request(app)
            .get(`/api/auth/telegram-link/${minted.body.token}`)
            .auth(auth);
        assert.equal(pending.status, 200);
        assert.equal(pending.body.status, 'pending');

        await openInBot(minted.body.token);
        assert.match(botSaid(), /Linked/i);

        const used = await request(app)
            .get(`/api/auth/telegram-link/${minted.body.token}`)
            .auth(auth);
        assert.equal(used.body.status, 'used');
    });

    test('is scoped to the caller — another staff member cannot inspect the token', async () => {
        seed();
        const minted = await request(app)
            .post('/api/auth/telegram-link')
            .auth(signToken({ id: ADMIN, role: 'admin' }));

        const res = await request(app)
            .get(`/api/auth/telegram-link/${minted.body.token}`)
            .auth(signToken({ id: OTHER, role: 'subject_teacher' }));

        assert.equal(res.status, 200);
        assert.equal(res.body.status, 'invalid');
    });

    test('requires a signed-in staff member', async () => {
        seed();
        const res = await request(app).get('/api/auth/telegram-link/abc');
        assert.equal(res.status, 401);
    });

    test('reports invalid and expired states', async () => {
        seed();
        const auth = signToken({ id: ADMIN, role: 'admin' });
        const minted = await request(app).post('/api/auth/telegram-link').auth(auth);

        const junk = await request(app).get('/api/auth/telegram-link/not-a-token').auth(auth);
        assert.equal(junk.body.status, 'invalid');

        tokenFor(ADMIN).expires_at = new Date(Date.now() - 1000).toISOString();
        const expired = await request(app)
            .get(`/api/auth/telegram-link/${minted.body.token}`)
            .auth(auth);
        assert.equal(expired.body.status, 'expired');
    });
});

/* ── consuming through the bot ──────────────────────────────────────────── */

describe('opening the link in the bot', () => {
    const mintFor = async (id = ADMIN) => {
        const res = await request(app)
            .post('/api/auth/telegram-link')
            .auth(signToken({ id, role: 'admin' }));
        return res.body.token;
    };

    test('binds the Telegram account to the existing staff account', async () => {
        seed();
        const token = await mintFor();
        assert.equal(tokenFor(ADMIN).used_at, undefined);

        await openInBot(token);

        assert.match(botSaid(), /Linked/i);
        const stored = rowsOf('users').find((u) => u.id === ADMIN);
        assert.equal(String(stored.telegram_id), TG_ID);
        assert.equal(stored.telegram_username, 'test_staff');

        // The token is burnt and the identity recorded for audit.
        const record = tokenFor(ADMIN);
        assert.ok(record.used_at);
        assert.equal(String(record.telegram_id), TG_ID);

        // No second staff account was created — the join is by existing account.
        assert.equal(rowsOf('users').length, 3);
    });

    test('a used link cannot be replayed', async () => {
        seed();
        const token = await mintFor();

        await openInBot(token);
        assert.match(botSaid(), /Linked/i);

        telegram = [];
        await openInBot(token, { from: TG_OTHER });
        assert.match(botSaid(), /already been used/i);

        // The replay did nothing: the first identity stays, no second binding.
        assert.equal(String(rowsOf('users').find((u) => u.id === ADMIN).telegram_id), TG_ID);
        assert.equal(rowsOf('users').find((u) => u.id === OTHER).telegram_id, null);
    });

    test('an expired link is refused and binds nothing', async () => {
        seed();
        const token = await mintFor();

        tokenFor(ADMIN).expires_at = new Date(Date.now() - 60 * 1000).toISOString();
        await openInBot(token);

        assert.match(botSaid(), /expired/i);
        assert.equal(rowsOf('users').find((u) => u.id === ADMIN).telegram_id, null);
        assert.equal(tokenFor(ADMIN).used_at, undefined);
    });

    test('an unknown or malformed token reveals nothing', async () => {
        seed();

        await openInBot(crypto.randomBytes(32).toString('base64url'));
        assert.match(botSaid(), /not valid/i);

        telegram = [];
        await openInBot('short');
        assert.match(botSaid(), /not valid/i);

        assert.equal(rowsOf('users').find((u) => u.id === ADMIN).telegram_id, null);
    });

    test('a Telegram account already linked to another staff member is rejected', async () => {
        seed();
        const token = await mintFor(ADMIN);

        // Somebody else's staff account already owns this Telegram id.
        rowsOf('users').find((u) => u.id === OTHER).telegram_id = TG_ID;

        await openInBot(token);

        assert.match(botSaid(), /already linked to another staff member/i);
        assert.equal(rowsOf('users').find((u) => u.id === ADMIN).telegram_id, null);
    });

    test('a staff account already bound to a different Telegram account is rejected', async () => {
        seed();
        const token = await mintFor(ADMIN);
        rowsOf('users').find((u) => u.id === ADMIN).telegram_id = TG_OTHER;

        await openInBot(token);

        assert.match(botSaid(), /already linked to a different Telegram account/i);
        assert.equal(String(rowsOf('users').find((u) => u.id === ADMIN).telegram_id), TG_OTHER);
    });

    test('an account deactivated after minting cannot be linked', async () => {
        seed();
        const token = await mintFor(ADMIN);
        rowsOf('users').find((u) => u.id === ADMIN).is_active = false;

        await openInBot(token);

        assert.match(botSaid(), /not active/i);
        assert.equal(rowsOf('users').find((u) => u.id === ADMIN).telegram_id, null);
    });

    test('linking is refused in group chats, where the payload could be shared', async () => {
        seed();
        const token = await mintFor();

        await openInBot(token, { chatType: 'group' });

        assert.match(botSaid(), /private chat/i);
        assert.equal(rowsOf('users').find((u) => u.id === ADMIN).telegram_id, null);
        assert.equal(tokenFor(ADMIN).used_at, undefined);
    });

    test('an unlinked member is told how to link, and stays unlinked', async () => {
        seed();

        await handleUpdate({
            message: {
                message_id: 2,
                chat: { id: TG_ID, type: 'private' },
                from: { id: TG_ID },
                text: '/start',
            },
        });

        assert.match(botSaid(), /create a one-time link/i);
        assert.equal(rowsOf('users').find((u) => u.id === ADMIN).telegram_id, null);
    });
});
