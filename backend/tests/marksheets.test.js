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
const SUBJ_ENG = 'e8c792f8-5e0f-4a8b-96e6-9a07ea4c932a';
const STU_1 = 'a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d';
const STU_2 = 'b2c3d4e5-f6a7-4b8c-9d0e-1f2a3b4c5d6e';

const user = (id, role, name) => ({
    id, school_id: SCHOOL, name, email: `${name.toLowerCase()}@school.et`,
    password_hash: '$2a$12$x', role, is_active: true,
});

const ADMIN = user('b7180a79-119a-4dfb-9934-aa683058abf6', 'admin', 'Admin');
const MAIN_A = user('82e61fbc-9942-415c-909c-f408360a2ef4', 'main_teacher', 'Meron');
const ENG_T = user('343d1a63-716b-492c-88ca-f466c50aea97', 'subject_teacher', 'Dawit');
const ASSIST = user('43d3dcca-5eba-4682-b5e5-9be5d3e9836c', 'assistant_teacher', 'Sara');

const tokenFor = (u) => signToken(u);

const tables = () => ({
    users: [ADMIN, MAIN_A, ENG_T, ASSIST],
    academic_years: [{ id: YEAR, school_id: SCHOOL, name: '2026/2027', is_current: true }],
    terms: [
        { id: TERM_1, school_id: SCHOOL, academic_year_id: YEAR, term_index: 1, name: 'Term 1', is_current: true },
    ],
    classes: [
        { id: CLASS_A, school_id: SCHOOL, name: 'Year 3A', capacity: 25 },
        { id: CLASS_B, school_id: SCHOOL, name: 'Year 3B', capacity: 25 },
    ],
    subjects: [
        { id: SUBJ_ENG, school_id: SCHOOL, name: 'English', code: 'ENG', taught_by: 'subject_teacher' },
    ],
    students: [
        { id: STU_1, school_id: SCHOOL, name: 'Abel Tesfaye', admission_no: 'A001', roll_num: 1, class_id: CLASS_A, is_active: true },
        { id: STU_2, school_id: SCHOOL, name: 'Sara Kebede', admission_no: 'A002', roll_num: 2, class_id: CLASS_A, is_active: true },
    ],
    marksheets: [],
});

beforeEach(() => {
    reset(tables());
    supabaseStub._rpc = {};
});

describe('single marksheet entry', () => {
    test('a main teacher saves one result and the grade is derived server-side', async () => {
        const res = await request(app)
            .put('/api/marksheets')
            .auth(tokenFor(MAIN_A))
            .send({ studentId: STU_1, subjectId: SUBJ_ENG, classId: CLASS_A, marks: 72, maxMarks: 80 });

        assert.equal(res.status, 200);
        assert.equal(res.body.marksheet.percentage, 90);
        assert.equal(res.body.marksheet.grade, 'A+');
        assert.equal(rowsOf('marksheets').length, 1);
        assert.equal(rowsOf('marksheets')[0].entered_by, MAIN_A.id);
    });

    test('an assistant teacher cannot enter marks', async () => {
        const res = await request(app)
            .put('/api/marksheets')
            .auth(tokenFor(ASSIST))
            .send({ studentId: STU_1, subjectId: SUBJ_ENG, marks: 50 });

        assert.equal(res.status, 403);
    });
});

