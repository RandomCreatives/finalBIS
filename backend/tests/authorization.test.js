const { test, describe, beforeEach } = require('node:test');
const assert = require('node:assert/strict');

const { reset } = require('./helpers');
const bcrypt = require('bcryptjs');
const request = require('./request');
const app = require('../app');
const { signToken } = require('../middleware/auth');

const SCHOOL = '0a5eae91-5307-4125-b24f-876bb3f529b8';
const CLASS_ID = '713bfeaa-d141-44f0-864a-cee594efb105';

const user = (id, role) => ({
    id,
    school_id: SCHOOL,
    name: `${role} user`,
    email: `${role}@school.et`,
    password_hash: '$2a$12$placeholderplaceholderplaceholderplaceholderplaceholder',
    role,
    is_active: true,
});

const ADMIN = user('b7180a79-119a-4dfb-9934-aa683058abf6', 'admin');
const MAIN = user('82e61fbc-9942-415c-909c-f408360a2ef4', 'main_teacher');
const ASSISTANT = user('43d3dcca-5eba-4682-b5e5-9be5d3e9836c', 'assistant_teacher');
const SUBJECT = user('343d1a63-716b-492c-88ca-f466c50aea97', 'subject_teacher');

const tokenFor = (u) => signToken(u);

beforeEach(() => {
    reset({
        users: [ADMIN, MAIN, ASSISTANT, SUBJECT],
        classes: [{ id: CLASS_ID, school_id: SCHOOL, name: 'Year 3', teacher_id: null }],
        students: [],
        clinic_visits: [],
    });
});

describe('every endpoint requires authentication', () => {
    const protectedRoutes = [
        ['get', '/api/students'],
        ['get', '/api/classes'],
        ['get', '/api/subjects'],
        ['get', '/api/users'],
        ['get', '/api/notices'],
        ['get', '/api/library/loans'],
        ['get', '/api/clinic/visits'],
        ['get', '/api/dashboard/summary'],
        ['post', '/api/students'],
        ['post', '/api/classes'],
        ['post', '/api/attendance'],
        ['put', '/api/marksheets'],
    ];

    for (const [method, path] of protectedRoutes) {
        test(`${method.toUpperCase()} ${path} → 401 without a token`, async () => {
            const res = await request(app)[method](path).send({});
            assert.equal(res.status, 401, `${path} should reject anonymous access`);
        });
    }
});

describe('role-based authorization', () => {
    test('a subject teacher cannot create a class', async () => {
        const res = await request(app)
            .post('/api/classes')
            .auth(tokenFor(SUBJECT))
            .send({ name: 'Year 4' });

        assert.equal(res.status, 403);
    });

    test('an admin can create a class', async () => {
        const res = await request(app)
            .post('/api/classes')
            .auth(tokenFor(ADMIN))
            .send({ name: 'Year 4' });

        assert.equal(res.status, 201);
        assert.equal(res.body.class.name, 'Year 4');
    });

    test('a teacher cannot list or manage staff accounts', async () => {
        const list = await request(app).get('/api/users').auth(tokenFor(MAIN));
        assert.equal(list.status, 403);

        const create = await request(app)
            .post('/api/users')
            .auth(tokenFor(MAIN))
            .send({ name: 'X', email: 'x@school.et', password: 'longenoughpw', role: 'admin' });
        assert.equal(create.status, 403);
    });

    test('an assistant teacher cannot transfer a student', async () => {
        const res = await request(app)
            .post('/api/students/57132c20-3d92-4c8d-83ce-93f08eb3a083/transfer')
            .auth(tokenFor(ASSISTANT))
            .send({ toClassId: CLASS_ID });

        assert.equal(res.status, 403);
    });

    test('only an admin may approve clinic leave', async () => {
        const denied = await request(app)
            .post('/api/clinic/visits/c21fc069-a20f-42d9-b800-8963c48a5ce3/leave')
            .auth(tokenFor(MAIN))
            .send({ decision: 'approved' });

        assert.equal(denied.status, 403);
    });

    test('a subject teacher may still record attendance', async () => {
        const res = await request(app)
            .post('/api/attendance')
            .auth(tokenFor(SUBJECT))
            .send({
                classId: CLASS_ID,
                date: '2026-03-01',
                records: [{ studentId: '57132c20-3d92-4c8d-83ce-93f08eb3a083', status: 'present' }],
            });

        assert.equal(res.status, 201);
    });
});

describe('input validation', () => {
    test('rejects a non-UUID path parameter', async () => {
        const res = await request(app).get('/api/students/not-a-uuid').auth(tokenFor(ADMIN));
        assert.equal(res.status, 400);
    });

    test('rejects an invalid attendance status', async () => {
        const res = await request(app)
            .post('/api/attendance')
            .auth(tokenFor(ADMIN))
            .send({
                classId: CLASS_ID,
                date: '2026-03-01',
                records: [{ studentId: '57132c20-3d92-4c8d-83ce-93f08eb3a083', status: 'teleported' }],
            });

        assert.equal(res.status, 400);
    });

    test('rejects a marksheet with a malformed term reference', async () => {
        const res = await request(app)
            .put('/api/marksheets')
            .auth(tokenFor(ADMIN))
            .send({
                studentId: '57132c20-3d92-4c8d-83ce-93f08eb3a083',
                subjectId: 'e8c792f8-5e0f-4a8b-96e6-9a07ea4c932a',
                termId: 'summer',
                marks: 50,
            });

        assert.equal(res.status, 400);
    });

    test('rejects a short password on creation', async () => {
        const res = await request(app)
            .post('/api/users')
            .auth(tokenFor(ADMIN))
            .send({ name: 'New', email: 'new@school.et', password: 'short', role: 'main_teacher' });

        assert.equal(res.status, 400);
    });

    test('an admin cannot deactivate their own account', async () => {
        const res = await request(app)
            .delete(`/api/users/${ADMIN.id}`)
            .auth(tokenFor(ADMIN));

        assert.equal(res.status, 400);
        assert.match(res.body.message, /your own account/i);
    });
});

describe('password hashing', () => {
    test('a created user is stored hashed, never in plaintext', async () => {
        const { rowsOf } = require('./helpers');

        await request(app)
            .post('/api/users')
            .auth(tokenFor(ADMIN))
            .send({
                name: 'New Teacher',
                email: 'teacher@school.et',
                password: 'a-very-secret-password',
                role: 'main_teacher',
            });

        const created = rowsOf('users').find((u) => u.email === 'teacher@school.et');

        assert.ok(created, 'user should have been created');
        assert.equal(created.password, undefined, 'no plaintext password column');
        assert.notEqual(created.password_hash, 'a-very-secret-password');
        assert.match(created.password_hash, /^\$2[aby]\$/, 'should be a bcrypt hash');
        assert.ok(await bcrypt.compare('a-very-secret-password', created.password_hash));
    });
});
