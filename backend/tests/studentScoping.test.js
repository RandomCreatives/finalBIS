const { test, describe, beforeEach } = require('node:test');
const assert = require('node:assert/strict');

const { reset, rowsOf, supabaseStub } = require('./helpers');
const request = require('./request');
const app = require('../app');
const { signToken } = require('../middleware/auth');

const SCHOOL = '0a5eae91-5307-4125-b24f-876bb3f529b8';
const YEAR = 'f1c9d3e2-4b7a-4c81-9d6e-5a2f8b3c1d40';
const CLASS_A = '713bfeaa-d141-44f0-864a-cee594efb105';
const CLASS_B = '2c4e6a80-1f3d-4b5c-8e7a-9d0f1b2c3e45';
const SUBJ_ENG = 'e8c792f8-5e0f-4a8b-96e6-9a07ea4c932a';

const STU_A1 = 'a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d';
const STU_A2 = 'b2c3d4e5-f6a7-4b8c-9d0e-1f2a3b4c5d6e';
const STU_B1 = 'c3d4e5f6-a7b8-4c9d-9e1f-2a3b4c5d6e7f';

const user = (id, role, name) => ({
    id, school_id: SCHOOL, name, email: `${name.toLowerCase()}@school.et`,
    password_hash: '$2a$12$x', role, is_active: true,
});

const ADMIN = user('b7180a79-119a-4dfb-9934-aa683058abf6', 'admin', 'Admin');
const MAIN_A = user('82e61fbc-9942-415c-909c-f408360a2ef4', 'main_teacher', 'Meron');
const MAIN_B = user('7d3e5f91-4a26-4c80-b5e3-9f1a7c2d6b48', 'main_teacher', 'Bekele');
const ENG_T = user('343d1a63-716b-492c-88ca-f466c50aea97', 'subject_teacher', 'Dawit');
const ASSIST = user('43d3dcca-5eba-4682-b5e5-9be5d3e9836c', 'assistant_teacher', 'Sara');

const tokenFor = (u) => signToken(u);

const tables = () => ({
    schools: [{ id: SCHOOL, name: 'BIS NOC Gerji' }],
    users: [ADMIN, MAIN_A, MAIN_B, ENG_T, ASSIST],
    academic_years: [{ id: YEAR, school_id: SCHOOL, name: '2026/2027', is_current: true }],
    classes: [
        { id: CLASS_A, school_id: SCHOOL, name: 'Year 3A', capacity: 25 },
        { id: CLASS_B, school_id: SCHOOL, name: 'Year 3B', capacity: 25 },
    ],
    subjects: [
        { id: SUBJ_ENG, school_id: SCHOOL, name: 'English', code: 'ENG', taught_by: 'subject_teacher' },
    ],
    class_staff: [
        { id: 'cs-a', school_id: SCHOOL, academic_year_id: YEAR, class_id: CLASS_A, user_id: MAIN_A.id, position: 'main' },
        { id: 'cs-b', school_id: SCHOOL, academic_year_id: YEAR, class_id: CLASS_B, user_id: MAIN_B.id, position: 'main' },
        { id: 'cs-c', school_id: SCHOOL, academic_year_id: YEAR, class_id: CLASS_A, user_id: ASSIST.id, position: 'assistant' },
    ],
    class_subjects: [
        { id: 'asg-1', school_id: SCHOOL, academic_year_id: YEAR, class_id: CLASS_A, subject_id: SUBJ_ENG, teacher_id: ENG_T.id },
    ],
    students: [
        { id: STU_A1, school_id: SCHOOL, name: 'Abel T', admission_no: 'A001', class_id: CLASS_A, is_active: true },
        { id: STU_A2, school_id: SCHOOL, name: 'Sara K', admission_no: 'A002', class_id: CLASS_A, is_active: true },
        { id: STU_B1, school_id: SCHOOL, name: 'Kebede M', admission_no: 'B001', class_id: CLASS_B, is_active: true },
    ],
});

