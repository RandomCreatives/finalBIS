/**
 * Inline keyboard design rules.
 *
 * Every button the bot can render is collected here and checked against the
 * rules the design depends on, so a new screen cannot quietly break them:
 * Telegram's 64-byte callback limit, compact rows, a fixed emoji lexicon, one
 * escape hatch per screen, pagination instead of silent truncation, and
 * confirm screens for anything that writes.
 */
const { test, describe } = require('node:test');
const assert = require('node:assert/strict');

const menus = require('../services/telegramMenus');

const { MAX_CALLBACK_BYTES, LEXICON, callbackBytes, trunc } = menus;

const UUID = '1a2b3c4d-5e6f-4a7b-8c9d-0e1f2a3b4c5d';
const STUDENT_UUID = '2b3c4d5e-6f7a-4b8c-9d0e-1f2a3b4c5d6e';
const DAY = 'Thursday 12 Nov';

const klass = { id: UUID, name: 'Year 4 - Magenta' };
const notices = Array.from({ length: 7 }, (_, i) => ({
    id: `notice-${i + 1}`,
    title: `Notice number ${i + 1} about something reasonably long`,
    body: `Full body text for notice number ${i + 1}. Please review before Friday morning.`,
    posted_on: '2026-10-20',
    requires_ack: i % 2 === 0,
}));
const tasks = Array.from({ length: 3 }, (_, i) => ({
    id: `task-${i + 1}`, title: `Task ${i + 1}`, status: 'pending', due_on: '2026-10-30',
}));
const slots = [{
    starts_at: '08:30:00', ends_at: '09:10:00', room: 'R12',
    class: { name: 'Year 4 - Magenta' }, assignment: { subject: { name: 'Mathematics' } },
}];
const students = Array.from({ length: 37 }, (_, i) => ({
    id: i === 0 ? STUDENT_UUID : `s-${i}`,
    name: `Pupil ${i + 1}`,
    admission_no: `BIS-${i + 1}`,
    roll_num: i + 1,
    guardian_name: 'Dawit Bekele',
    guardian_phone: '+251911223344',
    special_needs: i === 0,
    sen_teacher_name: i === 0 ? 'Ms. Rahel' : null,
}));
const classes = Array.from({ length: 14 }, (_, i) => ({ id: `class-${i}`, name: `Year 4 - Class ${i + 1}` }));

