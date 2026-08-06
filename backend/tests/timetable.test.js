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
const SUBJ_MAT = '3b7d9e15-8c2a-4f60-b1d4-7e5a9c0f2b38';
const CS_ENG_A = '5a9c1e37-2d48-4b06-9f8e-1c3a5d7b9e02';
const CS_MAT_A = '8e2f4a06-9b1d-4c53-a7f8-0d6b2e4c8a15';
const SLOT_1 = 'c4a8e260-7f19-4d3b-95c7-2e8a1f6d4b03';

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
    users: [ADMIN, MAIN_A, MAIN_B, ENG_T, ASSIST],
    academic_years: [{ id: YEAR, school_id: SCHOOL, name: '2026/2027', is_current: true }],
    classes: [
        { id: CLASS_A, school_id: SCHOOL, name: 'Year 3A', capacity: 25 },
        { id: CLASS_B, school_id: SCHOOL, name: 'Year 3B', capacity: 25 },
    ],
    subjects: [
        { id: SUBJ_ENG, school_id: SCHOOL, name: 'English', code: 'ENG', taught_by: 'subject_teacher' },
        { id: SUBJ_MAT, school_id: SCHOOL, name: 'Mathematics', code: 'MAT', taught_by: 'main_teacher' },
    ],
    class_staff: [
        { id: 'cs-a', school_id: SCHOOL, academic_year_id: YEAR, class_id: CLASS_A, user_id: MAIN_A.id, position: 'main' },
        { id: 'cs-b', school_id: SCHOOL, academic_year_id: YEAR, class_id: CLASS_B, user_id: MAIN_B.id, position: 'main' },
        { id: 'cs-c', school_id: SCHOOL, academic_year_id: YEAR, class_id: CLASS_A, user_id: ASSIST.id, position: 'assistant' },
    ],
    class_subjects: [
        { id: CS_ENG_A, school_id: SCHOOL, academic_year_id: YEAR, class_id: CLASS_A, subject_id: SUBJ_ENG, teacher_id: ENG_T.id, sessions_per_week: 5 },
        { id: CS_MAT_A, school_id: SCHOOL, academic_year_id: YEAR, class_id: CLASS_A, subject_id: SUBJ_MAT, teacher_id: MAIN_A.id, sessions_per_week: 6 },
    ],
    timetable_slots: [
        { id: SLOT_1, school_id: SCHOOL, academic_year_id: YEAR, class_subject_id: CS_ENG_A, class_id: CLASS_A, teacher_id: ENG_T.id, day_of_week: 1, starts_at: '09:00', ends_at: '09:45' },
        { id: 'slot-2', school_id: SCHOOL, academic_year_id: YEAR, class_subject_id: CS_MAT_A, class_id: CLASS_A, teacher_id: MAIN_A.id, day_of_week: 1, starts_at: '10:00', ends_at: '10:45' },
    ],
    students: [],
    student_transfers: [],
});

beforeEach(() => {
    reset(tables());
    supabaseStub._rpc = {};
});

describe('timetable visibility', () => {
    test('an admin sees every period', async () => {
        const res = await request(app).get('/api/timetable').auth(tokenFor(ADMIN));

        assert.equal(res.status, 200);
        assert.equal(res.body.slots.length, 2);
    });

    test('a main teacher sees the whole week for the class they run', async () => {
        const res = await request(app)
            .get(`/api/timetable?classId=${CLASS_A}`)
            .auth(tokenFor(MAIN_A));

        assert.equal(res.status, 200);
        // Both periods, including English taught by someone else.
        assert.equal(res.body.slots.length, 2);
        assert.ok(res.body.slots.some((s) => s.teacherId === ENG_T.id));
    });

    test('an assistant teacher also sees their class in full', async () => {
        const res = await request(app)
            .get(`/api/timetable?classId=${CLASS_A}`)
            .auth(tokenFor(ASSIST));

        assert.equal(res.status, 200);
        assert.equal(res.body.slots.length, 2);
    });

    test('a subject teacher sees only their own lessons', async () => {
        const res = await request(app).get('/api/timetable').auth(tokenFor(ENG_T));

        assert.equal(res.status, 200);
        assert.equal(res.body.slots.length, 1);
        assert.equal(res.body.slots[0].teacherId, ENG_T.id);
    });

    test('a subject teacher querying a whole class still gets only their lessons', async () => {
        const res = await request(app)
            .get(`/api/timetable?classId=${CLASS_A}`)
            .auth(tokenFor(ENG_T));

        assert.equal(res.status, 200);
        assert.equal(res.body.slots.length, 1);
        assert.equal(res.body.slots[0].teacherId, ENG_T.id);
    });

    test('a main teacher asking about a class they do not run is narrowed to their own lessons', async () => {
        const res = await request(app)
            .get(`/api/timetable?classId=${CLASS_A}`)
            .auth(tokenFor(MAIN_B));

        assert.equal(res.status, 200);
        assert.equal(res.body.slots.length, 0);
    });

    test('my-week returns only the caller\'s lessons', async () => {
        const res = await request(app).get('/api/timetable/my-week').auth(tokenFor(MAIN_A));

        assert.equal(res.status, 200);
        assert.equal(res.body.slots.length, 1);
        assert.equal(res.body.slots[0].teacherId, MAIN_A.id);
    });

    test('the timetable requires authentication', async () => {
        assert.equal((await request(app).get('/api/timetable')).status, 401);
        assert.equal((await request(app).get('/api/timetable/my-week')).status, 401);
    });
});

