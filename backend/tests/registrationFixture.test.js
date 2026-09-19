const { test, describe, beforeEach } = require('node:test');
const assert = require('node:assert/strict');

const { reset, rowsOf, supabaseStub } = require('./helpers');
const request = require('./request');
const app = require('../app');
const { signToken } = require('../middleware/auth');

const SCHOOL = '0a5eae91-5307-4125-b24f-876bb3f529b8';
const YEAR = 'f1c9d3e2-4b7a-4c81-9d6e-5a2f8b3c1d40';
const TERM = '8b70f4f0-5e91-45b0-a3bc-ea5318c41c55';
const CLASS_A = '713bfeaa-d141-44f0-864a-cee594efb105';
const CLASS_B = '2c4e6a80-1f3d-4b5c-8e7a-9d0f1b2c3e45';
const SUBJECT_EN = 'e8c792f8-5e0f-4a8b-96e6-9a07ea4c932a';
const SUBJECT_REG = '1f97c2b4-6d38-4a9e-b5c1-2d8e7f9a3b60';
const CS_EN = '7dd1a63a-9a95-498d-9321-f1c92d07f456';
const CS_REG = '3ac21f55-7b6e-4d1a-8c9f-5e2b4a6d8c13';

const isoDate = (offsetDays = 0) =>
    new Date(Date.now() + offsetDays * 86400000).toISOString().slice(0, 10);

// JS getDay(): Sunday=0. Timetable rows use ISO 1..7 with Monday=1.
const jsDay = new Date().getDay();
const TODAY_ISO = jsDay === 0 ? 7 : jsDay;

const user = (id, role, name) => ({
    id, school_id: SCHOOL, name, email: `${name.toLowerCase()}@school.et`,
    password_hash: '$2a$12$x', role, is_active: true,
});

const ADMIN = user('b7180a79-119a-4dfb-9934-aa683058abf6', 'admin', 'Admin');
const MAIN = user('82e61fbc-9942-415c-909c-f408360a2ef4', 'main_teacher', 'Meron');

const tokenFor = (u) => signToken(u);

const tables = ({ classSubjects } = {}) => ({
    schools: [{ id: SCHOOL, name: 'BIS NOC Gerji' }],
    users: [ADMIN, MAIN],
    academic_years: [{ id: YEAR, school_id: SCHOOL, name: '2026/2027', is_current: true }],
    terms: [{
        id: TERM, school_id: SCHOOL, academic_year_id: YEAR, name: 'Term 1',
        starts_on: isoDate(-2), ends_on: isoDate(60), is_current: true,
    }],
    classes: [
        { id: CLASS_A, school_id: SCHOOL, name: 'Year 3A' },
        { id: CLASS_B, school_id: SCHOOL, name: 'Year 3B' },
    ],
    subjects: [
        { id: SUBJECT_EN, school_id: SCHOOL, name: 'English', code: 'ENG', taught_by: 'main_teacher' },
        { id: SUBJECT_REG, school_id: SCHOOL, name: 'Registration', code: 'REG', taught_by: 'main_teacher' },
    ],
    class_staff: [{
        id: '25b76899-dd52-4224-93f5-ef21eb93dcf0', school_id: SCHOOL,
        academic_year_id: YEAR, class_id: CLASS_A, user_id: MAIN.id, position: 'main',
    }],
    class_subjects: classSubjects ?? [
        { id: CS_EN, school_id: SCHOOL, academic_year_id: YEAR, class_id: CLASS_A, subject_id: SUBJECT_EN, teacher_id: MAIN.id, sessions_per_week: 4 },
        { id: CS_REG, school_id: SCHOOL, academic_year_id: YEAR, class_id: CLASS_A, subject_id: SUBJECT_REG, teacher_id: MAIN.id, sessions_per_week: 5 },
    ],
    timetable_slots: [{
        id: '59e8d7c6-b5a4-4392-8170-6f5e4d3c2b1a', school_id: SCHOOL,
        academic_year_id: YEAR, class_id: CLASS_A, class_subject_id: CS_REG,
        day_of_week: TODAY_ISO, starts_at: '08:10', ends_at: '08:30',
    }],
    students: [],
    schemes_of_work: [],
    lesson_plans: [],
    threads: [],
    thread_participants: [],
    messages: [],
    tasks: [],
    notices: [],
    notice_receipts: [],
    attendance: [],
});