/** Every screen the bot can build, keyed by a readable name. */
const screens = {
    'main menu': menus.buildMainMenu({ firstName: 'Meron', isTeacher: true, webAppUrl: 'https://x/app' }),
    'main menu (non-teacher)': menus.buildMainMenu({ firstName: 'Ada', isTeacher: false, webAppUrl: 'https://x/app' }),
    'main menu (subject teacher)': menus.buildMainMenu({
        firstName: 'Dawit',
        isTeacher: false,
        role: 'subject_teacher',
        webAppUrl: 'https://x/subject-home',
        miniAppUrl: 'https://x/tma/',
        marksAppUrl: 'https://x/tma/marks',
    }),
    'main menu (admin)': menus.buildMainMenu({
        firstName: 'Hanna',
        isTeacher: true,
        role: 'admin',
        webAppUrl: 'https://x/app',
        miniAppUrl: 'https://x/tma/',
    }),
    today: menus.buildToday({ dayLabel: DAY, slots, tasks }),
    'today with weekday switcher': menus.buildToday({ dayLabel: DAY, slots, tasks, dow: 3, isToday: false }),
    'today empty': menus.buildToday({ dayLabel: DAY }),
    'class picker': menus.buildClassPicker({ classes }),
    'class picker page 2': menus.buildClassPicker({ classes, page: 2 }),
    'class picker empty': menus.buildClassPicker({ classes: [] }),
    'class picker (attendance)': menus.buildClassPicker({
        classes, title: '✅ Attendance — which class?', rowPrefix: 'ca', pageBase: 'at', icon: '✅',
    }),
    'class detail': menus.buildClassDetail({ klass, studentCount: 29, webAppUrl: 'https://x/app' }),
    'class detail (subject teacher)': menus.buildClassDetail({
        klass,
        studentCount: 29,
        subjects: ['French'],
        webAppUrl: 'https://x/subject-home',
        miniAppUrl: 'https://x/tma/',
        marksheetUrl: 'https://x/tma/marks?classId=123',
        canTakeAttendance: false,
    }),
    roster: menus.buildRoster({ students, klassName: klass.name, classId: UUID, back: `c:${UUID}` }),
    'student detail': menus.buildStudentDetail({
        student: students[0],
        klassName: klass.name,
        back: `cs:${UUID}:1`,
    }),
    'attendance options': menus.buildAttendanceOptions({
        klass,
        dayLabel: DAY,
        summary: {
            total: 29,
            marked: 29,
            present: 27,
            absent: 1,
            late: 1,
            excused: 0,
            exceptions: [
                { name: 'Pupil 1', status: 'absent' },
                { name: 'Pupil 2', status: 'late' },
            ],
        },
        registerUrl: 'https://x/app/attendance',
        miniAppRegisterUrl: 'https://x/tma/attendance',
    }),
    'inline register': menus.buildInlineRegister({
        klass,
        dayLabel: DAY,
        students,
        statusByStudent: { [STUDENT_UUID]: 'absent', 's-1': 'late', 's-2': 'present' },
        page: 1,
    }),
    'fill present confirm': menus.buildFillPresentConfirm({
        klass,
        dayLabel: DAY,
        unmarkedCount: 27,
        exceptionCount: 2,
    }),
    'attendance confirm': menus.buildAttendanceConfirm({ klass, dayLabel: DAY, count: 29 }),
    'school pulse': menus.buildSchoolPulse({
        dayLabel: DAY,
        totals: { classes: 13, taken: 10, present: 240, absent: 8, late: 5, excused: 1 },
        missing: [{ className: 'Year 3 - Blue', teacherName: 'Ms. Mahilet' }],
        miniAppUrl: 'https://x/tma/',
    }),
    notices: menus.buildNotices({ notices, acked: new Set() }),
    'notices page 2': menus.buildNotices({ notices, acked: new Set(), page: 2 }),
    'notice detail': menus.buildNoticeDetail({ notice: notices[0], acked: false, back: 'nt:1' }),
    'notice confirm': menus.buildNoticeConfirm({ notice: notices[0] }),
    'notice push': menus.buildNoticePush({ notice: notices[0] }),
    'task push': menus.buildTaskPush({ task: tasks[0], assignedByName: 'Admin' }),
    'info screen': menus.buildInfo({ text: 'Nothing here' }),
};

const allButtons = Object.entries(screens).flatMap(([name, screen]) =>
    (screen.replyMarkup.inline_keyboard || []).flatMap((row, rowIndex) =>
        row.map((button) => ({ screen: name, rowIndex, button }))
    )
);