describe('timetable editing', () => {
    test('only an admin may add a period', async () => {
        const payload = {
            classSubjectId: CS_ENG_A, dayOfWeek: 2, startsAt: '09:00', endsAt: '09:45',
        };

        assert.equal((await request(app).post('/api/timetable').auth(tokenFor(MAIN_A)).send(payload)).status, 403);
        assert.equal((await request(app).post('/api/timetable').auth(tokenFor(ENG_T)).send(payload)).status, 403);
        assert.equal((await request(app).post('/api/timetable').auth(tokenFor(ADMIN)).send(payload)).status, 201);
    });

    test('a double-booking is reported clearly', async () => {
        // Simulate the DB exclusion constraint firing.
        const originalFrom = supabaseStub.from;
        supabaseStub.from = (table) => {
            if (table === 'timetable_slots') {
                return {
                    insert: () => ({
                        select: () => ({
                            single: async () => ({
                                data: null,
                                error: { code: '23P01', message: 'conflicting key value violates exclusion constraint "no_teacher_double_booking"' },
                            }),
                        }),
                    }),
                };
            }
            return originalFrom(table);
        };

        const res = await request(app)
            .post('/api/timetable')
            .auth(tokenFor(ADMIN))
            .send({ classSubjectId: CS_ENG_A, dayOfWeek: 1, startsAt: '09:00', endsAt: '09:45' });

        supabaseStub.from = originalFrom;

        assert.equal(res.status, 409);
        assert.match(res.body.message, /already teaching/i);
    });

    test('rejects a malformed time', async () => {
        const res = await request(app)
            .post('/api/timetable')
            .auth(tokenFor(ADMIN))
            .send({ classSubjectId: CS_ENG_A, dayOfWeek: 1, startsAt: 'morning', endsAt: '09:45' });

        assert.equal(res.status, 400);
    });

    test('rejects a day outside the week', async () => {
        const res = await request(app)
            .post('/api/timetable')
            .auth(tokenFor(ADMIN))
            .send({ classSubjectId: CS_ENG_A, dayOfWeek: 9, startsAt: '09:00', endsAt: '09:45' });

        assert.equal(res.status, 400);
    });

    test('only an admin may delete a period', async () => {
        assert.equal((await request(app).delete(`/api/timetable/${SLOT_1}`).auth(tokenFor(MAIN_A))).status, 403);
        assert.equal((await request(app).delete(`/api/timetable/${SLOT_1}`).auth(tokenFor(ADMIN))).status, 200);
    });
});

describe('class roster — who attends this class', () => {
    test('lists staff, subject teachers and students', async () => {
        const res = await request(app)
            .get(`/api/timetable/class/${CLASS_A}/roster`)
            .auth(tokenFor(ADMIN));

        assert.equal(res.status, 200);
        assert.equal(res.body.class.name, 'Year 3A');
        assert.equal(res.body.mainTeacher?.id, MAIN_A.id);
        assert.equal(res.body.assistantTeacher?.id, ASSIST.id);
        assert.equal(res.body.teachingStaff.length, 2);
        assert.equal(res.body.scheduledPeriods, 2);
    });

    test('teachers may view a roster too', async () => {
        const res = await request(app)
            .get(`/api/timetable/class/${CLASS_A}/roster`)
            .auth(tokenFor(ENG_T));

        assert.equal(res.status, 200);
    });
});

describe('teacher rotation', () => {
    test('an admin can swap two classes\' main teachers', async () => {
        let called = null;
        supabaseStub._rpc.rotate_class_staff = (args) => {
            called = args;
            return { data: { rotated: true, position: 'main' }, error: null };
        };

        const res = await request(app)
            .post('/api/assignments/rotate')
            .auth(tokenFor(ADMIN))
            .send({ classAId: CLASS_A, classBId: CLASS_B, position: 'main' });

        assert.equal(res.status, 200);
        assert.equal(called.p_position, 'main');
        assert.equal(called.p_year_id, YEAR);
    });

    test('rotation is admin-only', async () => {
        const res = await request(app)
            .post('/api/assignments/rotate')
            .auth(tokenFor(MAIN_A))
            .send({ classAId: CLASS_A, classBId: CLASS_B, position: 'main' });

        assert.equal(res.status, 403);
    });

    test('rotating a class with itself is rejected', async () => {
        supabaseStub._rpc.rotate_class_staff = () => ({
            data: null, error: { message: 'SAME_CLASS' },
        });

        const res = await request(app)
            .post('/api/assignments/rotate')
            .auth(tokenFor(ADMIN))
            .send({ classAId: CLASS_A, classBId: CLASS_A, position: 'main' });

        assert.equal(res.status, 400);
    });
});

