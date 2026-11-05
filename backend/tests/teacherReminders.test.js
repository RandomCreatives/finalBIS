const { test, describe, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const { reset, rowsOf, supabaseStub } = require('./helpers');
const request = require('./request');
const app = require('../app');
const { signToken } = require('../middleware/auth');
const schoolTime = require('../utils/schoolTime');
const reminders = require('../services/teacherReminders');

const SCHOOL = '0a5eae91-5307-4125-b24f-876bb3f529b8';
const YEAR = '9a6ff1d0-6d70-4a38-b6e7-c1f4f3dc63aa';
const TERM = '8b70f4f0-5e91-45b0-a3bc-ea5318c41c55';
const MONDAY = '2026-11-02';
const uuid = (n) => `b0000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const user = (n, role, name, extra = {}) => ({
    id: uuid(n), school_id: SCHOOL, name, email: `user${n}@school.et`, role,
    is_active: true, telegram_id: null, ...extra,
});

const MERON = user(1, 'main_teacher', 'Meron Abebe Tarekegn', { telegram_id: 101 });
const MICHAEL = user(2, 'subject_teacher', 'Mr. Michael', { telegram_id: 102 });
const ASSISTANT = user(3, 'assistant_teacher', 'Edilawit W.');
const ABIGIYA = user(4, 'main_teacher', 'Abigiya Tadele Biru');
const ABIGIA_INACTIVE = user(5, 'main_teacher', 'Abigia Alemayehu Dogamo', { is_active: false, telegram_id: 105 });
const BETHELHEM = user(6, 'main_teacher', 'Bethelhem Girma');
const SELAM = user(7, 'main_teacher', 'Selam Goyte Abza');
const SIMEGN = user(8, 'main_teacher', 'Simegn Yilma Akalu', { telegram_id: 108 });
const DEGNET = user(9, 'main_teacher', 'Degnet Engida Addis');
const MEKDEL_N = user(10, 'main_teacher', 'Mekdelawit Nigusu Alemu');
const MIKE = user(11, 'subject_teacher', 'Michael Okwara Okwara');
const SUBJECT2 = user(12, 'subject_teacher', 'Dawit Example');
const MEKDEL_A = user(13, 'main_teacher', 'Mekdelawit Abate Nebebe');
const ANDU = user(14, 'main_teacher', 'Andu Getachew Tulu');
const KALKIDAN = user(15, 'main_teacher', 'Kalkidan Zewdu');

const CLASS_A = 'c0000000-0000-4000-8000-000000000001';
const CLASS_B = 'c0000000-0000-4000-8000-000000000002';
const ENGLISH = 'd0000000-0000-4000-8000-000000000001';
const FRENCH = 'd0000000-0000-4000-8000-000000000002';
const REG = 'd0000000-0000-4000-8000-000000000003';
const PLAN_A = 'e0000000-0000-4000-8000-000000000001';
const PLAN_B = 'e0000000-0000-4000-8000-000000000002';
const PLAN_REG = 'e0000000-0000-4000-8000-000000000003';

const seed = (overrides = {}) => reset({
    schools: [{ id: SCHOOL, name: 'BIS NOC' }],
    users: [MERON, MICHAEL, ASSISTANT, ABIGIYA, ABIGIA_INACTIVE, BETHELHEM, SELAM, SIMEGN, DEGNET, MEKDEL_N, MIKE, SUBJECT2, MEKDEL_A, ANDU, KALKIDAN],
    academic_years: [{ id: YEAR, school_id: SCHOOL, name: '2026/2027', is_current: true }],
    terms: [{ id: TERM, school_id: SCHOOL, starts_on: '2026-09-07', ends_on: '2026-12-18', is_current: true }],
    classes: [
        { id: CLASS_A, school_id: SCHOOL, name: 'Year 3 - Red' },
        { id: CLASS_B, school_id: SCHOOL, name: 'Year 3 - Blue' },
    ],
    subjects: [
        { id: ENGLISH, school_id: SCHOOL, name: 'English', code: 'ENG' },
        { id: FRENCH, school_id: SCHOOL, name: 'French', code: 'FRA' },
        { id: REG, school_id: SCHOOL, name: 'Registration', code: 'REG' },
    ],
    class_staff: [
        { id: 'staff-1', school_id: SCHOOL, academic_year_id: YEAR, class_id: CLASS_A, user_id: MERON.id, position: 'main' },
    ],
    class_subjects: [
        { id: PLAN_A, school_id: SCHOOL, academic_year_id: YEAR, class_id: CLASS_A, subject_id: FRENCH, teacher_id: MICHAEL.id },
        { id: PLAN_B, school_id: SCHOOL, academic_year_id: YEAR, class_id: CLASS_B, subject_id: ENGLISH, teacher_id: SUBJECT2.id },
        { id: PLAN_REG, school_id: SCHOOL, academic_year_id: YEAR, class_id: CLASS_A, subject_id: REG, teacher_id: MICHAEL.id },
    ],
    lesson_plans: [
        { id: 'lesson-draft', school_id: SCHOOL, term_id: TERM, class_subject_id: PLAN_A, week_number: 9, status: 'draft' },
        { id: 'lesson-submitted', school_id: SCHOOL, term_id: TERM, class_subject_id: PLAN_B, week_number: 9, status: 'submitted' },
        { id: 'lesson-registration', school_id: SCHOOL, term_id: TERM, class_subject_id: PLAN_REG, week_number: 9, status: 'draft' },
    ],
    tasks: [
        { id: 'task-1', school_id: SCHOOL, assigned_to: MERON.id, title: 'Return assessment sheets', due_on: '2026-11-04', status: 'pending' },
        { id: 'task-2', school_id: SCHOOL, assigned_to: MICHAEL.id, title: 'Submit marks', due_on: '2026-11-06', status: 'in_progress' },
        { id: 'task-done', school_id: SCHOOL, assigned_to: MERON.id, title: 'Already completed', due_on: '2026-11-03', status: 'done' },
        { id: 'task-cancelled', school_id: SCHOOL, assigned_to: MICHAEL.id, title: 'Cancelled task', due_on: '2026-11-03', status: 'cancelled' },
    ],
    calendar_events: [
        { id: 'deadline-all', school_id: SCHOOL, title: 'Weekly assessment deadline', category: 'deadline', audience: 'all', class_id: null, starts_on: '2026-11-05', ends_on: '2026-11-05' },
        { id: 'deadline-other-class', school_id: SCHOOL, title: 'Other class deadline', category: 'deadline', audience: 'main_teacher', class_id: CLASS_B, starts_on: '2026-11-05', ends_on: '2026-11-05' },
        { id: 'not-deadline', school_id: SCHOOL, title: 'School meeting', category: 'meeting', audience: 'all', class_id: null, starts_on: '2026-11-03', ends_on: '2026-11-03' },
    ],
    notifications: [],
    notices: [],
    notice_receipts: [],
    push_subscriptions: [],
    ...overrides,
});

const schoolAt = (date, time) => new Date(`${date}T${time}:00+03:00`);
const savedSecret = process.env.CRON_SECRET;
const realFetch = global.fetch;
let telegramCalls = [];

beforeEach(() => {
    seed();
    telegramCalls = [];
    global.fetch = async (url, init) => {
        if (String(url).startsWith('https://api.telegram.org/')) {
            telegramCalls.push({ method: String(url).split('/').pop(), body: JSON.parse(init.body) });
            return { json: async () => ({ ok: true, result: {} }) };
        }
        return realFetch(url, init);
    };
    reminders._resetThrottle();
    delete process.env.CRON_SECRET;
});

afterEach(() => {
    global.fetch = realFetch;
    schoolTime.clock.now = () => new Date();
    if (savedSecret === undefined) delete process.env.CRON_SECRET;
    else process.env.CRON_SECRET = savedSecret;
});

const nudges = (kind) => rowsOf('notifications').filter((row) => !kind || row.kind === kind);

describe('weekly teacher briefing and lesson-plan reminders', () => {
    test('Monday 09:55 briefing reminder sends role-scoped deadlines and missing plans once', async () => {
        seed({ users: [MERON, MICHAEL, ASSISTANT] });
        const result = await reminders.runTeacherReminders({ now: schoolAt(MONDAY, '09:56') });
        assert.equal(result.due, true);
        assert.equal(result.schools[0].briefings, 2);
        assert.equal(result.schools[0].lessonPlanReminders, 1);

        const briefings = nudges('weekly_briefing');
        assert.deepEqual(briefings.map((row) => row.user_id).sort(), [MERON.id, MICHAEL.id].sort());
        const mainBriefing = briefings.find((row) => row.user_id === MERON.id);
        assert.match(mainBriefing.body, /Return assessment sheets/);
        assert.match(mainBriefing.body, /Weekly assessment deadline/);
        assert.doesNotMatch(mainBriefing.body, /Other class deadline|Already completed/);
        const subjectBriefing = briefings.find((row) => row.user_id === MICHAEL.id);
        assert.match(subjectBriefing.body, /Submit marks/);
        assert.doesNotMatch(subjectBriefing.body, /Cancelled task/);

        const planReminder = nudges('lesson_plan_reminder');
        assert.equal(planReminder.length, 1);
        assert.equal(planReminder[0].user_id, MICHAEL.id);
        assert.match(planReminder[0].body, /Year 3 - Red — French/);
        assert.doesNotMatch(planReminder[0].body, /Registration/);
        assert.equal(telegramCalls.length, 3, 'linked staff receive one Telegram for each new in-app alert');

        await reminders.runTeacherReminders({ now: schoolAt(MONDAY, '09:57') });
        assert.equal(nudges().length, 3, 'retry is deduplicated');
        assert.equal(telegramCalls.length, 3, 'no duplicate Telegram messages');
    });

    test('outside the Monday briefing reminder window it sends no weekly reminder', async () => {
        const early = await reminders.runTeacherReminders({ now: schoolAt(MONDAY, '09:54') });
        const late = await reminders.runTeacherReminders({ now: schoolAt(MONDAY, '10:00') });
        assert.equal(early.due, false);
        assert.equal(late.due, false);
        assert.equal(nudges().length, 0);
    });
});

describe('snack, lunch, and home-time duty reminders', () => {
    test('snack duty at 10:10 is sent five minutes before to active assigned staff only', async () => {
        const early = await reminders.runTeacherReminders({ now: schoolAt('2026-11-04', '10:04') });
        assert.equal(early.due, false);

        const result = await reminders.runTeacherReminders({ now: schoolAt('2026-11-04', '10:05') });
        assert.equal(result.schools[0].dutyReminders, 4);
        const sent = nudges('duty_reminder');
        assert.deepEqual(sent.map((row) => row.user_id).sort(), [SELAM.id, SIMEGN.id, ABIGIYA.id, DEGNET.id].sort());
        assert.equal(sent.some((row) => row.user_id === ABIGIA_INACTIVE.id), false);
        assert.ok(sent.every((row) => /Snack duty starts at 10:10/.test(row.title)));

        await reminders.runTeacherReminders({ now: schoolAt('2026-11-04', '10:06') });
        assert.equal(nudges('duty_reminder').length, 4);
        assert.equal(telegramCalls.length, 1, 'only the linked teacher gets a Telegram DM');
    });

    test('lunch duty at 12:20 is reminded five minutes beforehand', async () => {
        const result = await reminders.runTeacherReminders({ now: schoolAt('2026-11-04', '12:15') });
        assert.equal(result.schools[0].dutyReminders, 4, JSON.stringify(nudges('duty_reminder').map((row) => row.user_id)));
        assert.deepEqual(nudges('duty_reminder').map((row) => row.user_id).sort(),
            [MEKDEL_A.id, MERON.id, ANDU.id, KALKIDAN.id].sort());
        assert.ok(nudges('duty_reminder').every((row) => /Lunch duty starts at 12:20/.test(row.title)));
    });

    test('an abbreviated rota name is skipped if it matches more than one active account', async () => {
        const duplicate = user(16, 'main_teacher', 'Abigiya Tadele Tefera');
        seed({ users: [SELAM, SIMEGN, ABIGIYA, DEGNET, duplicate] });
        const result = await reminders.runTeacherReminders({ now: schoolAt('2026-11-04', '10:05') });
        assert.equal(result.schools[0].dutyReminders, 3);
        assert.deepEqual(nudges('duty_reminder').map((row) => row.user_id).sort(),
            [SELAM.id, SIMEGN.id, DEGNET.id].sort());
    });

    test('the monthly home-time rota combines with all active TAs and Mr. Mike', async () => {
        const result = await reminders.runTeacherReminders({ now: schoolAt('2026-11-03', '15:05') });
        assert.equal(result.schools[0].dutyReminders, 3);
        const sent = nudges('duty_reminder');
        assert.deepEqual(sent.map((row) => row.user_id).sort(), [ASSISTANT.id, ABIGIYA.id, MIKE.id].sort());
        assert.equal(sent.some((row) => row.user_id === ABIGIA_INACTIVE.id), false,
            'the retired Abigia Alemayehu account is not the distinct Abigiya Tadele rota entry');
        assert.ok(sent.every((row) => /Home-time duty starts at 15:10/.test(row.title)));
    });

    test('no morning-duty reminders are scheduled', async () => {
        const result = await reminders.runTeacherReminders({ now: schoolAt('2026-11-04', '08:05') });
        assert.equal(result.due, false);
        assert.equal(nudges().length, 0);
    });

    test('weekends and whole-school holidays are skipped', async () => {
        const weekend = await reminders.runTeacherReminders({ now: schoolAt('2026-11-07', '10:05') });
        assert.equal(weekend.due, false);
        assert.equal((await reminders.schoolIsOpen(SCHOOL, '2026-11-07')).open, false);
        assert.equal(nudges().length, 0);

        seed({
            calendar_events: [{
                id: 'holiday', school_id: SCHOOL, title: 'School holiday', category: 'holiday',
                class_id: null, starts_on: '2026-11-04', ends_on: '2026-11-04', audience: 'all',
            }],
        });
        const holiday = await reminders.runTeacherReminders({ now: schoolAt('2026-11-04', '10:05') });
        assert.equal(holiday.schools[0].schoolDay, false);
        assert.equal(nudges().length, 0);
    });
});

describe('teacher-reminder cron endpoint', () => {
    test('requires the configured secret and returns aggregate counts', async () => {
        seed({ users: [MERON, MICHAEL, ASSISTANT] });
        process.env.CRON_SECRET = 'cron-secret-for-tests';
        assert.equal((await request(app).get('/api/cron/teacher-reminders')).status, 401);
        assert.equal((await request(app).get('/api/cron/teacher-reminders').auth('wrong')).status, 401);

        schoolTime.clock.now = () => schoolAt(MONDAY, '09:56');
        const response = await request(app).get('/api/cron/teacher-reminders').auth('cron-secret-for-tests');
        assert.equal(response.status, 200);
        assert.equal(response.body.status, 'ok');
        assert.equal(response.body.schools[0].briefings, 2);
        assert.doesNotMatch(JSON.stringify(response.body), /Meron|Michael|Year 3/);
    });
});

describe('Vercel teacher-reminder schedule', () => {
    test('invokes only at the briefing and duty reminder windows', () => {
        const configPath = path.join(__dirname, '..', '..', 'vercel.json');
        const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
        const schedules = config.crons
            .filter((cron) => cron.path === '/api/cron/teacher-reminders')
            .map((cron) => cron.schedule);

        assert.deepEqual(schedules, [
            '55 6 * * 1',
            '5 7 * * 1-5',
            '15 9 * * 1-5',
            '5 12 * * 1-5',
        ]);
    });
});
