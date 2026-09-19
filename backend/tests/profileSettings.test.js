const { test, describe, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const bcrypt = require('bcryptjs');
if (typeof globalThis.WebSocket === 'undefined') globalThis.WebSocket = require('ws');

const { reset } = require('./helpers');
const request = require('./request');
const app = require('../app');
const { signToken } = require('../middleware/auth');

const SCHOOL = '0a5eae91-5307-4125-b24f-876bb3f529b8';
const ADMIN = 'd4f1a2b8-7c63-4e59-9f21-3a8e6b0d5c74';
const SUBJECT = 'e5f2a3c9-8d74-4f6a-a032-4b9f7c1e8d95';
const MAIN = 'f6a3b4d0-9e85-4a7b-b143-5c0a8d2f9e06';

const seedAll = async () =>
    reset({
        users: [
            {
                id: ADMIN, school_id: SCHOOL, name: 'Test Admin',
                email: 'admin@school.et',
                password_hash: await bcrypt.hash('correct-horse-battery', 12),
                role: 'admin', is_active: true, phone: null,
            },
            {
                id: SUBJECT, school_id: SCHOOL, name: 'English Teacher 1',
                email: 'english.teacher.1@bisnocgerji.local',
                password_hash: await bcrypt.hash('BisNoc2026!', 12),
                role: 'subject_teacher', is_active: true, phone: null,
            },
            {
                id: MAIN, school_id: SCHOOL, name: 'Main Teacher',
                email: 'year3blue@bisnocgerji.local',
                password_hash: await bcrypt.hash('whatever-hash', 12),
                role: 'main_teacher', is_active: true, phone: null,
            },
        ],
    });

const tokenFor = (id, role) =>
    signToken({ id, role, school_id: SCHOOL, is_active: true });

describe('PATCH /api/auth/profile', () => {
    beforeEach(seedAll);

    test('admins can rename themselves', async () => {
        const res = await request(app)
            .patch('/api/auth/profile')
            .auth(tokenFor(ADMIN, 'admin'))
            .send({ name: 'Mr. Mike' });
        assert.equal(res.status, 200);
        assert.equal(res.body.user.name, 'Mr. Mike');
    });

    test('teachers cannot rename themselves — names are school-managed', async () => {
        const res = await request(app)
            .patch('/api/auth/profile')
            .auth(tokenFor(SUBJECT, 'subject_teacher'))
            .send({ name: 'Selam Tesfaye' });
        assert.equal(res.status, 403);
        assert.match(res.body.message, /managed by the school/);
    });

    test('any role can set a valid phone number', async () => {
        const res = await request(app)
            .patch('/api/auth/profile')
            .auth(tokenFor(SUBJECT, 'subject_teacher'))
            .send({ phone: '+251 91 123 4567' });
        assert.equal(res.status, 200);
        assert.equal(res.body.user.phone, '+251 91 123 4567');
    });

    test('phone-only update passes validation (name not required)', async () => {
        const res = await request(app)
            .patch('/api/auth/profile')
            .auth(tokenFor(ADMIN, 'admin'))
            .send({ phone: '0911234567' });
        assert.equal(res.status, 200);
        assert.equal(res.body.user.phone, '0911234567');
    });

    test('rejects a malformed phone number', async () => {
        const res = await request(app)
            .patch('/api/auth/profile')
            .auth(tokenFor(SUBJECT, 'subject_teacher'))
            .send({ phone: 'call-me-maybe' });
        assert.equal(res.status, 400);
    });

    test('rejects an empty update', async () => {
        const res = await request(app)
            .patch('/api/auth/profile')
            .auth(tokenFor(ADMIN, 'admin'))
            .send({});
        assert.equal(res.status, 400);
    });
});

describe('PATCH /api/auth/password', () => {
    beforeEach(seedAll);

    test('subject teachers can change their own password', async () => {
        const res = await request(app)
            .patch('/api/auth/password')
            .auth(tokenFor(SUBJECT, 'subject_teacher'))
            .send({ currentPassword: 'BisNoc2026!', newPassword: 'fresh-secret-42' });
        assert.equal(res.status, 200);

        const login = await request(app)
            .post('/api/auth/login')
            .send({ email: 'english.teacher.1@bisnocgerji.local', password: 'fresh-secret-42' });
        assert.equal(login.status, 200);
        assert.ok(login.body.token);
    });

    test('main teachers now have personal passwords too', async () => {
        const res = await request(app)
            .patch('/api/auth/password')
            .auth(tokenFor(MAIN, 'main_teacher'))
            .send({ currentPassword: 'whatever-hash', newPassword: 'brand-new-secret' });
        assert.equal(res.status, 200);

        const login = await request(app)
            .post('/api/auth/login')
            .send({ email: 'year3blue@bisnocgerji.local', password: 'brand-new-secret' });
        assert.equal(login.status, 200);
        assert.ok(login.body.token);
    });

    test('subject teacher password change still requires the current password', async () => {
        const res = await request(app)
            .patch('/api/auth/password')
            .auth(tokenFor(SUBJECT, 'subject_teacher'))
            .send({ currentPassword: 'wrong', newPassword: 'fresh-secret-42' });
        assert.equal(res.status, 400);
    });
});

/* ── admin reset ("revoke to basic") ─────────────────────── */
const YEAR = '1a2b3c4d-5e6f-4a5b-8c9d-0e1f2a3b4c5d';
const CLASS_Y3B = '2b3c4d5e-6f7a-4b5c-9d0e-1f2a3b4c5d6e';

const seedWithSeat = async () => {
    await seedAll();
    reset({
        users: [
            { id: ADMIN, school_id: SCHOOL, name: 'Test Admin', email: 'admin@school.et',
              password_hash: await bcrypt.hash('correct-horse-battery', 12), role: 'admin', is_active: true },
            { id: SUBJECT, school_id: SCHOOL, name: 'English Teacher 1', email: 'english.teacher.1@bisnocgerji.local',
              password_hash: await bcrypt.hash('lost-password', 12), role: 'subject_teacher', is_active: true },
            { id: MAIN, school_id: SCHOOL, name: 'Main Teacher', email: 'year3blue@bisnocgerji.local',
              password_hash: await bcrypt.hash('lost-password', 12), role: 'main_teacher', is_active: true },
        ],
        academic_years: [{ id: YEAR, school_id: SCHOOL, name: '2026/2027', is_current: true }],
        classes: [{ id: CLASS_Y3B, school_id: SCHOOL, name: 'Year 3 - Blue' }],
        class_staff: [{ academic_year_id: YEAR, class_id: CLASS_Y3B, user_id: MAIN, position: 'main' }],
    });
};

describe('POST /api/auth/reset-password/:userId', () => {
    beforeEach(seedWithSeat);

    test('subject teacher is revoked to BisNoc2026! and can sign in with it', async () => {
        const res = await request(app)
            .post(`/api/auth/reset-password/${SUBJECT}`)
            .auth(tokenFor(ADMIN, 'admin'));
        assert.equal(res.status, 200);
        assert.equal(res.body.basic, 'BisNoc2026!');

        const login = await request(app)
            .post('/api/auth/login')
            .send({ email: 'english.teacher.1@bisnocgerji.local', password: 'BisNoc2026!' });
        assert.equal(login.status, 200);
        assert.ok(login.body.token);
    });

    test('main teacher is revoked to their class card password', async () => {
        const res = await request(app)
            .post(`/api/auth/reset-password/${MAIN}`)
            .auth(tokenFor(ADMIN, 'admin'));
        assert.equal(res.status, 200);
        assert.equal(res.body.basic, 'year 3 blue');
        assert.match(res.body.message, /class card password/);

        const login = await request(app)
            .post('/api/auth/login')
            .send({ email: 'year3blue@bisnocgerji.local', password: 'year 3 blue' });
        assert.equal(login.status, 200);
    });

    test('main teacher without a class seat cannot be auto-revoked', async () => {
        reset({
            users: [
                { id: ADMIN, school_id: SCHOOL, name: 'Test Admin', email: 'a@a.et',
                  password_hash: 'x', role: 'admin', is_active: true },
                { id: MAIN, school_id: SCHOOL, name: 'Main Teacher', email: 'm@m.et',
                  password_hash: 'x', role: 'main_teacher', is_active: true },
            ],
            academic_years: [{ id: YEAR, school_id: SCHOOL, is_current: true }],
            classes: [],
            class_staff: [],
        });
        const res = await request(app)
            .post(`/api/auth/reset-password/${MAIN}`)
            .auth(tokenFor(ADMIN, 'admin'));
        assert.equal(res.status, 400);
        assert.match(res.body.message, /no class|seats no class/);
    });

    test('administrator accounts are excluded from reset', async () => {
        const res = await request(app)
            .post(`/api/auth/reset-password/${ADMIN}`)
            .auth(tokenFor(ADMIN, 'admin'));
        assert.equal(res.status, 400);
        assert.match(res.body.message, /Administrator passwords/);
    });

    test('only admins can revoke passwords', async () => {
        const res = await request(app)
            .post(`/api/auth/reset-password/${MAIN}`)
            .auth(tokenFor(SUBJECT, 'subject_teacher'));
        assert.equal(res.status, 403);
    });
});

describe('Telegram login is grayed out while the bot is unfinished', () => {
    beforeEach(seedAll);

    test('POST /auth/telegram is refused with a clear message', async () => {
        const res = await request(app)
            .post('/api/auth/telegram')
            .send({ id: 1, first_name: 'Nope', auth_date: 1, hash: 'junk' });
        assert.equal(res.status, 403);
        assert.match(res.body.message, /temporarily disabled/);
    });

    test('telegram-config advertises loginEnabled=false', async () => {
        const res = await request(app).get('/api/auth/telegram-config');
        assert.equal(res.status, 200);
        assert.equal(res.body.loginEnabled, false);
    });
});