describe('student placement', () => {
    test('unassigned students can be listed', async () => {
        reset({
            ...tables(),
            students: [
                { id: '11a2b3c4-d5e6-4f78-9012-3456789abcde', school_id: SCHOOL, name: 'New Pupil', admission_no: 'A-100', class_id: null, is_active: true },
                { id: '22b3c4d5-e6f7-4089-a123-456789abcdef', school_id: SCHOOL, name: 'Placed Pupil', admission_no: 'A-101', class_id: CLASS_A, is_active: true },
            ],
        });

        const res = await request(app).get('/api/students/unassigned').auth(tokenFor(ADMIN));

        assert.equal(res.status, 200);
        assert.equal(res.body.students.length, 1);
        assert.equal(res.body.students[0].name, 'New Pupil');
    });

    test('an admin can place several students at once', async () => {
        let called = null;
        supabaseStub._rpc.assign_students_to_class = (args) => {
            called = args;
            return { data: { placed: 2, moved: 1, total: 3 }, error: null };
        };

        const res = await request(app)
            .post('/api/students/assign')
            .auth(tokenFor(ADMIN))
            .send({
                studentIds: [
                    '11a2b3c4-d5e6-4f78-9012-3456789abcde',
                    '22b3c4d5-e6f7-4089-a123-456789abcdef',
                ],
                classId: CLASS_A,
            });

        assert.equal(res.status, 200);
        assert.match(res.body.message, /2 placed/);
        assert.match(res.body.message, /1 moved/);
        assert.equal(called.p_class_id, CLASS_A);
    });

    test('over-capacity placement is refused with a helpful message', async () => {
        supabaseStub._rpc.assign_students_to_class = () => ({
            data: null,
            error: { message: 'OVER_CAPACITY: 2 of 25 places free' },
        });

        const res = await request(app)
            .post('/api/students/assign')
            .auth(tokenFor(ADMIN))
            .send({ studentIds: ['11a2b3c4-d5e6-4f78-9012-3456789abcde'], classId: CLASS_A });

        assert.equal(res.status, 409);
        assert.match(res.body.message, /over capacity/i);
    });

    test('a subject teacher cannot place students', async () => {
        const res = await request(app)
            .post('/api/students/assign')
            .auth(tokenFor(ENG_T))
            .send({ studentIds: ['11a2b3c4-d5e6-4f78-9012-3456789abcde'], classId: CLASS_A });

        assert.equal(res.status, 403);
    });

    test('placement requires at least one student', async () => {
        const res = await request(app)
            .post('/api/students/assign')
            .auth(tokenFor(ADMIN))
            .send({ studentIds: [], classId: CLASS_A });

        assert.equal(res.status, 400);
    });
});

describe('subject teaching policy', () => {
    test('a subject records who normally teaches it', async () => {
        const res = await request(app).get('/api/subjects').auth(tokenFor(ADMIN));

        assert.equal(res.status, 200);
        const maths = res.body.subjects.find((s) => s.code === 'MAT');
        const english = res.body.subjects.find((s) => s.code === 'ENG');

        assert.equal(maths.taughtBy, 'main_teacher');
        assert.equal(english.taughtBy, 'subject_teacher');
    });

    test('creating a subject validates the policy value', async () => {
        const res = await request(app)
            .post('/api/subjects')
            .auth(tokenFor(ADMIN))
            .send({ name: 'Geography', code: 'GEO', taughtBy: 'the_janitor' });

        assert.equal(res.status, 400);
    });

    test('auto-assigning main-teacher subjects covers every staffed class', async () => {
        const res = await request(app)
            .post('/api/assignments/auto-assign-main')
            .auth(tokenFor(ADMIN))
            .send({ sessionsPerWeek: 6 });

        assert.equal(res.status, 200);
        // 1 main-teacher subject (Maths) x 2 staffed classes.
        assert.match(res.body.message, /1 subject\(s\) to 2 main teacher\(s\)/);
    });

    test('auto-assign is admin-only', async () => {
        const res = await request(app)
            .post('/api/assignments/auto-assign-main')
            .auth(tokenFor(MAIN_A))
            .send({});

        assert.equal(res.status, 403);
    });
});
