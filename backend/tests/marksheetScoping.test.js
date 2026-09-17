const { test, describe, beforeEach } = require('node:test');
const assert = require('node:assert/strict');

const { reset, rowsOf, supabaseStub } = require('./helpers');
const request = require('./request');
const app = require('../app');
const { signToken } = require('../middleware/auth');

const SCHOOL = '0a5eae91-5307-4125-b24f-876bb3f529b8';
const YEAR = 'f1c9d3e2-4b7a-4c81-9d6e-5a2f8b3c1d40';
const TERM_1 = '6b2f4d08-3b7a-4a5e-9d2c-1f8e6a4b0c93';
const CLASS_A = '713bfeaa-d141-44f0-864a-cee594efb105';
const CLASS_B = '2c4e6a80-1f3d-4b5c-8e7a-9d0f1b2c3e45';
const SUBJ_MAT = '3b7d9e15-8c2a-4f60-b1d4-7e5a9c0f2b38';
const SUBJ_SCI = 'e8c792f8-5e0f-4a8b-96e6-9a07ea4c932a';

const STU_A1 = 'a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d';
const STU_B1 = 'c3d4e5f6-a7b8-4c9d-9e1f-2a3b4c5d6e7f';

const MARK_A = 'd4e5f6a7-b8c9-4d0e-9f1a-2b3c4d5e6f70';
const MARK_B = 'e5f6a7b8-c9d0-4e1f-8a2b-3c4d5e6f7081';

const user = (id, role, name) => ({
    id, school_id: SCHOOL, name, email: `${name.toLowerCase()}@school.et`,
    password_hash: '$2a$12$x', role, is_active: true,
});

const ADMIN = user('b7180a79-119a-4dfb-9934-aa683058abf6', 'admin', 'Admin');
const MAIN_A = user('82e61fbc-9942-415c-909c-f408360a2ef4', 'main_teacher', 'Meron');
const MAIN_B = user('7d3e5f91-4a26-4c80-b5e3-9f1a7c2d6b48', 'main_teacher', 'Bekele');

const tokenFor = (u) => signToken(u);

const tables = () => ({
    schools: [{ id: SCHOOL, name: 'BIS NOC Gerji' }],
    users: [ADMIN, MAIN_A, MAIN_B],
    academic_years: [{ id: YEAR, school_id: SCHOOL, name: '2026/2027', is_current: true }],
    terms: [{ id: TERM_1, school_id: SCHOOL, academic_year_id: YEAR, term_index: 1, name: 'Term 1', is_current: true }],
    classes: [
        { id: CLASS_A, school_id: SCHOOL, name: 'Year 3A', capacity: 25 },
        { id: CLASS_B, school_id: SCHOOL, name: 'Year 3B', capacity: 25 },
    ],
    subjects: [
        { id: SUBJ_MAT, school_id: SCHOOL, name: 'Mathematics', code: 'MAT', taught_by: 'main_teacher' },
        { id: SUBJ_SCI, school_id: SCHOOL, name: 'Science', code: 'SCI', taught_by: 'main_teacher' },
    ],
    class_staff: [
        { id: 'cs-a', school_id: SCHOOL, academic_year_id: YEAR, class_id: CLASS_A, user_id: MAIN_A.id, position: 'main' },
        { id: 'cs-b', school_id: SCHOOL, academic_year_id: YEAR, class_id: CLASS_B, user_id: MAIN_B.id, position: 'main' },
    ],
    // MAIN_A teaches Maths AND Science in CLASS_A — the multi-row shape that
    // must never break access checks.
    class_subjects: [
        { id: 'asg-1', school_id: SCHOOL, academic_year_id: YEAR, class_id: CLASS_A, subject_id: SUBJ_MAT, teacher_id: MAIN_A.id, sessions_per_week: 6 },
        { id: 'asg-2', school_id: SCHOOL, academic_year_id: YEAR, class_id: CLASS_A, subject_id: SUBJ_SCI, teacher_id: MAIN_A.id, sessions_per_week: 5 },
    ],
    students: [
        { id: STU_A1, school_id: SCHOOL, name: 'Abel T', admission_no: 'A001', roll_num: 1, class_id: CLASS_A, is_active: true },
        { id: STU_B1, school_id: SCHOOL, name: 'Kebede M', admission_no: 'B001', roll_num: 1, class_id: CLASS_B, is_active: true },
    ],
    marksheets: [
        { id: MARK_A, school_id: SCHOOL, student_id: STU_A1, subject_id: SUBJ_MAT, class_id: CLASS_A, term_id: TERM_1, marks: 80, max_marks: 100, percentage: 80, grade: 'A', entered_by: MAIN_A.id },
        { id: MARK_B, school_id: SCHOOL, student_id: STU_B1, subject_id: SUBJ_MAT, class_id: CLASS_B, term_id: TERM_1, marks: 70, max_marks: 100, percentage: 70, grade: 'B+', entered_by: MAIN_B.id },
    ],
});

