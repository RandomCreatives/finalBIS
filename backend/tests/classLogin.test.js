const { test, describe, beforeEach } = require('node:test');
const assert = require('node:assert/strict');

const { reset, supabaseStub } = require('./helpers');
const request = require('./request');
const app = require('../app');

const SCHOOL = '0a5eae91-5307-4125-b24f-876bb3f529b8';
const YEAR = 'f1c9d3e2-4b7a-4c81-9d6e-5a2f8b3c1d40';
const CLASS_A = '713bfeaa-d141-44f0-864a-cee594efb105';
const CLASS_B = '2c4e6a80-1f3d-4b5c-8e7a-9d0f1b2c3e45';

const user = (id, role, name) => ({
    id, school_id: SCHOOL, name, email: `${name.toLowerCase().replace(/\s+/g, '.')}@school.et`,
    password_hash: '$2a$12$x', role, is_active: true,
});

const MAIN_A = user('82e61fbc-9942-415c-909c-f408360a2ef4', 'main_teacher', 'Meron Abebe');

const tables = () => ({
    schools: [{ id: SCHOOL, name: 'BIS NOC Gerji' }],
    users: [MAIN_A],
    academic_years: [{ id: YEAR, school_id: SCHOOL, name: '2026/2027', is_current: true }],
    classes: [
        { id: CLASS_A, school_id: SCHOOL, name: 'Year 4 - Blue', year_level: 4, capacity: 30 },
        { id: CLASS_B, school_id: SCHOOL, name: 'Year 4 - Red', year_level: 4, capacity: 30 },
    ],
    class_staff: [
        { id: 'cs-a', school_id: SCHOOL, academic_year_id: YEAR, class_id: CLASS_A, user_id: MAIN_A.id, position: 'main' },
        // Year 4 - Red deliberately has NO main teacher seat.
    ],
    class_subjects: [],
});

beforeEach(() => {
    reset(tables());
    supabaseStub._rpc = {};
});

describe('POST /api/auth/class-login (class-card sign-in)', () => {
    test('correct password signs in as the class main teacher and returns a token', async () => {
        const res = await request(app)
            .post('/api/auth/class-login')
            .send({ className: 'Year 4 - Blue', password: 'year 4 blue' });

        assert.equal(res.status, 200);
        assert.ok(res.body.token, 'expected a JWT');
        assert.equal(res.body.user.name, 'Meron Abebe');
        assert.equal(res.body.user.role, 'main_teacher');
        assert.equal(res.body.class.name, 'Year 4 - Blue');
        assert.equal(res.body.class.id, CLASS_A);
    });

    test('password comparison ignores case and punctuation', async () => {
        const res = await request(app)
            .post('/api/auth/class-login')
            .send({ className: 'Year 4 - Blue', password: 'YEAR-4-BLUE' });

        assert.equal(res.status, 200);
    });

    test('wrong password is refused', async () => {
        const res = await request(app)
            .post('/api/auth/class-login')
            .send({ className: 'Year 4 - Blue', password: 'year 4 red' });

        assert.equal(res.status, 401);
        assert.ok(!res.body.token);
    });

    test('unknown class is refused', async () => {
        const res = await request(app)
            .post('/api/auth/class-login')
            .send({ className: 'Year 9 - Gold', password: 'year 9 gold' });

        assert.equal(res.status, 404);
    });

    test('a class without a main teacher cannot be signed into', async () => {
        const res = await request(app)
            .post('/api/auth/class-login')
            .send({ className: 'Year 4 - Red', password: 'year 4 red' });

        assert.equal(res.status, 401);
        assert.match(res.body.message, /no main teacher/i);
    });

    test('missing fields fail validation', async () => {
        const res = await request(app)
            .post('/api/auth/class-login')
            .send({ className: 'Year 4 - Blue' });

        assert.equal(res.status, 400);
    });
});
