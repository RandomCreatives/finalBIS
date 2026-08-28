const { test, describe, beforeEach } = require('node:test');
const assert = require('node:assert/strict');

const { reset, supabaseStub } = require('./helpers');
const request = require('./request');
const app = require('../app');

const SCHOOL = '0a5eae91-5307-4125-b24f-876bb3f529b8';
const YEAR = 'f1c9d3e2-4b7a-4c81-9d6e-5a2f8b3c1d40';
const CLASS_A = '713bfeaa-d141-44f0-864a-cee594efb105';
const CLASS_B = '2c4e6a80-1f3d-4b5c-8e7a-9d0f1b2c3e45';
const SUBJ_ENG = 'e8c792f8-5e0f-4a8b-96e6-9a07ea4c932a';
const SUBJ_FRA = 'a9d8c7b6-5e4f-4a3b-9c8d-7e6f5a4b3c2d';

const user = (id, role, name, extra = {}) => ({
    id, school_id: SCHOOL, name, email: `${name.toLowerCase()}@school.et`,
    password_hash: '$2a$12$x', role, is_active: true, ...extra,
});

const ADMIN = user('b7180a79-119a-4dfb-9934-aa683058abf6', 'admin', 'Admin');
const MAIN_A = user('82e61fbc-9942-415c-909c-f408360a2ef4', 'main_teacher', 'Meron');
const MAIN_B = user('7d3e5f91-4a26-4c80-b5e3-9f1a7c2d6b48', 'main_teacher', 'Bekele', { is_active: false });
const ENG_T = user('343d1a63-716b-492c-88ca-f466c50aea97', 'subject_teacher', 'Dawit');
const ASSIST = user('43d3dcca-5eba-4682-b5e5-9be5d3e9836c', 'assistant_teacher', 'Sara');
const STORE = user('d4e5f6a7-b8c9-4d0e-1f2a-3b4c5d6e7f80', 'store_manager', 'Kebede');

const tables = () => ({
    schools: [{ id: SCHOOL, name: 'BIS NOC Gerji' }],
    users: [ADMIN, MAIN_A, MAIN_B, ENG_T, ASSIST, STORE],
    academic_years: [{ id: YEAR, school_id: SCHOOL, name: '2026/2027', is_current: true }],
    classes: [
        { id: CLASS_A, school_id: SCHOOL, name: 'Year 4 - Blue', year_level: 4 },
        { id: CLASS_B, school_id: SCHOOL, name: 'Year 4 - Red', year_level: 4 },
    ],
    subjects: [
        { id: SUBJ_ENG, school_id: SCHOOL, name: 'English', code: 'ENG' },
        { id: SUBJ_FRA, school_id: SCHOOL, name: 'French', code: 'FRA' },
    ],
    class_staff: [
        { id: 'cs-a', school_id: SCHOOL, academic_year_id: YEAR, class_id: CLASS_A, user_id: MAIN_A.id, position: 'main' },
        // Assistants never appear in the directory, whatever their seat.
        { id: 'cs-b', school_id: SCHOOL, academic_year_id: YEAR, class_id: CLASS_A, user_id: ASSIST.id, position: 'assistant' },
    ],
    class_subjects: [
        { id: 'asg-1', school_id: SCHOOL, academic_year_id: YEAR, class_id: CLASS_A, subject_id: SUBJ_ENG, teacher_id: ENG_T.id },
        { id: 'asg-2', school_id: SCHOOL, academic_year_id: YEAR, class_id: CLASS_B, subject_id: SUBJ_ENG, teacher_id: ENG_T.id },
        { id: 'asg-3', school_id: SCHOOL, academic_year_id: YEAR, class_id: CLASS_A, subject_id: SUBJ_FRA, teacher_id: ENG_T.id },
    ],
});

beforeEach(() => {
    reset(tables());
    supabaseStub._rpc = {};
});

describe('GET /api/public/teachers (login-free directory)', () => {
    test('requires no token and lists only main and subject teachers', async () => {
        const res = await request(app).get('/api/public/teachers');

        assert.equal(res.status, 200);

        const names = res.body.teachers.map((t) => t.name).sort();
        assert.deepEqual(names, ['Dawit', 'Meron']);
        assert.ok(!names.includes('Admin'));
        assert.ok(!names.includes('Sara'));   // assistant
        assert.ok(!names.includes('Kebede')); // store manager
        assert.ok(!names.includes('Bekele')); // inactive main teacher
    });

    test('main teachers show their homeroom; subject teachers show subjects across classes', async () => {
        const res = await request(app).get('/api/public/teachers');

        const meron = res.body.teachers.find((t) => t.name === 'Meron');
        assert.equal(meron.role, 'main_teacher');
        assert.deepEqual(meron.classes, ['Year 4 - Blue']);

        const dawit = res.body.teachers.find((t) => t.name === 'Dawit');
        assert.equal(dawit.role, 'subject_teacher');
        assert.deepEqual(dawit.subjects, [
            { name: 'English', classCount: 2 },
            { name: 'French', classCount: 1 },
        ]);
    });

    test('never exposes emails or account details', async () => {
        const res = await request(app).get('/api/public/teachers');

        assert.equal(res.status, 200);
        assert.ok(!JSON.stringify(res.body).includes('@school.et'));
        assert.ok(!JSON.stringify(res.body).includes('password'));
        for (const t of res.body.teachers) {
            assert.deepEqual(Object.keys(t).sort(), ['classes', 'name', 'role', 'subjects']);
        }
    });
});
