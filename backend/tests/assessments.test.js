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
const STU_A1 = 'a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d';
const STU_A2 = 'b2c3d4e5-f6a7-4b8c-9d0e-1f2a3b4c5d6e';
const QUIZ_1 = 'c3d4e5f6-a7b8-4c9d-9e1f-2a3b4c5d6e7f';
const CLASSWORK = 'd4e5f6a7-b8c9-4d0e-9f1a-2b3c4d5e6f70';

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
    ],
    class_staff: [
        { id: 'cs-a', school_id: SCHOOL, academic_year_id: YEAR, class_id: CLASS_A, user_id: MAIN_A.id, position: 'main' },
        { id: 'cs-b', school_id: SCHOOL, academic_year_id: YEAR, class_id: CLASS_B, user_id: MAIN_B.id, position: 'main' },
    ],
    class_subjects: [
        { id: 'asg-1', school_id: SCHOOL, academic_year_id: YEAR, class_id: CLASS_A, subject_id: SUBJ_MAT, teacher_id: MAIN_A.id, sessions_per_week: 6 },
    ],
    students: [
        { id: STU_A1, school_id: SCHOOL, name: 'Abel T', admission_no: 'A001', roll_num: 1, class_id: CLASS_A, is_active: true },
        { id: STU_A2, school_id: SCHOOL, name: 'Sara K', admission_no: 'A002', roll_num: 2, class_id: CLASS_A, is_active: true },
    ],
    assessments: [
        { id: QUIZ_1, school_id: SCHOOL, academic_year_id: YEAR, class_id: CLASS_A, subject_id: SUBJ_MAT, term_id: TERM_1, label: 'Quiz 1', max_marks: 10, sort_order: 1 },
        { id: CLASSWORK, school_id: SCHOOL, academic_year_id: YEAR, class_id: CLASS_A, subject_id: SUBJ_MAT, term_id: TERM_1, label: 'Classwork', max_marks: 20, sort_order: 2 },
    ],
    assessment_marks: [],
    marksheets: [],
});

beforeEach(() => {
    reset(tables());
    supabaseStub._rpc = {};
});

describe('POST /api/assessments (create a column)', () => {
    test('a main teacher creates an assessment for their own class', async () => {
        const res = await request(app)
            .post('/api/assessments')
            .auth(tokenFor(MAIN_A))
            .send({ classId: CLASS_A, subjectId: SUBJ_MAT, label: 'Exam', maxMarks: 70 });

        assert.equal(res.status, 201);
        assert.equal(res.body.assessment.label, 'Exam');
        assert.equal(res.body.assessment.sort_order, 3); // after Quiz 1, Classwork
    });

    test('a teacher cannot create an assessment for another class', async () => {
        const res = await request(app)
            .post('/api/assessments')
            .auth(tokenFor(MAIN_A))
            .send({ classId: CLASS_B, subjectId: SUBJ_MAT, label: 'Quiz 1', maxMarks: 10 });

        assert.equal(res.status, 403);
    });
});

