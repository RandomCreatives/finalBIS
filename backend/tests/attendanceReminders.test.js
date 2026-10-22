/**
 * Daily attendance: the office's live report, reminders for main teachers,
 * and school time (Addis Ababa, GMT+3) throughout.
 *
 * The clock is pinned through utils/schoolTime so every case is exact:
 * Thursday 12 November 2026, 08:50 at school (05:50 UTC) unless stated.
 * Times below are written on the school clock: schoolAt(day, 'HH:MM').
 */
const { test, describe, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');

const { reset, rowsOf, supabaseStub } = require('./helpers');
const request = require('./request');
const app = require('../app');
const { signToken } = require('../middleware/auth');
const schoolTime = require('../utils/schoolTime');
const reminders = require('../services/attendanceReminders');
const { handleUpdate } = require('../services/telegramBot');

const SCHOOL = '0a5eae91-5307-4125-b24f-876bb3f529b8';
const YEAR = '9a6ff1d0-6d70-4a38-b6e7-c1f4f3dc63aa';
const TERM = '8b70f4f0-5e91-45b0-a3bc-ea5318c41c55';
const DAY = '2026-11-12'; // a Thursday in Term 1

const uuid = (kind, n) => `${kind}-0000-4000-8000-${String(n).padStart(12, '0')}`;
const BLUE = uuid('c0000000', 1);
const GREEN = uuid('c0000000', 2);
const RED = uuid('c0000000', 3);
const EMPTY = uuid('c0000000', 4);
const YELLOW = uuid('c0000000', 5);

const user = (n, role, name, extra = {}) => ({
    id: uuid('b0000000', n), school_id: SCHOOL, name, email: `user${n}@school.et`,
    password_hash: '$2a$12$placeholderplaceholderplaceholderplaceholderplaceholder',
    role, is_active: true, telegram_id: null, ...extra,
});
const ADMIN = user(1, 'admin', 'Office Admin');
const MAHILET = user(2, 'main_teacher', 'Ms. Mahilet', { telegram_id: 111 });
const SENA = user(3, 'main_teacher', 'Ms. Sena');
const ROBEL = user(4, 'main_teacher', 'Mr. Robel');
const EMPTY_T = user(5, 'main_teacher', 'Mr. Empty');
const GONE = user(6, 'main_teacher', 'Ms. Former', { is_active: false, telegram_id: 666 });
const LIBRARIAN = user(7, 'librarian', 'Librarian', { telegram_id: 999 });

const schoolAt = (day, hhmm) => () => new Date(`${day}T${hhmm}:00+03:00`);
const THURSDAY_0850 = schoolAt(DAY, '08:50');

const pupils = (classId, n, count) => Array.from({ length: count }, (_, i) => ({
    id: uuid('a0000000', n * 10 + i + 1), school_id: SCHOOL, class_id: classId,
    name: `Pupil ${n}.${i + 1}`, admission_no: `BIS-${n}-${i + 1}`, roll_num: i + 1, is_active: true,
}));
const STUDENTS = [...pupils(BLUE, 1, 2), ...pupils(GREEN, 2, 2), ...pupils(RED, 3, 2), ...pupils(YELLOW, 5, 2)];

const homeroom = (pupil, date, status, markedBy, updatedAt) => ({
    id: `att-${pupil.id}-${date}`, school_id: SCHOOL, student_id: pupil.id, class_id: pupil.class_id,
    subject_id: null, date, status, marked_by: markedBy, updated_at: updatedAt,
});

const seat = (n, classId, teacher) => ({
    id: uuid('f0000000', n), school_id: SCHOOL, academic_year_id: YEAR, class_id: classId,
    user_id: teacher.id, position: 'main',
});

const seed = (overrides = {}) => reset({
    schools: [{ id: SCHOOL, name: 'BIS NOC' }],
    users: [ADMIN, MAHILET, SENA, ROBEL, EMPTY_T, GONE, LIBRARIAN],
    academic_years: [{ id: YEAR, school_id: SCHOOL, name: '2026/2027', is_current: true }],
    terms: [{ id: TERM, school_id: SCHOOL, academic_year_id: YEAR, term_index: 1, name: 'Term 1',
        starts_on: '2026-09-07', ends_on: '2026-12-18', is_current: true }],
    classes: [
        { id: BLUE, school_id: SCHOOL, name: 'Year 3 - Blue' },
        { id: GREEN, school_id: SCHOOL, name: 'Year 3 - Green' },
        { id: RED, school_id: SCHOOL, name: 'Year 3 - Red' },
        { id: EMPTY, school_id: SCHOOL, name: 'Year 3 - Spare' },
        { id: YELLOW, school_id: SCHOOL, name: 'Year 3 - Yellow' },
    ],
    class_staff: [seat(1, BLUE, MAHILET), seat(2, GREEN, SENA), seat(3, RED, ROBEL), seat(4, EMPTY, EMPTY_T), seat(5, YELLOW, GONE)],
    students: STUDENTS,
    // Red's register is in (saved 08:12 at school); nobody else's.
    attendance: STUDENTS.filter((p) => p.class_id === RED)
        .map((p, i) => homeroom(p, DAY, i === 0 ? 'present' : 'late', ROBEL.id, `${DAY}T05:12:00.000Z`)),
    attendance_submissions: [],
    calendar_events: [],
    notifications: [],
    notices: [],
    notice_receipts: [],
    ...overrides,
});

// Capture Telegram Bot API calls instead of hitting the network.
const realFetch = global.fetch;
let telegram = [];
const sentMessages = () => telegram.filter((c) => c.method === 'sendMessage');
const savedEnv = { time: process.env.ATTENDANCE_REMINDER_TIME, secret: process.env.CRON_SECRET };
let rpcCalls = [];

beforeEach(() => {
    telegram = [];
    rpcCalls = [];
    global.fetch = async (url, init) => {
        if (String(url).startsWith('https://api.telegram.org/')) {
            telegram.push({ method: String(url).split('/').pop(), body: JSON.parse(init.body) });
            return { json: async () => ({ ok: true, result: {} }) };
        }
        return realFetch(url, init);
    };
    supabaseStub._rpc.mark_attendance = (args) => {
        rpcCalls.push(args);
        return { data: { count: args.p_records.length }, error: null };
    };
    reminders._resetThrottle();
    delete process.env.ATTENDANCE_REMINDER_TIME;
    delete process.env.CRON_SECRET;
    schoolTime.clock.now = THURSDAY_0850;
    seed();
});

afterEach(() => {
    global.fetch = realFetch;
    delete supabaseStub._rpc.mark_attendance;
    schoolTime.clock.now = () => new Date();
    if (savedEnv.time === undefined) delete process.env.ATTENDANCE_REMINDER_TIME;
    else process.env.ATTENDANCE_REMINDER_TIME = savedEnv.time;
    if (savedEnv.secret === undefined) delete process.env.CRON_SECRET;
    else process.env.CRON_SECRET = savedEnv.secret;
});

const nudges = (kind) => rowsOf('notifications').filter((n) => !kind || n.kind === kind);

describe('reminders for main teachers', () => {
    test('nothing is sent before the reminder time (08:45 at school)', async () => {
        schoolTime.clock.now = schoolAt(DAY, '08:40');
        const result = await reminders.runAttendanceReminders();
        assert.equal(result.due, false);
        assert.equal(nudges().length, 0);
        assert.equal(sentMessages().length, 0);
    });

    test('at 08:50 every main teacher still owing a register is reminded, once', async () => {
        const result = await reminders.runAttendanceReminders();
        assert.equal(result.due, true);
        assert.equal(result.date, DAY);

        const sent = nudges('attendance_reminder');
        assert.deepEqual(sent.map((n) => n.user_id).sort(), [MAHILET.id, SENA.id].sort(),
            'Blue and Green only: Red is taken, Spare has no pupils, Yellow has no active teacher');

        const blue = sent.find((n) => n.user_id === MAHILET.id);
        assert.equal(blue.title, 'Take the register: Year 3 - Blue');
        assert.match(blue.body, /^Thursday 12 November — /);
        assert.equal(blue.link, `/app/attendance?classId=${BLUE}&date=${DAY}`);
        assert.equal(blue.dedupe_key, `attendance-reminder:${BLUE}:${DAY}`);

        // Telegram for the teacher who linked it — with one-tap actions.
        assert.equal(sentMessages().length, 1);
        const message = sentMessages()[0].body;
        assert.equal(message.chat_id, 111);
        assert.match(message.text, /Year 3 - Blue — Thursday 12 November/);
        const buttons = message.reply_markup.inline_keyboard.flat();
        assert.equal(buttons[0].callback_data, `ap:${BLUE}`);
        assert.match(buttons[1].url, new RegExp(`/app/attendance\\?classId=${BLUE}&date=${DAY}$`));

        // One digest for the office, listing every missing register.
        const digest = nudges('attendance_digest');
        assert.deepEqual(digest.map((n) => n.user_id), [ADMIN.id]);
        assert.equal(digest[0].title, 'Daily attendance: 3 registers missing');
        assert.match(digest[0].body, /08:50/);
        assert.match(digest[0].body, /Year 3 - Blue \(Ms\. Mahilet\)/);
        assert.match(digest[0].body, /Year 3 - Yellow \(no class teacher\)/);
        assert.doesNotMatch(digest[0].body, /Year 3 - Red|Spare/);

        // Running again — cron, another bell refresh — adds nothing.
        const again = await reminders.runAttendanceReminders();
        assert.deepEqual(again.schools[0].reminded, []);
        assert.equal(nudges().length, 3);
        assert.equal(sentMessages().length, 1, 'no second Telegram message');
    });

    test('a second class teacher added later is reminded; nobody gets a repeat', async () => {
        await reminders.runAttendanceReminders();
        assert.equal(sentMessages().length, 1);

        const coTeacher = user(8, 'main_teacher', 'Mr. Dawit', { telegram_id: 222 });
        rowsOf('users').push(coTeacher);
        rowsOf('class_staff').push(seat(8, BLUE, coTeacher));

        await reminders.runAttendanceReminders();
        const blue = nudges('attendance_reminder').filter((n) => n.link.includes(BLUE));
        assert.deepEqual(blue.map((n) => n.user_id).sort(), [MAHILET.id, coTeacher.id].sort());
        assert.deepEqual(sentMessages().map((m) => m.body.chat_id), [111, 222], 'Ms. Mahilet is not messaged twice');
    });

    test('no reminders on weekends, holidays, between terms, or after school', async () => {
        schoolTime.clock.now = schoolAt('2026-11-14', '08:50'); // Saturday
        let result = await reminders.runAttendanceReminders();
        assert.equal(result.schools[0].schoolDay, false);
        assert.equal(result.schools[0].reason, 'weekend');

        schoolTime.clock.now = THURSDAY_0850;
        seed({ calendar_events: [{ id: 'h1', school_id: SCHOOL, class_id: null, title: 'Meskel', category: 'holiday',
            starts_on: DAY, ends_on: DAY }] });
        result = await reminders.runAttendanceReminders();
        assert.equal(result.schools[0].reason, 'holiday: Meskel');

        seed({ terms: [{ id: TERM, school_id: SCHOOL, academic_year_id: YEAR, term_index: 1, name: 'Term 1',
            starts_on: '2026-09-07', ends_on: '2026-11-07', is_current: true }] });
        result = await reminders.runAttendanceReminders();
        assert.equal(result.schools[0].reason, 'between terms');

        seed();
        schoolTime.clock.now = schoolAt(DAY, '15:10');
        result = await reminders.runAttendanceReminders();
        assert.equal(result.due, false);

        assert.equal(nudges().length, 0);
        assert.equal(sentMessages().length, 0);
    });

    test("one class's trip is not a school holiday", async () => {
        seed({ calendar_events: [{ id: 't1', school_id: SCHOOL, class_id: GREEN, title: 'Zoo trip', category: 'holiday',
            starts_on: DAY, ends_on: DAY }] });
        await reminders.runAttendanceReminders();
        assert.equal(nudges('attendance_reminder').length, 2);
    });

    test('the reminder time is configurable (ATTENDANCE_REMINDER_TIME, school time)', async () => {
        process.env.ATTENDANCE_REMINDER_TIME = '10:00';
        assert.equal((await reminders.runAttendanceReminders()).due, false);
        schoolTime.clock.now = schoolAt(DAY, '10:05');
        assert.equal((await reminders.runAttendanceReminders()).due, true);
        assert.equal(nudges('attendance_reminder').length, 2);
    });

    test('the bell sends them: the first feed refresh after 08:45 shows the reminder', async () => {
        const res = await request(app).get('/api/notifications').auth(signToken(MAHILET));
        assert.equal(res.status, 200);
        const reminder = res.body.notifications.find((n) => n.kind === 'attendance_reminder');
        assert.ok(reminder, 'the reminder is in the same response');
        assert.equal(reminder.title, 'Take the register: Year 3 - Blue');
        assert.equal(reminder.link, `/app/attendance?classId=${BLUE}&date=${DAY}`);
        assert.equal(res.body.unreadCount, 1);
        assert.equal(sentMessages().length, 1);

        // Before 08:45 the feed works as before and sends nothing.
        reminders._resetThrottle();
        seed();
        schoolTime.clock.now = schoolAt(DAY, '08:00');
        const early = await request(app).get('/api/notifications').auth(signToken(SENA));
        assert.equal(early.status, 200);
        assert.equal(early.body.notifications.length, 0);
    });

    test('saving the register clears the reminder', async () => {
        await reminders.runAttendanceReminders();
        const blue = STUDENTS.filter((p) => p.class_id === BLUE);
        const res = await request(app).post('/api/attendance').auth(signToken(MAHILET)).send({
            classId: BLUE, date: DAY, subjectId: null,
            records: blue.map((p) => ({ studentId: p.id, status: 'present' })),
        });
        assert.equal(res.status, 201);

        const reminder = nudges('attendance_reminder').find((n) => n.user_id === MAHILET.id);
        assert.ok(reminder.read_at, 'marked read');
        const sena = nudges('attendance_reminder').find((n) => n.user_id === SENA.id);
        assert.equal(sena.read_at ?? null, null, "another class's reminder stays");
    });
});

describe('the cron backstop', () => {
    test('refuses callers without the secret when CRON_SECRET is set', async () => {
        process.env.CRON_SECRET = 'cron-secret-for-tests';
        assert.equal((await request(app).get('/api/cron/attendance-reminders')).status, 401);
        assert.equal((await request(app).get('/api/cron/attendance-reminders').auth('wrong')).status, 401);
        assert.equal(nudges().length, 0);
    });

    test('sends the due reminders and reports counts only', async () => {
        process.env.CRON_SECRET = 'cron-secret-for-tests';
        const res = await request(app).get('/api/cron/attendance-reminders').auth('cron-secret-for-tests');
        assert.equal(res.status, 200);
        assert.deepEqual(res.body.schools, [{
            schoolDay: true, missingRegisters: 3, teachersReminded: 2, telegramSent: 1, officeDigest: true,
        }]);
        assert.doesNotMatch(JSON.stringify(res.body), /Mahilet|Blue/, 'no names in the response');
        assert.equal(nudges('attendance_reminder').length, 2);
    });
});

describe('daily report for the office', () => {
    test("every class's register for today, with who saved it and when", async () => {
        // Green is half done: one of two pupils marked.
        rowsOf('attendance').push(homeroom(STUDENTS.find((p) => p.class_id === GREEN), DAY, 'absent', SENA.id,
            `${DAY}T05:20:00.000Z`));

        const res = await request(app).get('/api/attendance/daily').auth(signToken(ADMIN));
        assert.equal(res.status, 200);
        assert.equal(res.body.date, DAY);
        assert.equal(res.body.isToday, true);
        assert.equal(res.body.timeZone, 'Africa/Addis_Ababa');
        assert.equal(res.body.reminderTime, '08:45');

        const byName = Object.fromEntries(res.body.classes.map((c) => [c.className, c]));
        assert.deepEqual(
            { ...byName['Year 3 - Red'] },
            {
                classId: RED, className: 'Year 3 - Red', mainTeacher: 'Mr. Robel', status: 'taken',
                roster: 2, marked: 2, present: 1, late: 1, absent: 0, excused: 0, rate: 100,
                lastSavedAt: `${DAY}T05:12:00.000Z`, lastSavedBy: 'Mr. Robel',
            },
        );
        assert.equal(byName['Year 3 - Green'].status, 'partial');
        assert.equal(byName['Year 3 - Green'].rate, 0);
        assert.equal(byName['Year 3 - Blue'].status, 'not_taken');
        assert.equal(byName['Year 3 - Blue'].mainTeacher, 'Ms. Mahilet');
        assert.equal(byName['Year 3 - Blue'].rate, null);

        assert.deepEqual(res.body.totals, {
            classes: 5, taken: 2, notTaken: 3, partial: 1, roster: 8,
            marked: 3, present: 1, late: 1, absent: 1, excused: 0, rate: 66.7,
        });
    });

    test('any past day can be looked up; teachers cannot see the school-wide report', async () => {
        const past = await request(app).get('/api/attendance/daily?date=2026-11-11').auth(signToken(ADMIN));
        assert.equal(past.status, 200);
        assert.equal(past.body.isToday, false);
        assert.equal(past.body.totals.taken, 0);

        assert.equal((await request(app).get('/api/attendance/daily').auth(signToken(MAHILET))).status, 403);
        assert.equal((await request(app).get('/api/attendance/daily?date=15-10-2026').auth(signToken(ADMIN))).status, 400);
    });
});

describe('school time (GMT+3) in the reports', () => {
    test('at 01:30 in Addis the dashboard already shows Thursday, though UTC says Wednesday', async () => {
        schoolTime.clock.now = schoolAt(DAY, '01:30');
        assert.equal(schoolTime.clock.now().toISOString().slice(0, 10), '2026-11-11', 'UTC: Wednesday');
        const res = await request(app).get('/api/dashboard/summary').auth(signToken(ADMIN));
        assert.equal(res.status, 200);
        assert.equal(res.body.attendanceToday.marked, 2, "Red's register, dated Thursday");

        const week = await request(app).get('/api/attendance/week').auth(signToken(ADMIN));
        assert.equal(week.body.today, DAY);
        const red = week.body.classes.find((k) => k.classId === RED);
        assert.deepEqual(red.days.filter((d) => d.status === 'taken').map((d) => d.date), [DAY]);
        assert.equal(week.body.days.find((d) => d.isToday).date, DAY);

        const report = await request(app).get('/api/attendance/daily').auth(signToken(ADMIN));
        assert.equal(report.body.date, DAY);
    });
});

describe('Telegram "Mark all present"', () => {
    /**
     * The bulk write takes two taps: the first opens a confirm screen that
     * names the class, the day and the exact number of pupils, the second
     * writes. `ap:<id>` never writes anything by itself.
     */
    const press = (telegramId, data) => handleUpdate({
        callback_query: {
            id: 'cb-1', from: { id: telegramId }, data,
            message: { chat: { id: telegramId }, message_id: 7 },
        },
    });
    const tap = (telegramId, classId) => press(telegramId, `ap:${classId}`);
    const confirm = (telegramId, classId) => press(telegramId, `ap:${classId}:y`);
    const cancel = (telegramId, classId) => press(telegramId, `ap:${classId}:n`);
    const answer = () => telegram.filter((c) => c.method === 'answerCallbackQuery').pop()?.body;
    const lastEdit = () => telegram.filter((c) => c.method === 'editMessageText').pop()?.body;

    test('the first tap asks, naming the class, the day and the pupil count', async () => {
        await tap(111, BLUE);

        assert.equal(rpcCalls.length, 0, 'no write before the confirmation');
        const shown = lastEdit();
        assert.match(shown.text, /Mark all present/);
        assert.match(shown.text, /2 pupils/);
        assert.match(shown.text, /Thu/, 'names the day it will record');
        const buttons = shown.reply_markup.inline_keyboard.flat();
        assert.ok(buttons.some((b) => b.callback_data === `ap:${BLUE}:y`));
        assert.ok(buttons.some((b) => b.callback_data === `ap:${BLUE}:n`));
    });

    test("confirming saves today's register on the school's date and clears the reminder", async () => {
        await reminders.runAttendanceReminders();
        schoolTime.clock.now = schoolAt(DAY, '01:30'); // still Wednesday in UTC

        await tap(111, BLUE);
        await confirm(111, BLUE);

        assert.equal(rpcCalls.length, 1);
        assert.equal(rpcCalls[0].p_date, DAY, 'Thursday in Addis, not UTC Wednesday');
        assert.equal(rpcCalls[0].p_class_id, BLUE);
        assert.equal(answer().text, '✅ 2 marked present');
        assert.ok(nudges('attendance_reminder').find((n) => n.user_id === MAHILET.id).read_at);
    });

    test('cancelling writes nothing and returns to the attendance screen', async () => {
        await tap(111, BLUE);
        await cancel(111, BLUE);

        assert.equal(rpcCalls.length, 0);
        assert.match(answer().text, /Cancelled/);
        assert.match(lastEdit().text, /Attendance — Year 3 - Blue/);
    });

    test('only teaching staff can use it, and a submitted month stays locked', async () => {
        await tap(999, BLUE);
        assert.equal(rpcCalls.length, 0);
        assert.equal(answer().text, 'Only teachers can record attendance');

        // The guard runs on the first tap, so a locked month is refused
        // before the confirm screen is even shown.
        telegram = [];
        rowsOf('attendance_submissions').push({ id: 's1', school_id: SCHOOL, class_id: BLUE, month: DAY.slice(0, 7), status: 'submitted' });
        await tap(111, BLUE);
        assert.equal(rpcCalls.length, 0);
        assert.match(answer().text, /locked/);
        assert.equal(answer().show_alert, true);
    });

    test('a confirm tap on a locked month still writes nothing', async () => {
        // The month may be submitted while the confirm screen is open; the
        // write re-checks rather than trusting the earlier screen.
        rowsOf('attendance_submissions').push({ id: 's1', school_id: SCHOOL, class_id: BLUE, month: DAY.slice(0, 7), status: 'submitted' });
        await confirm(111, BLUE);

        assert.equal(rpcCalls.length, 0);
        assert.match(answer().text, /locked/);
    });
});
