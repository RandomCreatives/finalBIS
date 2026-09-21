const { test, describe, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const bcrypt = require('bcryptjs');

const { reset } = require('./helpers');
const request = require('./request');
const app = require('../app');

const SCHOOL = '0a5eae91-5307-4125-b24f-876bb3f529b8';
const YEAR = '4f7aeca3-8acb-4a14-b2c7-b5462818211e';
const PASSWORD = 'correct-horse-battery';

const SUBJ_ENG = '5ca1ab1e-0000-4000-8000-0000000000e1';
const SUBJ_AMH = '5ca1ab1e-0000-4000-8000-0000000000a1';
const SUBJ_SPL = '5ca1ab1e-0000-4000-8000-000000000051';
const SUBJ_MAT = '5ca1ab1e-0000-4000-8000-0000000000a7';
const SUBJ_REG = '5ca1ab1e-0000-4000-8000-0000000000e6';

const teacher = (id, name, active = true, role = 'subject_teacher') => ({
    id, school_id: SCHOOL, name, email: `${name.toLowerCase().replace(/\s+/g, '.')}@school.et`,
    password_hash: bcrypt.hashSync(PASSWORD, 4), role, is_active: active,
});

const T1 = teacher('8b2f1a2c-1111-4111-8111-0000000000a1', 'English Teacher 1');
const T2 = teacher('8b2f1a2c-2222-4222-8222-0000000000a2', 'Amharic Teacher 1');
const INACTIVE = teacher('8b2f1a2c-3333-4333-8333-0000000000a3', 'English Teacher 4', false);
const REAL = teacher('8b2f1a2c-6666-4666-8666-0000000000a6', 'Dihurwe Desire');
const SEATLESS = teacher('8b2f1a2c-7777-4777-8777-0000000000a7', 'Abeba Wendifraw Dinku');
const MAIN = teacher('8b2f1a2c-4444-4444-8444-0000000000a4', 'Meron Abebe', true, 'main_teacher');
const ADMIN = teacher('8b2f1a2c-5555-4555-8555-0000000000a5', 'School Admin', true, 'admin');

const seat = (id, teacherId, subjectId) => ({
    id, school_id: SCHOOL, academic_year_id: YEAR, class_id: 'c1', subject_id: subjectId,
    teacher_id: teacherId, sessions_per_week: 2,
});

const tables = () => ({
    schools: [{ id: SCHOOL, name: 'BIS NOC Gerji' }],
    users: [T1, T2, INACTIVE, REAL, SEATLESS, MAIN, ADMIN],
    academic_years: [{ id: YEAR, school_id: SCHOOL, name: '2026/2027', is_current: true }],
    subjects: [
        { id: SUBJ_ENG, school_id: SCHOOL, name: 'English', code: 'ENG' },
        { id: SUBJ_AMH, school_id: SCHOOL, name: 'Amharic', code: 'AMH' },
        { id: SUBJ_SPL, school_id: SCHOOL, name: 'Spelling', code: 'SPL' },
        { id: SUBJ_MAT, school_id: SCHOOL, name: 'Mathematics', code: 'MAT' },
        { id: SUBJ_REG, school_id: SCHOOL, name: 'Registration', code: 'REG' },
    ],
    class_subjects: [
        seat('seat-1', T1.id, SUBJ_ENG),
        seat('seat-2', T1.id, SUBJ_REG),       // fixture — never a wall subject
        seat('seat-3', T2.id, SUBJ_AMH),
        seat('seat-4', INACTIVE.id, SUBJ_ENG), // deactivated — seat or not, no card
        seat('seat-5', REAL.id, SUBJ_ENG),
        seat('seat-6', REAL.id, SUBJ_ENG),
        seat('seat-7', REAL.id, SUBJ_ENG),
        seat('seat-8', REAL.id, SUBJ_SPL),
        seat('seat-9', REAL.id, SUBJ_SPL),
        seat('seat-10', MAIN.id, SUBJ_MAT),    // main teachers never appear
    ],
});

beforeEach(() => {
    reset(tables());
});

describe('GET /api/auth/subject-teachers (card directory)', () => {
    test('lists active seat-holding subject teachers with their subjects, safe fields', async () => {
        const res = await request(app).get('/api/auth/subject-teachers');

        assert.equal(res.status, 200);
        const names = res.body.teachers.map((t) => t.name).sort();
        // Seat holders only: placeholders still staffing seats + named teachers.
        assert.deepEqual(names, ['Amharic Teacher 1', 'Dihurwe Desire', 'English Teacher 1']);
        // No emails, hashes or roles leak to the public directory.
        for (const t of res.body.teachers) {
            assert.deepEqual(Object.keys(t).sort(), ['id', 'name', 'subjects']);
        }
        // Inactive (even with seats), seatless and non-subject teachers are excluded.
        for (const absent of ['English Teacher 4', 'Abeba Wendifraw Dinku', 'Meron Abebe', 'School Admin']) {
            assert.ok(!names.includes(absent), `${absent} should not appear`);
        }
    });

    test('subjects are aggregated with seat counts, most seats first; fixtures excluded', async () => {
        const res = await request(app).get('/api/auth/subject-teachers');

        assert.equal(res.status, 200);
        const real = res.body.teachers.find((t) => t.name === 'Dihurwe Desire');
        assert.deepEqual(real.subjects, [
            { code: 'ENG', name: 'English', seats: 3 },
            { code: 'SPL', name: 'Spelling', seats: 2 },
        ]);
        // Registration seats never surface as a teaching subject.
        const t1 = res.body.teachers.find((t) => t.name === 'English Teacher 1');
        assert.deepEqual(t1.subjects, [{ code: 'ENG', name: 'English', seats: 1 }]);
    });

    test('no current academic year means no cards at all', async () => {
        const seeded = tables();
        seeded.academic_years[0].is_current = false;
        reset(seeded);

        const res = await request(app).get('/api/auth/subject-teachers');

        assert.equal(res.status, 200);
        assert.deepEqual(res.body.teachers, []);
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