beforeEach(() => {
    reset(tables());
    supabaseStub._rpc = {};
});

describe('marksheet read scoping', () => {
    test('a main teacher reads their own class marks', async () => {
        const res = await request(app)
            .get(`/api/marksheets?classId=${CLASS_A}`)
            .auth(tokenFor(MAIN_A));

        assert.equal(res.status, 200);
        assert.equal(res.body.marksheets.length, 1);
        assert.equal(res.body.marksheets[0].student.name, 'Abel T');
    });

    test('a main teacher cannot read another class\'s marks', async () => {
        const res = await request(app)
            .get(`/api/marksheets?classId=${CLASS_B}`)
            .auth(tokenFor(MAIN_A));

        assert.equal(res.status, 403);
    });

    test('without a classId a teacher only gets their own classes\' marks', async () => {
        const res = await request(app)
            .get('/api/marksheets')
            .auth(tokenFor(MAIN_A));

        assert.equal(res.status, 200);
        assert.equal(res.body.marksheets.length, 1);
        assert.equal(res.body.marksheets[0].student.name, 'Abel T');
    });

    test('admin reads every class', async () => {
        const res = await request(app)
            .get('/api/marksheets')
            .auth(tokenFor(ADMIN));

        assert.equal(res.status, 200);
        assert.equal(res.body.marksheets.length, 2);
    });

    test('a per-student report is class-scoped too', async () => {
        const own = await request(app)
            .get(`/api/marksheets/student/${STU_A1}`)
            .auth(tokenFor(MAIN_A));
        assert.equal(own.status, 200);

        const foreign = await request(app)
            .get(`/api/marksheets/student/${STU_B1}`)
            .auth(tokenFor(MAIN_A));
        assert.equal(foreign.status, 403);
    });
});

describe('marksheet write + delete scoping', () => {
    test('a main teacher saves marks for their own class', async () => {
        const res = await request(app)
            .post('/api/marksheets/bulk')
            .auth(tokenFor(MAIN_A))
            .send({
                classId: CLASS_A,
                entries: [{ studentId: STU_A1, subjectId: SUBJ_SCI, marks: 65 }],
            });

        assert.equal(res.status, 200);
        assert.equal(res.body.saved, 1);
    });

    test('a main teacher cannot save marks for another class', async () => {
        const res = await request(app)
            .post('/api/marksheets/bulk')
            .auth(tokenFor(MAIN_A))
            .send({
                classId: CLASS_B,
                entries: [{ studentId: STU_B1, subjectId: SUBJ_MAT, marks: 50 }],
            });

        assert.equal(res.status, 403);
    });

    test('a main teacher deletes their own class marks only', async () => {
        const foreign = await request(app)
            .delete(`/api/marksheets/${MARK_B}`)
            .auth(tokenFor(MAIN_A));
        assert.equal(foreign.status, 403);

        const own = await request(app)
            .delete(`/api/marksheets/${MARK_A}`)
            .auth(tokenFor(MAIN_A));
        assert.equal(own.status, 200);
        assert.equal(rowsOf('marksheets').length, 1);
    });
});
