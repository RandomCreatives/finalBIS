const { test, describe, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');

const { reset } = require('./helpers');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const request = require('./request');
const app = require('../app');
const { signToken } = require('../middleware/auth');

const SCHOOL = '0a5eae91-5307-4125-b24f-876bb3f529b8';
const ADMIN = 'd4f1a2b8-7c63-4e59-9f21-3a8e6b0d5c74';

/** Build a widget payload signed exactly as the Telegram widget signs it. */
const signedTelegramPayload = (fields = {}) => {
    const now = Math.floor(Date.now() / 1000);
    const payload = {
        id: 987654321,
        first_name: 'Test',
        last_name: 'Staff',
        username: 'test_staff',
        auth_date: now,
        ...fields,
    };

    const dataCheckString = Object.keys(payload)
        .sort()
        .map((key) => `${key}=${payload[key]}`)
        .join('\n');

    const secretKey = crypto.createHash('sha256').update(process.env.TELEGRAM_BOT_TOKEN).digest();
    payload.hash = crypto.createHmac('sha256', secretKey).update(dataCheckString).digest('hex');
    return payload;
};

const seedAdmin = async (overrides = {}) => {
    reset({
        users: [
            {
                id: ADMIN,
                school_id: SCHOOL,
                name: 'Test Admin',
                email: 'admin@school.et',
                password_hash: await bcrypt.hash('correct-horse-battery', 12),
                role: 'admin',
                is_active: true,
                last_login_at: null,
                ...overrides,
            },
        ],
    });
};

describe('POST /api/auth/login', () => {
    beforeEach(seedAdmin);

    test('issues a token for valid credentials', async () => {
        const res = await request(app)
            .post('/api/auth/login')
            .send({ email: 'admin@school.et', password: 'correct-horse-battery' });

        assert.equal(res.status, 200);
        assert.ok(res.body.token, 'expected a token');
        assert.equal(res.body.user.email, 'admin@school.et');
        assert.equal(res.body.user.role, 'admin');
    });

    test('never returns the password hash', async () => {
        const res = await request(app)
            .post('/api/auth/login')
            .send({ email: 'admin@school.et', password: 'correct-horse-battery' });

        assert.equal(res.body.user.password_hash, undefined);
        assert.equal(res.body.user.passwordHash, undefined);
        assert.ok(!JSON.stringify(res.body).includes('$2a$'), 'hash leaked in response');
    });

    test('rejects a wrong password', async () => {
        const res = await request(app)
            .post('/api/auth/login')
            .send({ email: 'admin@school.et', password: 'wrong-password' });

        assert.equal(res.status, 401);
        assert.equal(res.body.token, undefined);
    });

    test('gives an identical error for unknown and wrong-password accounts', async () => {
        const unknown = await request(app)
            .post('/api/auth/login')
            .send({ email: 'nobody@school.et', password: 'whatever-here' });
        const wrong = await request(app)
            .post('/api/auth/login')
            .send({ email: 'admin@school.et', password: 'whatever-here' });

        assert.equal(unknown.status, wrong.status);
        assert.equal(unknown.body.message, wrong.body.message);
    });

    test('refuses a deactivated account', async () => {
        await seedAdmin({ is_active: false });

        const res = await request(app)
            .post('/api/auth/login')
            .send({ email: 'admin@school.et', password: 'correct-horse-battery' });

        assert.equal(res.status, 401);
        assert.match(res.body.message, /deactivated/i);
    });

    test('validates the payload', async () => {
        const res = await request(app).post('/api/auth/login').send({ email: 'not-an-email' });
        assert.equal(res.status, 400);
    });
});

describe('authentication middleware', () => {
    beforeEach(seedAdmin);

    test('rejects a request with no token', async () => {
        const res = await request(app).get('/api/auth/me');
        assert.equal(res.status, 401);
    });

    test('rejects a malformed token', async () => {
        const res = await request(app).get('/api/auth/me').auth('not-a-real-token');
        assert.equal(res.status, 401);
    });

    test('rejects a token signed with the wrong secret', async () => {
        const forged = jwt.sign({ sub: ADMIN, role: 'admin' }, 'attacker-secret', {
            issuer: 'bisnoc-sms',
            audience: 'bisnoc-sms-client',
        });

        const res = await request(app).get('/api/auth/me').auth(forged);
        assert.equal(res.status, 401);
    });

    test('rejects an expired token', async () => {
        const expired = jwt.sign({ sub: ADMIN, role: 'admin' }, process.env.JWT_SECRET, {
            issuer: 'bisnoc-sms',
            audience: 'bisnoc-sms-client',
            expiresIn: '-1s',
        });

        const res = await request(app).get('/api/auth/me').auth(expired);
        assert.equal(res.status, 401);
        assert.match(res.body.message, /expired/i);
    });

    test('accepts a valid token and returns the profile', async () => {
        const login = await request(app)
            .post('/api/auth/login')
            .send({ email: 'admin@school.et', password: 'correct-horse-battery' });

        const res = await request(app).get('/api/auth/me').auth(login.body.token);

        assert.equal(res.status, 200);
        assert.equal(res.body.user.id, ADMIN);
    });

    test('a token for a since-deactivated user stops working immediately', async () => {
        const login = await request(app)
            .post('/api/auth/login')
            .send({ email: 'admin@school.et', password: 'correct-horse-battery' });

        // Deactivate after the token was issued.
        await seedAdmin({ is_active: false });

        const res = await request(app).get('/api/auth/me').auth(login.body.token);
        assert.equal(res.status, 401);
    });
});

describe('POST /api/auth/telegram', () => {
    beforeEach(() => {
        reset({
            users: [
                {
                    id: ADMIN,
                    school_id: SCHOOL,
                    name: 'Test Admin',
                    email: 'admin@school.et',
                    password_hash: 'x',
                    role: 'admin',
                    is_active: true,
                    telegram_id: 987654321,
                    telegram_username: 'test_staff',
                    last_login_at: null,
                },
            ],
        });
    });

    test('signs in a staff member with a linked Telegram account', async () => {
        const res = await request(app)
            .post('/api/auth/telegram')
            .send(signedTelegramPayload());

        assert.equal(res.status, 200);
        assert.ok(res.body.token, 'expected a token');
        assert.equal(res.body.user.id, ADMIN);
        assert.equal(res.body.user.telegramId, 987654321);
        assert.equal(res.body.user.telegramUsername, 'test_staff');
    });

    test('rejects a payload whose signature does not match', async () => {
        const payload = signedTelegramPayload();
        payload.first_name = 'Tampered';

        const res = await request(app)
            .post('/api/auth/telegram')
            .send(payload);

        assert.equal(res.status, 401);
    });

    test('rejects a payload missing the hash', async () => {
        const payload = signedTelegramPayload();
        delete payload.hash;

        const res = await request(app)
            .post('/api/auth/telegram')
            .send(payload);

        assert.equal(res.status, 400);
    });

    test('rejects an expired auth_date (replay)', async () => {
        const payload = signedTelegramPayload({ auth_date: Math.floor(Date.now() / 1000) - 3600 });

        const res = await request(app)
            .post('/api/auth/telegram')
            .send(payload);

        assert.equal(res.status, 401);
    });

    test('rejects an unlinked Telegram account', async () => {
        const res = await request(app)
            .post('/api/auth/telegram')
            .send(signedTelegramPayload({ id: 111222333, username: 'stranger' }));

        assert.equal(res.status, 401);
        assert.match(res.body.message, /not linked/i);
    });

    test('refuses a linked but deactivated account', async () => {
        const { rowsOf } = require('./helpers');
        rowsOf('users')[0].is_active = false;

        const res = await request(app)
            .post('/api/auth/telegram')
            .send(signedTelegramPayload());

        assert.equal(res.status, 401);
        assert.match(res.body.message, /deactivated/i);
    });

    test('captures the Telegram username at sign-in when missing', async () => {
        const { rowsOf } = require('./helpers');
        rowsOf('users')[0].telegram_username = null;

        const res = await request(app)
            .post('/api/auth/telegram')
            .send(signedTelegramPayload());

        assert.equal(res.status, 200);
        assert.equal(res.body.user.telegramUsername, 'test_staff');
    });
});

describe('GET /api/auth/telegram-config', () => {
    test('exposes the bot username so the login page can render the widget', async () => {
        const res = await request(app).get('/api/auth/telegram-config');

        assert.equal(res.status, 200);
        assert.equal(res.body.enabled, true);
        assert.equal(res.body.botUsername, 'bis_noc_test_bot');
    });
});

describe('POST /api/auth/link-telegram (self-service linking)', () => {
    const TEACHER = '5be2c1a4-9f0d-4c1b-8a6e-2d3f4a5b6c7d';

    beforeEach(() => {
        reset({
            users: [
                {
                    id: ADMIN,
                    school_id: SCHOOL,
                    name: 'Test Admin',
                    email: 'admin@school.et',
                    password_hash: 'x',
                    role: 'admin',
                    is_active: true,
                    telegram_id: null,
                    telegram_username: null,
                },
                {
                    id: TEACHER,
                    school_id: SCHOOL,
                    name: 'Test Teacher',
                    email: 'teacher@school.et',
                    password_hash: 'x',
                    role: 'main_teacher',
                    is_active: true,
                    telegram_id: null,
                    telegram_username: null,
                },
            ],
        });
    });

    const teacherToken = () => signToken({ id: TEACHER, role: 'main_teacher' });

    test('links a verified Telegram account to the signed-in user', async () => {
        const res = await request(app)
            .post('/api/auth/link-telegram')
            .auth(teacherToken())
            .send(signedTelegramPayload());

        assert.equal(res.status, 200);
        assert.equal(res.body.user.id, TEACHER);
        assert.equal(res.body.user.telegramId, 987654321);
        assert.equal(res.body.user.telegramUsername, 'test_staff');

        // And the account can now actually sign in with Telegram.
        const login = await request(app)
            .post('/api/auth/telegram')
            .send(signedTelegramPayload());

        assert.equal(login.status, 200);
        assert.equal(login.body.user.id, TEACHER);
    });

    test('rejects a forged payload', async () => {
        const payload = signedTelegramPayload();
        payload.id = 555;

        const res = await request(app)
            .post('/api/auth/link-telegram')
            .auth(teacherToken())
            .send(payload);

        assert.equal(res.status, 401);
    });

    test('rejects a Telegram account already linked to someone else', async () => {
        const { rowsOf } = require('./helpers');
        rowsOf('users')[0].telegram_id = 987654321;

        const res = await request(app)
            .post('/api/auth/link-telegram')
            .auth(teacherToken())
            .send(signedTelegramPayload());

        assert.equal(res.status, 409);
        assert.match(res.body.message, /already linked/i);
    });

    test('requires authentication', async () => {
        const res = await request(app)
            .post('/api/auth/link-telegram')
            .send(signedTelegramPayload());

        assert.equal(res.status, 401);
    });
});

describe('DELETE /api/auth/link-telegram', () => {
    beforeEach(() => {
        reset({
            users: [
                {
                    id: ADMIN,
                    school_id: SCHOOL,
                    name: 'Test Admin',
                    email: 'admin@school.et',
                    password_hash: 'x',
                    role: 'admin',
                    is_active: true,
                    telegram_id: 987654321,
                    telegram_username: 'test_staff',
                },
            ],
        });
    });

    test('unlinks the signed-in user and revokes Telegram sign-in', async () => {
        const token = signToken({ id: ADMIN, role: 'admin' });

        const res = await request(app).delete('/api/auth/link-telegram').auth(token);

        assert.equal(res.status, 200);
        assert.equal(res.body.user.telegramId, null);

        const login = await request(app)
            .post('/api/auth/telegram')
            .send(signedTelegramPayload());

        assert.equal(login.status, 401);
    });

    test('requires authentication', async () => {
        const res = await request(app).delete('/api/auth/link-telegram');
        assert.equal(res.status, 401);
    });
});
