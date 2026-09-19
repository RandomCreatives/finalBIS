const { test, describe, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const bcrypt = require('bcryptjs');

const { reset } = require('./helpers');
const request = require('./request');
const app = require('../app');

const SCHOOL = '0a5eae91-5307-4125-b24f-876bb3f529b8';
const PASSWORD = 'correct-horse-battery';

const teacher = (id, name, active = true, role = 'subject_teacher') => ({
    id, school_id: SCHOOL, name, email: `${name.toLowerCase().replace(/\s+/g, '.')}@school.et`,
    password_hash: bcrypt.hashSync(PASSWORD, 4), role, is_active: active,
});

const T1 = teacher('8b2f1a2c-1111-4111-8111-0000000000a1', 'English Teacher 1');
const T2 = teacher('8b2f1a2c-2222-4222-8222-0000000000a2', 'Amharic Teacher 1');
const INACTIVE = teacher('8b2f1a2c-3333-4333-8333-0000000000a3', 'English Teacher 4', false);
const MAIN = teacher('8b2f1a2c-4444-4444-8444-0000000000a4', 'Meron Abebe', true, 'main_teacher');
const ADMIN = teacher('8b2f1a2c-5555-4555-8555-0000000000a5', 'School Admin', true, 'admin');

beforeEach(() => {
    reset({
        schools: [{ id: SCHOOL, name: 'BIS NOC Gerji' }],
        users: [T1, T2, INACTIVE, MAIN, ADMIN],
    });
});

describe('GET /api/auth/subject-teachers (card directory)', () => {
    test('lists active subject teachers only, safe fields', async () => {
        const res = await request(app).get('/api/auth/subject-teachers');

        assert.equal(res.status, 200);
        const names = res.body.teachers.map((t) => t.name).sort();
        assert.deepEqual(names, ['Amharic Teacher 1', 'English Teacher 1']);
        // No emails, hashes or roles leak to the public directory.
        for (const t of res.body.teachers) {
            assert.deepEqual(Object.keys(t).sort(), ['id', 'name']);
        }
        // Inactive and non-subject teachers are excluded.
        assert.ok(!names.includes('English Teacher 4'));
        assert.ok(!names.includes('Meron Abebe'));
        assert.ok(!names.includes('School Admin'));
    });
});

describe('POST /api/auth/subject-teacher-login (teacher-card sign-in)', () => {
    test('correct password signs in and returns a token + profile', async () => {
        const res = await request(app)
            .post('/api/auth/subject-teacher-login')
            .send({ teacherId: T1.id, password: PASSWORD });

        assert.equal(res.status, 200);
        assert.ok(res.body.token, 'expected a JWT');
        assert.equal(res.body.user.name, 'English Teacher 1');
        assert.equal(res.body.user.role, 'subject_teacher');
    });

    test('wrong password is refused', async () => {
        const res = await request(app)
            .post('/api/auth/subject-teacher-login')
            .send({ teacherId: T1.id, password: 'not-the-password' });

        assert.equal(res.status, 401);
        assert.ok(!res.body.token);
    });

    test('an id that is not a subject teacher is refused', async () => {
        const res = await request(app)
            .post('/api/auth/subject-teacher-login')
            .send({ teacherId: MAIN.id, password: PASSWORD });

        assert.equal(res.status, 401);
        assert.match(res.body.message, /not a subject-teacher/i);

        const admin = await request(app)
            .post('/api/auth/subject-teacher-login')
            .send({ teacherId: ADMIN.id, password: PASSWORD });
        assert.equal(admin.status, 401);
    });

    test('a deactivated subject teacher is refused', async () => {
        const res = await request(app)
            .post('/api/auth/subject-teacher-login')
            .send({ teacherId: INACTIVE.id, password: PASSWORD });

        assert.equal(res.status, 401);
        assert.match(res.body.message, /deactivated/i);
    });

    test('missing fields fail validation', async () => {
        const res = await request(app)
            .post('/api/auth/subject-teacher-login')
            .send({ teacherId: 'not-a-uuid' });

        assert.equal(res.status, 400);
    });
});