describe('bulk marksheet save', () => {
    test('a subject teacher saves a whole sheet across their class in one request', async () => {
        const res = await request(app)
            .post('/api/marksheets/bulk')
            .auth(tokenFor(ENG_T))
            .send({
                classId: CLASS_A,
                entries: [
                    { studentId: STU_1, subjectId: SUBJ_ENG, marks: 65, maxMarks: 100 },
                    { studentId: STU_2, subjectId: SUBJ_ENG, marks: 30, maxMarks: 40 },
                ],
            });

        assert.equal(res.status, 200);
        assert.equal(res.body.saved, 2);
        assert.equal(rowsOf('marksheets').length, 2);

        const [first, second] = rowsOf('marksheets');
        assert.equal(first.class_id, CLASS_A);
        assert.equal(first.term_id, TERM_1); // resolved from the current term
        assert.equal(first.percentage, 65);
        assert.equal(first.grade, 'B');
        assert.equal(second.percentage, 75);
        assert.equal(second.grade, 'B+');
    });

    test('the response hydrates student and subject like the single upsert', async () => {
        const res = await request(app)
            .post('/api/marksheets/bulk')
            .auth(tokenFor(ENG_T))
            .send({
                classId: CLASS_A,
                entries: [{ studentId: STU_1, subjectId: SUBJ_ENG, marks: 45 }],
            });

        assert.equal(res.status, 200);
        assert.equal(res.body.marksheets.length, 1);
        assert.equal(res.body.marksheets[0].student.name, 'Abel Tesfaye');
        assert.equal(res.body.marksheets[0].subject.name, 'English');
    });

    test('an assistant teacher is refused', async () => {
        const res = await request(app)
            .post('/api/marksheets/bulk')
            .auth(tokenFor(ASSIST))
            .send({ entries: [{ studentId: STU_1, subjectId: SUBJ_ENG, marks: 50 }] });

        assert.equal(res.status, 403);
    });

    test('marks above the maximum are rejected', async () => {
        const res = await request(app)
            .post('/api/marksheets/bulk')
            .auth(tokenFor(MAIN_A))
            .send({ entries: [{ studentId: STU_1, subjectId: SUBJ_ENG, marks: 101, maxMarks: 100 }] });

        assert.equal(res.status, 400);
        assert.equal(rowsOf('marksheets').length, 0);
    });

    test('negative marks fail validation', async () => {
        const res = await request(app)
            .post('/api/marksheets/bulk')
            .auth(tokenFor(MAIN_A))
            .send({ entries: [{ studentId: STU_1, subjectId: SUBJ_ENG, marks: -1 }] });

        assert.equal(res.status, 400);
    });

    test('an empty entries array is rejected', async () => {
        const res = await request(app)
            .post('/api/marksheets/bulk')
            .auth(tokenFor(MAIN_A))
            .send({ entries: [] });

        assert.equal(res.status, 400);
    });
});

describe('reading marksheets', () => {
    beforeEach(() => {
        rowsOf('marksheets').push(
            {
                id: 'c9f1e2d3-a4b5-4c6d-8e7f-0a1b2c3d4e5f', school_id: SCHOOL, student_id: STU_1, subject_id: SUBJ_ENG,
                class_id: CLASS_A, term_id: TERM_1, marks: 80, max_marks: 100,
                percentage: 80, grade: 'A', entered_by: ENG_T.id,
            },
            {
                id: 'm-2', school_id: SCHOOL, student_id: STU_2, subject_id: SUBJ_ENG,
                class_id: CLASS_B, term_id: TERM_1, marks: 45, max_marks: 100,
                percentage: 45, grade: 'D', entered_by: ENG_T.id,
            }
        );
    });

    test('list filters by class and subject', async () => {
        const res = await request(app)
            .get(`/api/marksheets?classId=${CLASS_A}&subjectId=${SUBJ_ENG}&termId=${TERM_1}`)
            .auth(tokenFor(ENG_T));

        assert.equal(res.status, 200);
        assert.equal(res.body.marksheets.length, 1);
        assert.equal(res.body.marksheets[0].grade, 'A');
    });

    test('a per-student report includes the average and overall grade', async () => {
        const res = await request(app)
            .get(`/api/marksheets/student/${STU_1}`)
            .auth(tokenFor(MAIN_A));

        assert.equal(res.status, 200);
        assert.equal(res.body.stats.subjectCount, 1);
        assert.equal(res.body.stats.averagePercentage, 80);
        assert.equal(res.body.stats.overallGrade, 'A');
    });

    test('only admin and main teachers can delete a result', async () => {
        const denied = await request(app)
            .delete('/api/marksheets/c9f1e2d3-a4b5-4c6d-8e7f-0a1b2c3d4e5f')
            .auth(tokenFor(ENG_T));
        assert.equal(denied.status, 403);

        const allowed = await request(app)
            .delete('/api/marksheets/c9f1e2d3-a4b5-4c6d-8e7f-0a1b2c3d4e5f')
            .auth(tokenFor(MAIN_A));
        assert.equal(allowed.status, 200);
        assert.equal(rowsOf('marksheets').length, 1);
    });
});
