/**
 * Telegram Mini App sign-in (`POST /api/auth/telegram-webapp`).
 *
 * These tests pin the Web App HMAC algorithm from Telegram's documentation:
 *
 *   secret_key        = HMAC_SHA256(key="WebAppData", message=bot_token)
 *   data_check_string = every field except `hash`, sorted by key, joined "\n"
 *   hash              = hex(HMAC_SHA256(key=secret_key, message=check_string))
 *
 * They also cover stale/future `auth_date` values and unlinked/inactive users.
 * The Login Widget suite in auth.test.js covers the other (different) scheme.
 */
const { test, describe, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');

const { reset } = require('./helpers');
const request = require('./request');
const app = require('../app');
const {
    verifyTelegramInitData,
    isAuthDateFresh,
    TELEGRAM_AUTH_MAX_FUTURE_SKEW_MS,
} = require('../utils/telegram');

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const SCHOOL = '0a5eae91-5307-4125-b24f-876bb3f529b8';
const ADMIN = 'd4f1a2b8-7c63-4e59-9f21-3a8e6b0d5c74';
const TELEGRAM_ID = 987654321;

const NOW = 1_800_000_000; // fixed "now" in seconds for deterministic unit tests

/** Build an initData query string signed exactly the way Telegram signs one. */
const signInitData = (fields = {}, { token = BOT_TOKEN, signature } = {}) => {
    const user = { id: TELEGRAM_ID, first_name: 'Test', last_name: 'Staff', username: 'test_staff' };
    const payload = {
        auth_date: Math.floor(Date.now() / 1000),
        query_id: 'AAHdF6IQAAAAAN0XohDhrOrc',
        user: JSON.stringify(user),
        ...fields,
    };
    if (signature) payload.signature = signature;

    const dataCheckString = Object.entries(payload)
        .map(([key, value]) => `${key}=${value}`)
        .sort()
        .join('\n');

    const secretKey = crypto.createHmac('sha256', 'WebAppData').update(token).digest();
    const hash = crypto.createHmac('sha256', secretKey).update(dataCheckString).digest('hex');

    return new URLSearchParams({ ...payload, hash }).toString();
};

/** Build initData valid at a fixed timestamp (for the pure verifier tests). */
const signInitDataAt = (authDate, fields = {}) => {
    const payload = {
        auth_date: authDate,
        user: JSON.stringify({ id: TELEGRAM_ID, first_name: 'Test', username: 'test_staff' }),
        ...fields,
    };
    const dataCheckString = Object.entries(payload)
        .map(([key, value]) => `${key}=${value}`)
        .sort()
        .join('\n');
    const secretKey = crypto.createHmac('sha256', 'WebAppData').update(BOT_TOKEN).digest();
    const hash = crypto.createHmac('sha256', secretKey).update(dataCheckString).digest('hex');
    return new URLSearchParams({ ...payload, hash }).toString();
};

const seedStaff = (overrides = {}) =>
    reset({
        users: [
            {
                id: ADMIN,
                school_id: SCHOOL,
                name: 'Test Admin',
                email: 'admin@school.et',
                role: 'admin',
                is_active: true,
                telegram_id: String(TELEGRAM_ID),
                telegram_username: 'test_staff',
                last_login_at: null,
                ...overrides,
            },
        ],
    });

describe('verifyTelegramInitData (Web App HMAC)', () => {
    test('accepts a payload signed with the WebAppData secret', () => {
        const identity = verifyTelegramInitData(signInitDataAt(NOW), BOT_TOKEN, { now: NOW * 1000 });

        assert.ok(identity);
        assert.equal(identity.telegramId, String(TELEGRAM_ID));
        assert.equal(identity.username, 'test_staff');
        assert.equal(identity.firstName, 'Test');
        assert.equal(identity.authDate, NOW);
    });

    test('rejects the payload when signed with the Login Widget scheme', () => {
        // The widget derives secret = SHA256(bot_token) — the exact bug this
        // endpoint had. It must not verify as a Mini App payload.
        const payload = {
            auth_date: String(NOW),
            user: JSON.stringify({ id: TELEGRAM_ID }),
        };
        const dataCheckString = Object.entries(payload)
            .map(([k, v]) => `${k}=${v}`)
            .sort()
            .join('\n');
        const widgetSecret = crypto.createHash('sha256').update(BOT_TOKEN).digest();
        const hash = crypto.createHmac('sha256', widgetSecret).update(dataCheckString).digest('hex');
        const initData = new URLSearchParams({ ...payload, hash }).toString();

        assert.equal(verifyTelegramInitData(initData, BOT_TOKEN, { now: NOW * 1000 }), null);
    });

    test('rejects a tampered field', () => {
        const initData = signInitDataAt(NOW);
        const params = new URLSearchParams(initData);
        params.set('user', JSON.stringify({ id: 111111111, first_name: 'Mallory' }));

        assert.equal(
            verifyTelegramInitData(params.toString(), BOT_TOKEN, { now: NOW * 1000 }),
            null,
        );
    });

    test('rejects a different bot token', () => {
        const initData = signInitDataAt(NOW);

        assert.equal(verifyTelegramInitData(initData, '999:OTHER_TOKEN', { now: NOW * 1000 }), null);
    });

    test('keeps the optional signature field inside the HMAC payload', () => {
        // Modern clients send `signature`; Telegram's bot-token HMAC covers
        // every field except `hash`. Dropping signature would 401 real users.
        const initData = signInitDataAt(NOW, { signature: 'abc123signature' });

        const identity = verifyTelegramInitData(initData, BOT_TOKEN, { now: NOW * 1000 });
        assert.ok(identity, 'payload containing signature must verify');
    });

    test('rejects a missing or malformed hash', () => {
        const good = new URLSearchParams(signInitDataAt(NOW));
        good.delete('hash');
        assert.equal(verifyTelegramInitData(good.toString(), BOT_TOKEN, { now: NOW * 1000 }), null);

        const upper = new URLSearchParams(signInitDataAt(NOW));
        upper.set('hash', upper.get('hash').toUpperCase());
        assert.equal(verifyTelegramInitData(upper.toString(), BOT_TOKEN, { now: NOW * 1000 }), null);
    });

    test('rejects malformed or missing user JSON', () => {
        assert.equal(
            verifyTelegramInitData(signInitDataAt(NOW, { user: 'not-json' }), BOT_TOKEN, { now: NOW * 1000 }),
            null,
        );
        assert.equal(
            verifyTelegramInitData(signInitDataAt(NOW, { user: JSON.stringify({}) }), BOT_TOKEN, { now: NOW * 1000 }),
            null,
        );
        assert.equal(
            verifyTelegramInitData(signInitDataAt(NOW, { user: '[]' }), BOT_TOKEN, { now: NOW * 1000 }),
            null,
        );
    });

    test('rejects stale and future auth_date values', () => {
        const stale = signInitDataAt(NOW - 25 * 60 * 60);
        assert.equal(verifyTelegramInitData(stale, BOT_TOKEN, { now: NOW * 1000 }), null);

        const future = signInitDataAt(NOW + 10 * 60);
        assert.equal(verifyTelegramInitData(future, BOT_TOKEN, { now: NOW * 1000 }), null);
    });

    test('rejects duplicate fields', () => {
        const initData = signInitDataAt(NOW);
        const tampered = `${initData}&user=${encodeURIComponent(JSON.stringify({ id: 1 }))}`;

        assert.equal(verifyTelegramInitData(tampered, BOT_TOKEN, { now: NOW * 1000 }), null);
    });

    test('rejects non-string, empty and oversized input', () => {
        assert.equal(verifyTelegramInitData(null, BOT_TOKEN), null);
        assert.equal(verifyTelegramInitData({}, BOT_TOKEN), null);
        assert.equal(verifyTelegramInitData('', BOT_TOKEN), null);
        assert.equal(verifyTelegramInitData('a'.repeat(9000), BOT_TOKEN), null);
        assert.equal(verifyTelegramInitData(signInitDataAt(NOW), ''), null);
    });
});

describe('isAuthDateFresh', () => {
    const now = NOW * 1000;

    test('accepts recent timestamps and small clock drift', () => {
        assert.equal(isAuthDateFresh(NOW, { now }), true);
        assert.equal(isAuthDateFresh(String(NOW - 60), { now }), true);
        assert.equal(isAuthDateFresh(NOW - 23 * 60 * 60, { now }), true);
        assert.equal(isAuthDateFresh(NOW + 60, { now }), true);
        assert.equal(isAuthDateFresh(NOW + 4 * 60, { now }), true);
    });

    test('rejects stale timestamps', () => {
        assert.equal(isAuthDateFresh(NOW - 24 * 60 * 60 - 1, { now }), false);
        assert.equal(isAuthDateFresh(NOW - 48 * 60 * 60, { now }), false);
    });

    test('rejects future timestamps beyond the skew allowance', () => {
        const beyond = NOW + Math.ceil(TELEGRAM_AUTH_MAX_FUTURE_SKEW_MS / 1000) + 1;
        assert.equal(isAuthDateFresh(beyond, { now }), false);
    });

    test('rejects non-numeric, zero, negative and float values', () => {
        for (const value of [undefined, null, '', 'abc', '0', 0, -1, '1.5', 1.5, '12e5', '  ']) {
            assert.equal(isAuthDateFresh(value, { now }), false, `expected ${String(value)} to be rejected`);
        }
    });
});

describe('POST /api/auth/telegram-webapp', () => {
    beforeEach(() => seedStaff());

    test('issues a session for a valid, linked, active staff member', async () => {
        const res = await request(app)
            .post('/api/auth/telegram-webapp')
            .send({ init_data: signInitData() });

        assert.equal(res.status, 200);
        assert.ok(res.body.token, 'expected a session token');
        assert.equal(res.body.user.email, 'admin@school.et');
        assert.equal(res.body.user.role, 'admin');
        assert.equal(res.body.user.password_hash, undefined);
        assert.equal(res.body.user.passwordHash, undefined);
    });

    test('accepts initData that also carries the signature field', async () => {
        const res = await request(app)
            .post('/api/auth/telegram-webapp')
            .send({ init_data: signInitData({}, { signature: 'modern-client-signature' }) });

        assert.equal(res.status, 200);
        assert.ok(res.body.token);
    });

    test('rejects a forged signature', async () => {
        const params = new URLSearchParams(signInitData());
        params.set('hash', 'f'.repeat(64));

        const res = await request(app)
            .post('/api/auth/telegram-webapp')
            .send({ init_data: params.toString() });

        assert.equal(res.status, 401);
        assert.equal(res.body.token, undefined);
    });

    test('rejects a payload signed with the Login Widget algorithm', async () => {
        const payload = { auth_date: String(Math.floor(Date.now() / 1000)), user: JSON.stringify({ id: TELEGRAM_ID }) };
        const dataCheckString = Object.entries(payload).map(([k, v]) => `${k}=${v}`).sort().join('\n');
        const widgetSecret = crypto.createHash('sha256').update(BOT_TOKEN).digest();
        const hash = crypto.createHmac('sha256', widgetSecret).update(dataCheckString).digest('hex');

        const res = await request(app)
            .post('/api/auth/telegram-webapp')
            .send({ init_data: new URLSearchParams({ ...payload, hash }).toString() });

        assert.equal(res.status, 401);
    });

    test('rejects stale data', async () => {
        const stale = signInitData({ auth_date: Math.floor(Date.now() / 1000) - 25 * 60 * 60 });

        const res = await request(app)
            .post('/api/auth/telegram-webapp')
            .send({ init_data: stale });

        assert.equal(res.status, 401);
        assert.equal(res.body.token, undefined);
    });

    test('rejects future-dated data', async () => {
        const future = signInitData({ auth_date: Math.floor(Date.now() / 1000) + 60 * 60 });

        const res = await request(app)
            .post('/api/auth/telegram-webapp')
            .send({ init_data: future });

        assert.equal(res.status, 401);
        assert.equal(res.body.token, undefined);
    });

    test('rejects an unlinked Telegram account', async () => {
        seedStaff({ telegram_id: '555000111' });

        const res = await request(app)
            .post('/api/auth/telegram-webapp')
            .send({ init_data: signInitData() });

        assert.equal(res.status, 401);
        assert.match(res.body.message, /not linked/i);
        assert.equal(res.body.token, undefined);
    });

    test('rejects an inactive staff account', async () => {
        seedStaff({ is_active: false });

        const res = await request(app)
            .post('/api/auth/telegram-webapp')
            .send({ init_data: signInitData() });

        assert.equal(res.status, 401);
        assert.match(res.body.message, /deactivated/i);
        assert.equal(res.body.token, undefined);
    });

    test('requires init_data', async () => {
        const missing = await request(app).post('/api/auth/telegram-webapp').send({});
        assert.equal(missing.status, 400);

        const blank = await request(app).post('/api/auth/telegram-webapp').send({ init_data: '' });
        assert.equal(blank.status, 400);
    });

    test('rejects an oversized init_data payload', async () => {
        const res = await request(app)
            .post('/api/auth/telegram-webapp')
            .send({ init_data: 'a'.repeat(9000) });

        assert.equal(res.status, 400);
    });
});

describe('GET /api/auth/telegram-config', () => {
    test('never exposes the bot token', async () => {
        const res = await request(app).get('/api/auth/telegram-config');

        assert.equal(res.status, 200);
        assert.equal(res.body.botUsername, 'bis_noc_test_bot');
        const serialized = JSON.stringify(res.body);
        assert.equal(serialized.includes(BOT_TOKEN), false);
        assert.equal(serialized.includes(BOT_TOKEN.split(':')[1]), false);
    });
});
