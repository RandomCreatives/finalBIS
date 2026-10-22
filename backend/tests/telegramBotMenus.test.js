/**
 * The bot's inline-keyboard journeys, driven exactly as Telegram delivers
 * them (callback_query updates).
 *
 * These cover the design rules end to end rather than in the builders alone:
 * every screen edits the same message, Back returns to the parent, the two
 * bulk actions never write on the first tap, lists page through, and buttons
 * from before the redesign still work (old messages never expire).
 */
const { test, describe, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');

const { reset, rowsOf, supabaseStub } = require('./helpers');
const { handleUpdate } = require('../services/telegramBot');

const SCHOOL = '0a5eae91-5307-4125-b24f-876bb3f529b8';
const YEAR = '9a6ff1d0-6d70-4a38-b6e7-c1f4f3dc63aa';
const CLASS_ID = 'c0000000-0000-4000-8000-000000000001';
const OTHER_CLASS = 'c0000000-0000-4000-8000-000000000002';
const TEACHER = 'b0000000-0000-4000-8000-000000000001';
const TASK = 'f0000000-0000-4000-8000-000000000001';
const NOTICE_ACK = 'd0000000-0000-4000-8000-000000000001';
const NOTICE_PLAIN = 'd0000000-0000-4000-8000-000000000002';
const TG = 555000111;

const pupils = (n) => Array.from({ length: n }, (_, i) => ({
    id: `a0000000-0000-4000-8000-00000000000${i + 1}`,
    school_id: SCHOOL,
    class_id: CLASS_ID,
    name: `Pupil ${i + 1}`,
    admission_no: `BIS-${i + 1}`,
    roll_num: i + 1,
    is_active: true,
}));

const seed = ({ pupilCount = 3 } = {}) => reset({
    users: [{
        id: TEACHER, school_id: SCHOOL, name: 'Meron Abebe', email: 'meron@school.et',
        password_hash: 'x', role: 'main_teacher', is_active: true, telegram_id: TG,
    }],
    academic_years: [{ id: YEAR, school_id: SCHOOL, name: '2026/2027', is_current: true }],
    classes: [
        { id: CLASS_ID, school_id: SCHOOL, name: 'Year 4 - Magenta' },
        { id: OTHER_CLASS, school_id: SCHOOL, name: 'Year 4 - Violet' },
    ],
    class_staff: [
        { id: 'cs1', school_id: SCHOOL, academic_year_id: YEAR, class_id: CLASS_ID, user_id: TEACHER, position: 'main' },
    ],
    students: pupils(pupilCount),
    tasks: [{
        id: TASK, school_id: SCHOOL, assigned_to: TEACHER, assigned_by: TEACHER,
        title: 'Mark the register', status: 'pending', priority: 'normal', due_on: '2026-10-30',
    }],
    notices: [
        {
            id: NOTICE_ACK, school_id: SCHOOL, title: 'Staff meeting on Friday',
            body: 'In the hall', audience: 'all', requires_ack: true, posted_on: '2026-10-20',
        },
        {
            id: NOTICE_PLAIN, school_id: SCHOOL, title: 'Sports day photos',
            body: 'On the site', audience: 'all', requires_ack: false, posted_on: '2026-10-19',
        },
    ],
    notice_receipts: [],
    attendance_submissions: [],
});

// Capture Bot API calls instead of hitting the network.
const realFetch = global.fetch;
let telegram = [];
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
});

afterEach(() => {
    global.fetch = realFetch;
    delete supabaseStub._rpc.mark_attendance;
});

/** Tap a button exactly as Telegram would. */
const press = (data) => {
    telegram = [];
    return handleUpdate({
        callback_query: {
            id: 'cb-1',
            from: { id: TG },
            data,
            message: { chat: { id: TG }, message_id: 7 },
        },
    });
};

const lastEdit = () => telegram.filter((c) => c.method === 'editMessageText').pop()?.body;
const lastToast = () => telegram.filter((c) => c.method === 'answerCallbackQuery').pop()?.body;
const buttonsOf = (body) => (body?.reply_markup?.inline_keyboard || []).flat();
const hasButton = (body, data) => buttonsOf(body).some((b) => b.callback_data === data);

describe('navigation', () => {
    test('the menu is two rows of two, plus the web app', async () => {
        seed();
        await press('menu');

        const rows = lastEdit().reply_markup.inline_keyboard;
        assert.deepEqual(rows[0].map((b) => b.callback_data), ['today', 'cls']);
        assert.deepEqual(rows[1].map((b) => b.callback_data), ['at', 'nt']);
        assert.ok(rows[2][0].url, 'the web app is a URL button');
    });

    test('menu → classes → class → attendance → back, all on one message', async () => {
        seed();

        await press('cls');
        assert.match(lastEdit().text, /Year 4 - Magenta/);
        assert.ok(hasButton(lastEdit(), `c:${CLASS_ID}`));

        await press(`c:${CLASS_ID}`);
        assert.match(lastEdit().text, /Year 4 - Magenta/);
        assert.match(lastEdit().text, /3 pupils/);

        await press(`ca:${CLASS_ID}`);
        assert.match(lastEdit().text, /Attendance — Year 4 - Magenta/);

        // Back returns to the class, not to an action.
        await press(`c:${CLASS_ID}`);
        assert.match(lastEdit().text, /3 pupils/);
    });

    test('the attendance shortcut walks straight in when there is one class', async () => {
        seed();

        await press('at');

        assert.match(lastEdit().text, /Attendance — Year 4 - Magenta/);
    });

    test('every edit targets the message that was tapped', async () => {
        seed();
        await press('cls');

        assert.equal(lastEdit().message_id, 7);
        assert.equal(lastEdit().chat_id, TG);
    });

    test('a stale button answers with a toast and reopens the menu', async () => {
        seed();

        await press('something:from:an:old:keyboard');

        assert.match(lastToast().text, /out of date/);
        assert.match(lastEdit().text, /What would you like to do/);
    });

    test('a class that disappeared falls back to the list instead of erroring', async () => {
        seed();
        rowsOf('classes').length = 1; // the other class is gone

        await press('c:00000000-0000-4000-8000-0000000000ff');

        assert.match(lastToast().text, /no longer available/);
        assert.match(lastEdit().text, /Your classes/);
    });
});