beforeEach(() => {
    reset(tables());
    supabaseStub._rpc = {};
});

describe('student list scoping', () => {
    test('a main teacher sees only their own class', async () => {
        const res = await request(app)
            .get(`/api/students?classId=${CLASS_A}`)
            .auth(tokenFor(MAIN_A));

        assert.equal(res.status, 200);
        assert.equal(res.body.students.length, 2);
        assert.ok(res.body.students.every((s) => s.classId === CLASS_A));
    });

    test('a main teacher cannot list another teacher\'s class', async () => {
        const res = await request(app)
            .get(`/api/students?classId=${CLASS_B}`)
            .auth(tokenFor(MAIN_A));

        assert.equal(res.status, 403);
    });

    test('without a classId a teacher only gets their own classes\' students', async () => {
        const res = await request(app)
            .get('/api/students')
            .auth(tokenFor(MAIN_A));

        assert.equal(res.status, 200);
        assert.equal(res.body.students.length, 2);
    });

    test('a subject teacher sees the classes they teach', async () => {
        const res = await request(app)
            .get(`/api/students?classId=${CLASS_A}`)
            .auth(tokenFor(ENG_T));

        assert.equal(res.status, 200);
        assert.equal(res.body.students.length, 2);
    });

    test('an admin sees every student', async () => {
        const res = await request(app)
            .get('/api/students')
            .auth(tokenFor(ADMIN));

        assert.equal(res.status, 200);
        assert.equal(res.body.students.length, 3);
    });
});

describe('student edit scoping', () => {
    test('a main teacher edits a student of their own class', async () => {
        const res = await request(app)
            .patch(`/api/students/${STU_A1}`)
            .auth(tokenFor(MAIN_A))
            .send({ guardianPhone: '911000000' });

        assert.equal(res.status, 200);
        const row = rowsOf('students').find((s) => s.id === STU_A1);
        assert.equal(row.guardian_phone, '911000000');
    });

    test('a main teacher cannot edit another class\'s student', async () => {
        const res = await request(app)
            .patch(`/api/students/${STU_B1}`)
            .auth(tokenFor(MAIN_A))
            .send({ guardianPhone: '911000000' });

        assert.equal(res.status, 403);
    });

    test('a teacher cannot move a student between classes via patch', async () => {
        const res = await request(app)
            .patch(`/api/students/${STU_A1}`)
            .auth(tokenFor(MAIN_A))
            .send({ classId: CLASS_B });

        assert.equal(res.status, 200);
        const row = rowsOf('students').find((s) => s.id === STU_A1);
        assert.equal(row.class_id, CLASS_A, 'class must not change via patch');
    });

    test('an assistant can edit their class\'s students (pastoral access)', async () => {
        const res = await request(app)
            .patch(`/api/students/${STU_A1}`)
            .auth(tokenFor(ASSIST))
            .send({ guardianName: 'Updated Guardian' });

        assert.equal(res.status, 200);
    });
});

describe('student transfer scoping', () => {
    test('a main teacher transfers a student of their own class', async () => {
        supabaseStub._rpc.transfer_student = (args) => ({
            data: { id: args.p_student_id, admission_no: 'A001', name: 'Abel T', class_id: args.p_to_class_id, is_active: true },
            error: null,
        });

        const res = await request(app)
            .post(`/api/students/${STU_A1}/transfer`)
            .auth(tokenFor(MAIN_A))
            .send({ toClassId: CLASS_B, reason: 'Family move' });

        assert.equal(res.status, 200);
    });

    test('a main teacher cannot transfer another class\'s student', async () => {
        const res = await request(app)
            .post(`/api/students/${STU_B1}/transfer`)
            .auth(tokenFor(MAIN_A))
            .send({ toClassId: CLASS_A });

        assert.equal(res.status, 403);
    });
});
