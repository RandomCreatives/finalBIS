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

    test('main teachers use the class card — no self-service password', async () => {
        const res = await request(app)
            .patch('/api/auth/password')
            .auth(tokenFor(MAIN, 'main_teacher'))
            .send({ currentPassword: 'x', newPassword: 'brand-new-secret' });
        assert.equal(res.status, 403);
        assert.match(res.body.message, /class card/);
    });

    test('subject teacher password change still requires the current password', async () => {
        const res = await request(app)
            .patch('/api/auth/password')
            .auth(tokenFor(SUBJECT, 'subject_teacher'))
            .send({ currentPassword: 'wrong', newPassword: 'fresh-secret-42' });
        assert.equal(res.status, 400);
    });
});