describe('destructive actions need the second tap', () => {
    test('"mark all present" asks, then writes only on confirm', async () => {
        seed({ pupilCount: 3 });

        await press(`ap:${CLASS_ID}`);
        assert.equal(rpcCalls.length, 0, 'the first tap writes nothing');
        assert.match(lastEdit().text, /3 pupils/);
        assert.ok(hasButton(lastEdit(), `ap:${CLASS_ID}:y`));
        assert.ok(hasButton(lastEdit(), `ap:${CLASS_ID}:n`));

        await press(`ap:${CLASS_ID}:y`);
        assert.equal(rpcCalls.length, 1);
        assert.equal(rpcCalls[0].p_records.length, 3);
        assert.match(lastToast().text, /3 marked present/);
        assert.match(lastEdit().text, /3 pupils/, 'lands back on the class screen');
    });

    test('cancel writes nothing and returns to the attendance screen', async () => {
        seed();

        await press(`ap:${CLASS_ID}`);
        await press(`ap:${CLASS_ID}:n`);

        assert.equal(rpcCalls.length, 0);
        assert.match(lastToast().text, /Cancelled/);
        assert.match(lastEdit().text, /Attendance/);
    });

    test('acknowledging a notice asks, then records the receipt', async () => {
        seed();

        await press(`na:${NOTICE_ACK}`);
        assert.equal(rowsOf('notice_receipts').length, 0, 'nothing recorded yet');
        assert.match(lastEdit().text, /Acknowledge this notice/);
        assert.match(lastEdit().text, /Staff meeting on Friday/);

        await press(`na:${NOTICE_ACK}:y`);

        const receipts = rowsOf('notice_receipts');
        assert.equal(receipts.length, 1);
        assert.equal(receipts[0].notice_id, NOTICE_ACK);
        assert.ok(receipts[0].acknowledged_at);
        assert.match(lastToast().text, /Acknowledged/);
    });

    test('cancelling an acknowledgement records nothing', async () => {
        seed();

        await press(`na:${NOTICE_ACK}`);
        await press(`na:${NOTICE_ACK}:n`);

        assert.equal(rowsOf('notice_receipts').length, 0);
        assert.match(lastEdit().text, /Notices/);
    });
});

describe('lists and toggles', () => {
    test('the roster pages forward and back', async () => {
        seed({ pupilCount: 20 });

        await press(`cs:${CLASS_ID}`);
        assert.match(lastEdit().text, /Pupil 1\b/);
        assert.ok(hasButton(lastEdit(), `cs:${CLASS_ID}:2`));

        await press(`cs:${CLASS_ID}:2`);
        assert.match(lastEdit().text, /Pupil 20\b/);
        assert.doesNotMatch(lastEdit().text, /Pupil 1\)/);
        assert.ok(hasButton(lastEdit(), `cs:${CLASS_ID}:1`));
    });

    test('a task button toggles, and stays on screen so the tap can be undone', async () => {
        seed();

        await press('today');
        assert.ok(hasButton(lastEdit(), `task:done:${TASK}`));
        assert.match(lastEdit().text, /☐ Mark the register/);

        await press(`task:done:${TASK}`);

        assert.equal(rowsOf('tasks')[0].status, 'done');
        assert.match(lastToast().text, /Updated/);
        assert.match(lastEdit().text, /☑ Mark the register/, 'completed today, still visible');

        // Same button, second tap: reopened.
        await press(`task:done:${TASK}`);
        assert.equal(rowsOf('tasks')[0].status, 'pending');
        assert.match(lastEdit().text, /☐ Mark the register/);
    });

    test('a notice without a receipt requirement has no acknowledge button', async () => {
        seed();
        await press('nt');

        assert.ok(!hasButton(lastEdit(), `na:${NOTICE_PLAIN}`));
        assert.ok(hasButton(lastEdit(), `na:${NOTICE_ACK}`));
    });
});

describe('old keyboards keep working', () => {
    test('legacy "cls", "c:" and "ca:" callbacks still open the right screens', async () => {
        seed();

        await press('cls');
        assert.match(lastEdit().text, /Your classes/);

        await press(`c:${CLASS_ID}`);
        assert.match(lastEdit().text, /3 pupils/);

        await press(`ca:${CLASS_ID}`);
        assert.match(lastEdit().text, /Attendance/);
    });
});
