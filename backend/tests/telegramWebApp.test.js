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
const bcrypt = require('bcryptjs');

const { reset, rowsOf } = require('./helpers');
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

describe('POST /api/auth/telegram-webapp/link (one-step in-Mini-App sign-in & link)', () => {
    const YEAR = '9a6ff1d0-6d70-4a38-b6e7-c1f4f3dc63aa';
    const CLASS_MAGENTA = '938efd5f-c75a-45e2-bcb5-c08dd0252cd1';
    const MAIN_TEACHER_ID = '82e61fbc-9942-415c-909c-f408360a2ef4';
    const SUBJ_TEACHER_ID = '343d1a63-716b-492c-88ca-f466c50aea97';
    const MIKE_TG_ID = 5141729620;
    const STAFF_PW_HASH = bcrypt.hashSync('CorrectHorse10!', 4);

    const seedUnlinkedSchool = (userOverrides = {}) =>
        reset({
            schools: [{ id: SCHOOL, name: 'BIS NOC Gerji' }],
            academic_years: [{ id: YEAR, school_id: SCHOOL, name: '2026/2027', is_current: true }],
            classes: [{ id: CLASS_MAGENTA, school_id: SCHOOL, name: 'Year 4 - Magenta', year_level: 4, capacity: 30 }],
            class_staff: [
                {
                    id: 'cs-mag',
                    school_id: SCHOOL,
                    academic_year_id: YEAR,
                    class_id: CLASS_MAGENTA,
                    user_id: MAIN_TEACHER_ID,
                    position: 'main',
                },
            ],
            users: [
                {
                    id: ADMIN,
                    school_id: SCHOOL,
                    name: 'Mr. Mike (Coordinator)',
                    email: 'mike@bisnoc.local',
                    password_hash: STAFF_PW_HASH,
                    role: 'admin',
                    is_active: true,
                    telegram_id: null,
                    telegram_username: null,
                    ...userOverrides.admin,
                },
                {
                    id: MAIN_TEACHER_ID,
                    school_id: SCHOOL,
                    name: 'Bethelhem Girma',
                    email: 'bethelhem.girma@bisnoc.local',
                    password_hash: STAFF_PW_HASH,
                    role: 'main_teacher',
                    is_active: true,
                    telegram_id: null,
                    telegram_username: null,
                    ...userOverrides.main,
                },
                {
                    id: SUBJ_TEACHER_ID,
                    school_id: SCHOOL,
                    name: 'Michael Okwara',
                    email: 'michael.okwara@bisnoc.local',
                    password_hash: STAFF_PW_HASH,
                    role: 'subject_teacher',
                    is_active: true,
                    telegram_id: null,
                    telegram_username: null,
                    ...userOverrides.subject,
                },
            ],
        });

    test('links an unlinked admin via email + password and enables zero-tap Mini App sign-in afterward', async () => {
        seedUnlinkedSchool();
        const mikeInitData = signInitData({
            user: JSON.stringify({ id: MIKE_TG_ID, first_name: 'Mike', username: 'Mike_Fikadu' }),
        });

        // Before linking, /telegram-webapp returns 401 TELEGRAM_NOT_LINKED.
        const initial = await request(app)
            .post('/api/auth/telegram-webapp')
            .send({ init_data: mikeInitData });
        assert.equal(initial.status, 401);
        assert.equal(initial.body.code, 'TELEGRAM_NOT_LINKED');

        // Link right inside the Mini App with email + password.
        const linked = await request(app)
            .post('/api/auth/telegram-webapp/link')
            .send({
                init_data: mikeInitData,
                email: 'Mike@bisnoc.local',
                password: 'CorrectHorse10!',
            });

        assert.equal(linked.status, 200);
        assert.equal(linked.body.linked, true);
        assert.ok(linked.body.token);
        assert.equal(linked.body.user.email, 'mike@bisnoc.local');
        assert.equal(String(linked.body.user.telegramId), String(MIKE_TG_ID));
        assert.equal(linked.body.user.telegramUsername, 'Mike_Fikadu');

        // Subsequent Mini App launches sign in automatically with zero credentials.
        const subsequent = await request(app)
            .post('/api/auth/telegram-webapp')
            .send({ init_data: mikeInitData });
        assert.equal(subsequent.status, 200);
        assert.equal(subsequent.body.user.id, ADMIN);
    });

    test('links a Main Teacher via classPassword ("year 4 magenta")', async () => {
        seedUnlinkedSchool();
        const tgInit = signInitData({
            user: JSON.stringify({ id: 777888999, first_name: 'Bethelhem', username: 'bethelhem_g' }),
        });

        const res = await request(app)
            .post('/api/auth/telegram-webapp/link')
            .send({ init_data: tgInit, classPassword: 'year 4 magenta' });

        assert.equal(res.status, 200);
        assert.equal(res.body.user.id, MAIN_TEACHER_ID);
        assert.equal(String(rowsOf('users').find((u) => u.id === MAIN_TEACHER_ID).telegram_id), '777888999');
    });

    test('links a Subject Teacher via teacherId + password', async () => {
        seedUnlinkedSchool();
        const tgInit = signInitData({
            user: JSON.stringify({ id: 444555666, first_name: 'Michael', username: 'mike_eng' }),
        });

        const res = await request(app)
            .post('/api/auth/telegram-webapp/link')
            .send({
                init_data: tgInit,
                teacherId: SUBJ_TEACHER_ID,
                password: 'CorrectHorse10!',
            });

        assert.equal(res.status, 200);
        assert.equal(res.body.user.id, SUBJ_TEACHER_ID);
        assert.equal(String(rowsOf('users').find((u) => u.id === SUBJ_TEACHER_ID).telegram_id), '444555666');
    });

    test('rejects invalid credentials, forged initData, and cross-account binding conflicts', async () => {
        seedUnlinkedSchool({ subject: { telegram_id: String(TELEGRAM_ID) } });

        // Wrong password does not bind anything.
        const badPw = await request(app)
            .post('/api/auth/telegram-webapp/link')
            .send({
                init_data: signInitData({ user: JSON.stringify({ id: 123123123, first_name: 'A' }) }),
                email: 'mike@bisnoc.local',
                password: 'WrongPassword!',
            });
        assert.equal(badPw.status, 401);
        assert.equal(rowsOf('users').find((u) => u.id === ADMIN).telegram_id, null);

        // Forged initData is rejected even with valid credentials.
        const params = new URLSearchParams(signInitData());
        params.set('hash', '0'.repeat(64));
        const forged = await request(app)
            .post('/api/auth/telegram-webapp/link')
            .send({
                init_data: params.toString(),
                email: 'mike@bisnoc.local',
                password: 'CorrectHorse10!',
            });
        assert.equal(forged.status, 401);

        // Telegram ID already bound to another staff member -> 409 Conflict.
        const takenTg = await request(app)
            .post('/api/auth/telegram-webapp/link')
            .send({
                init_data: signInitData(), // uses TELEGRAM_ID, owned by SUBJ_TEACHER_ID
                email: 'mike@bisnoc.local',
                password: 'CorrectHorse10!',
            });
        assert.equal(takenTg.status, 409);
        assert.match(takenTg.body.message, /already linked to another staff member/i);

        // Staff account already bound to a different Telegram ID -> 409 Conflict.
        seedUnlinkedSchool({ admin: { telegram_id: '999000111' } });
        const takenAccount = await request(app)
            .post('/api/auth/telegram-webapp/link')
            .send({
                init_data: signInitData(),
                email: 'mike@bisnoc.local',
                password: 'CorrectHorse10!',
            });
        assert.equal(takenAccount.status, 409);
        assert.match(takenAccount.body.message, /different Telegram account/i);
    });
});