describe('inline keyboard design rules', () => {
    test('every screen has buttons', () => {
        for (const [name, screen] of Object.entries(screens)) {
            assert.ok(screen.replyMarkup.inline_keyboard.length > 0, `${name} has no keyboard`);
            assert.ok(typeof screen.text === 'string' && screen.text.length > 0, `${name} has no text`);
        }
    });

    test("callback_data fits Telegram's 64-byte limit", () => {
        for (const { screen, button } of allButtons) {
            if (!button.callback_data) continue;
            assert.ok(
                callbackBytes(button.callback_data) <= MAX_CALLBACK_BYTES,
                `${screen}: "${button.callback_data}" is ${callbackBytes(button.callback_data)} bytes`
            );
        }
    });

    test('callback_data is ASCII and namespaced as area[:action][:id][:page]', () => {
        for (const { screen, button } of allButtons) {
            const data = button.callback_data;
            if (!data) continue;
            assert.match(data, /^[\x20-\x7e]+$/, `${screen}: "${data}" is not ASCII`);
            assert.match(
                data,
                /^[a-z]+(:[A-Za-z0-9-]+){0,3}$/,
                `${screen}: "${data}" does not follow area[:action][:id][:page]`
            );
        }
    });

    test('rows hold three buttons at most', () => {
        for (const { screen, rowIndex, button } of allButtons) {
            const row = screens[screen].replyMarkup.inline_keyboard[rowIndex];
            assert.ok(row.length <= 3, `${screen} row ${rowIndex} has ${row.length} buttons ("${button.text}")`);
        }
    });

    test('labels stay short enough to read on a phone', () => {
        for (const { screen, button } of allButtons) {
            assert.ok(button.text.length <= 34, `${screen}: label "${button.text}" is ${button.text.length} chars`);
            assert.ok(!/\n/.test(button.text), `${screen}: label contains a newline`);
        }
    });

    test('every button uses an emoji from the shared lexicon', () => {
        for (const { screen, button } of allButtons) {
            assert.ok(
                LEXICON.some((icon) => button.text.startsWith(icon)) || /^\d+\/\d+$/.test(button.text),
                `${screen}: "${button.text}" does not start with a lexicon icon`
            );
        }
    });

    test('every sub-screen offers a way back, and every screen a way home', () => {
        for (const [name, screen] of Object.entries(screens)) {
            if (name.startsWith('main menu')) continue; // top level: nothing to go back to
            const buttons = screen.replyMarkup.inline_keyboard.flat();
            const hasMenu = buttons.some((b) => b.callback_data === 'menu');
            const hasBack = buttons.some((b) => b.text.startsWith('⬅️') || b.text.startsWith('✖️'));
            assert.ok(hasMenu || hasBack, `${name} is a dead end`);
        }
    });

    test('URL and Mini App buttons are real https buttons, never mixed with callbacks', () => {
        for (const { screen, button } of allButtons) {
            if (button.url) {
                assert.equal(button.callback_data, undefined, `${screen}: "${button.text}" mixes url and callback`);
                assert.match(button.url, /^https:\/\//, `${screen}: "${button.text}" is not https`);
            }
            if (button.web_app) {
                assert.equal(button.callback_data, undefined, `${screen}: "${button.text}" mixes web_app and callback`);
                assert.match(button.web_app.url, /^https:\/\//, `${screen}: "${button.text}" web_app is not https`);
            }
        }
    });

    test('messages stay far below Telegram\'s 4096-character cap', () => {
        for (const [name, screen] of Object.entries(screens)) {
            assert.ok(screen.text.length < 3500, `${name} is ${screen.text.length} characters`);
        }
    });
});

describe('two-up menu and role navigation', () => {
    test('the main menu puts four destinations in two rows', () => {
        const rows = screens['main menu'].replyMarkup.inline_keyboard;
        assert.equal(rows[0].length, 2);
        assert.equal(rows[1].length, 2);
        assert.deepEqual(rows[0].map((b) => b.callback_data), ['today', 'cls']);
        assert.deepEqual(rows[1].map((b) => b.callback_data), ['at', 'nt']);
        assert.equal(rows[2][0].url, 'https://x/app', 'the web app opens as a URL button');
    });

    test('non-teaching staff and subject teachers do not see the attendance shortcut', () => {
        const nonTeacher = screens['main menu (non-teacher)'].replyMarkup.inline_keyboard.flat().map((b) => b.callback_data);
        assert.ok(!nonTeacher.includes('at'));
        assert.ok(nonTeacher.includes('nt'));

        const subjButtons = screens['main menu (subject teacher)'].replyMarkup.inline_keyboard.flat();
        assert.ok(!subjButtons.some((b) => b.callback_data === 'at'));
        assert.ok(subjButtons.some((b) => b.web_app?.url === 'https://x/tma/marks'));
    });

    test('admins get a live School pulse button on the main menu', () => {
        const adminButtons = screens['main menu (admin)'].replyMarkup.inline_keyboard.flat();
        assert.ok(adminButtons.some((b) => b.callback_data === 'pulse'));
    });

    test('Back goes to the parent, never to an action', () => {
        const back = screens['class detail'].replyMarkup.inline_keyboard
            .flat().find((b) => b.text.startsWith('⬅️'));
        assert.equal(back.callback_data, 'cls', 'the class detail returns to the class list');
    });
});

describe('destructive actions ask first', () => {
    test('"mark all present" is one tap to a confirm screen, not a write', () => {
        const buttons = screens['attendance options'].replyMarkup.inline_keyboard.flat();
        const start = buttons.find((b) => b.text.includes('Mark all present'));
        assert.equal(start.callback_data, `ap:${UUID}`, 'the first tap only asks');

        const confirmButtons = screens['attendance confirm'].replyMarkup.inline_keyboard.flat();
        const yes = confirmButtons.find((b) => b.text.includes('Yes'));
        const no = confirmButtons.find((b) => b.text.startsWith('✖️'));
        assert.equal(yes.callback_data, `ap:${UUID}:y`);
        assert.equal(no.callback_data, `ap:${UUID}:n`);
    });

    test('the confirm screen names the class, the day and the exact count', () => {
        const { text } = menus.buildAttendanceConfirm({ klass, dayLabel: DAY, count: 29 });
        assert.match(text, /Year 4 - Magenta/);
        assert.match(text, /Thursday 12 Nov/);
        assert.match(text, /29 pupils/);
    });

    test('the count is singular for one pupil', () => {
        const { text } = menus.buildAttendanceConfirm({ klass, dayLabel: DAY, count: 1 });
        assert.match(text, /1 pupil\b/);
        assert.doesNotMatch(text, /1 pupils/);
    });

    test('acknowledging a notice asks first, naming the notice', () => {
        const list = screens.notices.replyMarkup.inline_keyboard.flat();
        const ack = list.find((b) => b.text.startsWith('☑ Acknowledge'));
        assert.ok(ack, 'notices needing acknowledgement expose an acknowledge button');
        assert.match(ack.callback_data, /^na:notice-\d+$/);

        const confirm = screens['notice confirm'].replyMarkup.inline_keyboard.flat();
        assert.ok(confirm.some((b) => b.callback_data === 'na:notice-1:y'));
        assert.ok(confirm.some((b) => b.callback_data === 'na:notice-1:n'));
        assert.match(screens['notice confirm'].text, /Notice number 1/);
    });

    test('task toggles show state, not outcome', () => {
        const labels = screens.today.replyMarkup.inline_keyboard
            .flat().filter((b) => b.callback_data?.startsWith('task:done:'))
            .map((b) => b.text);
        assert.equal(labels.length, 3);
        assert.ok(labels.every((l) => l.startsWith('☐')), 'open tasks use ☐');

        const done = menus.buildToday({
            dayLabel: DAY, tasks: [{ ...tasks[0], status: 'done' }],
        }).replyMarkup.inline_keyboard.flat().find((b) => b.text.startsWith('☑'));
        assert.ok(done, 'completed tasks use ☑');
    });
});

describe('lists paginate instead of truncating', () => {
    test('notices show a pager, Read buttons, and say which slice is visible', () => {
        const first = screens.notices;
        const buttons = first.replyMarkup.inline_keyboard.flat();
        assert.ok(buttons.some((b) => b.callback_data === 'nt:2'), 'has a next page');
        assert.ok(buttons.some((b) => b.callback_data === 'nv:notice-1:1'), 'has a full-body reader button');
        assert.match(first.text, /showing 1–5 of 7/);
        assert.doesNotMatch(first.text, /Notice number 6/);

        const second = screens['notices page 2'];
        assert.match(second.text, /Notice number 6/, 'the tail is reachable');
        assert.ok(second.replyMarkup.inline_keyboard.flat().some((b) => b.callback_data === 'nt:1'));
    });

    test('a long roster is split across pages with pupil guardian buttons', () => {
        const one = menus.buildRoster({ students, klassName: klass.name, classId: UUID, page: 1, back: `c:${UUID}` });
        const three = menus.buildRoster({ students, klassName: klass.name, classId: UUID, page: 3, back: `c:${UUID}` });

        assert.match(one.text, /37 pupils/);
        assert.match(three.text, /37 pupils/, 'the total does not change with the page');
        assert.match(one.text, /Pupil 1\b/);
        assert.match(three.text, /Pupil 31\b/);
        assert.ok(!/Pupil 31\b/.test(one.text));

        const callbacks = one.replyMarkup.inline_keyboard.flat().map((b) => b.callback_data);
        assert.ok(callbacks.includes(`cs:${UUID}:2`));
        assert.ok(callbacks.includes(`st:${STUDENT_UUID}:1`), 'tapping a pupil opens their guardian card');
    });

    test('an out-of-range page is clamped rather than showing an empty screen', () => {
        const page = menus.buildNotices({ notices, acked: new Set(), page: 99 });
        assert.match(page.text, /Notice number 7/);
    });

    test('no pager when everything fits on one page', () => {
        const one = menus.buildNotices({ notices: notices.slice(0, 2), acked: new Set() });
        assert.doesNotMatch(one.text, /showing/);
        assert.ok(!one.replyMarkup.inline_keyboard.flat().some((b) => b.callback_data === 'nt:2'));
    });
});

describe('helpers', () => {
    test('trunc keeps labels inside their budget and marks the cut', () => {
        assert.equal(trunc('short', 20), 'short');
        const cut = trunc('a'.repeat(40), 20);
        assert.equal(cut.length, 20);
        assert.ok(cut.endsWith('…'));
    });

    test('empty rows are dropped rather than rendered as gaps', () => {
        const built = menus.kb([[menus.btn('✅ One', 'today')], [], [menus.btn('🏠 Menu', 'menu')]]);
        assert.equal(built.inline_keyboard.length, 2);
    });
});
