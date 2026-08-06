const { test, describe, beforeEach } = require('node:test');
const assert = require('node:assert/strict');

const { reset } = require('./helpers');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const request = require('./request');
const app = require('../app');

const SCHOOL = '0a5eae91-5307-4125-b24f-876bb3f529b8';
const ADMIN = 'd4f1a2b8-7c63-4e59-9f21-3a8e6b0d5c74';

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