describe('assessment marks + final computation', () => {
    test('saving marks across columns computes the summed final', async () => {
        const res = await request(app)
            .post('/api/assessments/marks/bulk')
            .auth(tokenFor(MAIN_A))
            .send({
                classId: CLASS_A,
                subjectId: SUBJ_MAT,
                termId: TERM_1,
                entries: [
                    { assessmentId: QUIZ_1, studentId: STU_A1, marks: 8 },      // /10
                    { assessmentId: CLASSWORK, studentId: STU_A1, marks: 15 },  // /20
                ],
            });

        assert.equal(res.status, 200);
        assert.equal(res.body.saved, 2);

        // Final = 8 + 15 = 23 out of 30 -> 76.67%
        const finals = rowsOf('marksheets');
        assert.equal(finals.length, 1);
        assert.equal(finals[0].marks, 23);
        assert.equal(finals[0].max_marks, 30);
        assert.equal(finals[0].percentage, 76.67);
        assert.equal(finals[0].grade, 'B+');
    });

    test('marks above the assessment max are rejected', async () => {
        const res = await request(app)
            .post('/api/assessments/marks/bulk')
            .auth(tokenFor(MAIN_A))
            .send({
                classId: CLASS_A,
                subjectId: SUBJ_MAT,
                termId: TERM_1,
                entries: [{ assessmentId: QUIZ_1, studentId: STU_A1, marks: 15 }], // max 10
            });

        assert.equal(res.status, 400);
        assert.match(res.body.message, /exceed/i);
    });

    test('a teacher cannot save marks for another class', async () => {
        const res = await request(app)
            .post('/api/assessments/marks/bulk')
            .auth(tokenFor(MAIN_A))
            .send({
                classId: CLASS_B,
                subjectId: SUBJ_MAT,
                termId: TERM_1,
                entries: [{ assessmentId: QUIZ_1, studentId: STU_A1, marks: 5 }],
            });

        assert.equal(res.status, 403);
    });
});

describe('GET /api/assessments (load the grid)', () => {
    test('returns columns with their marks', async () => {
        rowsOf('assessment_marks').push(
            { id: 'am-1', school_id: SCHOOL, assessment_id: QUIZ_1, student_id: STU_A1, marks: 8 },
        );

        const res = await request(app)
            .get(`/api/assessments?classId=${CLASS_A}&subjectId=${SUBJ_MAT}&termId=${TERM_1}`)
            .auth(tokenFor(MAIN_A));

        assert.equal(res.status, 200);
        assert.equal(res.body.assessments.length, 2);
        assert.equal(res.body.assessments[0].label, 'Quiz 1');
        assert.equal(res.body.assessments[0].maxMarks, 10);
        assert.equal(res.body.assessments[0].marks[STU_A1], 8);
        assert.deepEqual(res.body.assessments[1].marks, {});
    });
});

describe('DELETE /api/assessments/:id', () => {
    test('deleting a column recomputes the final', async () => {
        rowsOf('assessment_marks').push(
            { id: 'am-1', school_id: SCHOOL, assessment_id: QUIZ_1, student_id: STU_A1, marks: 8 },
            { id: 'am-2', school_id: SCHOOL, assessment_id: CLASSWORK, student_id: STU_A1, marks: 15 },
            { id: 'am-3', school_id: SCHOOL, assessment_id: CLASSWORK, student_id: STU_A2, marks: 12 },
        );

        const res = await request(app)
            .delete(`/api/assessments/${CLASSWORK}`)
            .auth(tokenFor(MAIN_A));

        assert.equal(res.status, 200);

        // STU_A1 still has Quiz 1 -> final recomputed to 8/10 = 80%.
        const finals = rowsOf('marksheets');
        const abel = finals.find((m) => m.student_id === STU_A1);
        assert.equal(abel.marks, 8);
        assert.equal(abel.max_marks, 10);
        assert.equal(abel.percentage, 80);

        // STU_A2 only had Classwork -> their final is removed entirely.
        assert.equal(finals.find((m) => m.student_id === STU_A2), undefined);
    });
});

describe('deleting the last assessment', () => {
    test('removes the final cleanly when no assessments remain', async () => {
        rowsOf('assessment_marks').push(
            { id: 'am-x', school_id: SCHOOL, assessment_id: QUIZ_1, student_id: STU_A1, marks: 8 },
        );

        // Delete BOTH columns so none remain.
        let res = await request(app)
            .delete(`/api/assessments/${CLASSWORK}`)
            .auth(tokenFor(MAIN_A));
        assert.equal(res.status, 200);

        res = await request(app)
            .delete(`/api/assessments/${QUIZ_1}`)
            .auth(tokenFor(MAIN_A));
        assert.equal(res.status, 200);

        // No assessments left -> the student's final is gone.
        assert.equal(rowsOf('marksheets').filter((m) => m.student_id === STU_A1).length, 0);
    });
});