beforeEach(() => {
    reset(tables());
    supabaseStub._rpc = {};
});

describe('registration is a fixture, not a job', () => {
    test('workload ignores registration seats in sessions and subject lists', async () => {
        const res = await request(app).get('/api/assignments/workload').auth(tokenFor(ADMIN));

        assert.equal(res.status, 200);
        const main = res.body.teachers.find((t) => t.id === MAIN.id);
        assert.equal(main.weeklySessions, 4, 'only the English seat counts');
        assert.deepEqual(main.subjects, ['English']);
        assert.equal(main.subjectClasses, 1);
    });

    test('workload does not report an unseated registration row as a staffing gap', async () => {
        reset(tables({
            classSubjects: [
                { id: CS_EN, school_id: SCHOOL, academic_year_id: YEAR, class_id: CLASS_A, subject_id: SUBJECT_EN, teacher_id: MAIN.id, sessions_per_week: 4 },
                { id: CS_REG, school_id: SCHOOL, academic_year_id: YEAR, class_id: CLASS_A, subject_id: SUBJECT_REG, teacher_id: null, sessions_per_week: 5 },
            ],
        }));

        const res = await request(app).get('/api/assignments/workload').auth(tokenFor(ADMIN));

        assert.equal(res.status, 200);
        assert.equal(res.body.unassignedSubjects, 0);
    });

    test('assignment listings never return registration rows', async () => {
        const res = await request(app)
            .get(`/api/assignments/subjects?classId=${CLASS_A}`)
            .auth(tokenFor(MAIN));

        assert.equal(res.status, 200);
        assert.equal(res.body.assignments.length, 1);
        assert.equal(res.body.assignments[0].subject.code, 'ENG');
    });

    test('auto-assign skips the registration subject', async () => {
        reset(tables({ classSubjects: [] }));

        const res = await request(app)
            .post('/api/assignments/auto-assign-main')
            .auth(tokenFor(ADMIN))
            .send({ sessionsPerWeek: 2 });

        assert.equal(res.status, 200);
        const rows = rowsOf('class_subjects');
        assert.equal(rows.length, 1, 'English only — REG is owned by the timetable setup');
        assert.equal(rows[0].subject_id, SUBJECT_EN);
    });

    test('the class roster lists only real teaching staff', async () => {
        const res = await request(app)
            .get(`/api/timetable/class/${CLASS_A}/roster`)
            .auth(tokenFor(MAIN));

        assert.equal(res.status, 200);
        assert.equal(res.body.teachingStaff.length, 1);
        assert.equal(res.body.teachingStaff[0].subject.code, 'ENG');
    });

    test('the planning overview asks for no registration paperwork', async () => {
        const res = await request(app).get('/api/planning/overview').auth(tokenFor(ADMIN));

        assert.equal(res.status, 200);
        assert.equal(res.body.rows.length, 1);
        assert.equal(res.body.rows[0].subject.name, 'English');
        assert.equal(res.body.summary.assignments, 1);
        assert.equal(res.body.summary.schemesMissing, 1);
    });

    test('the public teacher directory never shows registration', async () => {
        const res = await request(app).get('/api/public/teachers');

        assert.equal(res.status, 200);
        const meron = res.body.teachers.find((t) => t.name === 'Meron');
        assert.deepEqual(meron.subjects.map((s) => s.name), ['English']);
    });

    test('my dashboard hides registration as a subject but keeps the daily slot', async () => {
        const res = await request(app).get('/api/dashboard/me').auth(tokenFor(MAIN));

        assert.equal(res.status, 200);
        assert.equal(res.body.teachingSubjects.length, 1);
        assert.equal(res.body.teachingSubjects[0].subject.code, 'ENG');
        const regSlot = res.body.todaySlots.find((s) => s.startsAt === '08:10');
        assert.ok(regSlot, 'the 08:10 roll-call slot stays on the day schedule');
        assert.equal(regSlot.subject.name, 'Registration');
    });

    test('data-flow planning gaps ignore registration seats', async () => {
        const res = await request(app).get('/api/dashboard/data-flow').auth(tokenFor(MAIN));

        assert.equal(res.status, 200);
        const planning = res.body.flows.find((f) => f.id === 'planning');
        // English has neither a scheme nor this week's plan -> exactly one gap.
        assert.equal(planning.metric, '1 gap(s)');
    });
});
