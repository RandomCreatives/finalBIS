const env = require('../config/env');
const supabase = require('../config/supabase');
const {
    sendTelegramMessage,
    editMessageText,
    answerCallbackQuery,
} = require('../utils/telegram');
const schoolTime = require('../utils/schoolTime');
const { resolveAttendanceReminder } = require('./attendanceReminders');
const { consumeLinkToken, LINK_PAYLOAD_PREFIX } = require('./telegramLink');
const menus = require('./telegramMenus');

const WEB_APP = process.env.FRONTEND_URL || 'https://final-bis.vercel.app';

// ---------------------------------------------------------------------------
// Inline keyboard helpers
// ---------------------------------------------------------------------------
const btn = (text, callback_data) => ({ text, callback_data });
const urlBtn = (text, url) => ({ text, url });
const kb = (rows) => ({ inline_keyboard: rows });

// Dates and weekdays on the school's clock (Addis Ababa, GMT+3), not the server's UTC.
// (Label shortening and callback encoding live in services/telegramMenus.js.)
const todayStr = () =>
    schoolTime.formatDay(schoolTime.todayIso(), { weekday: 'long', day: 'numeric', month: 'short' });

// Homeroom & leadership roles that record daily attendance in Telegram.
// Subject teachers do not take daily class attendance.
const ATTENDANCE_ROLES = new Set(['admin', 'main_teacher', 'assistant_teacher']);

// ---------------------------------------------------------------------------
// Data access (scoped exactly like the HTTP controllers)
// ---------------------------------------------------------------------------
async function resolveUser(chatId) {
    const numeric = Number(chatId);
    let { data } = await supabase
        .from('users')
        .select('*')
        .eq('telegram_id', numeric)
        .maybeSingle();

    if (!data && !Number.isNaN(numeric)) {
        ({ data } = await supabase
            .from('users')
            .select('*')
            .eq('telegram_id', String(chatId))
            .maybeSingle());
    }
    return data || null;
}

async function getCurrentYearId(user) {
    const { data } = await supabase
        .from('academic_years')
        .select('id')
        .eq('school_id', user.school_id)
        .eq('is_current', true)
        .maybeSingle();
    return data?.id || null;
}

const TT_SELECT = `id, starts_at, ends_at, room, class:classes(name), assignment:class_subjects(subject:subjects(name))`;

async function getTodayTimetable(user, yearId) {
    // DB day_of_week 1=Mon..7=Sun, today at school.
    const dow = schoolTime.weekdayToday();
    const { data, error } = await supabase
        .from('timetable_slots')
        .select(TT_SELECT)
        .eq('teacher_id', user.id)
        .eq('academic_year_id', yearId)
        .eq('day_of_week', dow)
        .order('starts_at');
    if (error) throw error;
    return data || [];
}

/**
 * Today's tasks: everything still open, plus anything completed earlier
 * today. Keeping today's completed tasks on the screen is what makes the
 * ✅/☐ toggle honest — a mis-tap can be undone in the same place instead of
 * the task silently disappearing until it is found in the web app.
 */
async function getMyTasks(user) {
    const select = 'id, title, status, due_on, priority, completed_at';

    const { data: open, error } = await supabase
        .from('tasks')
        .select(select)
        .eq('school_id', user.school_id)
        .eq('assigned_to', user.id)
        .in('status', ['pending', 'in_progress'])
        .order('due_on', { ascending: true, nullsFirst: false });
    if (error) throw error;

    const since = new Date(`${schoolTime.todayIso()}T00:00:00+03:00`).toISOString();
    const { data: doneToday, error: doneError } = await supabase
        .from('tasks')
        .select(select)
        .eq('school_id', user.school_id)
        .eq('assigned_to', user.id)
        .eq('status', 'done')
        .gte('completed_at', since)
        .order('completed_at', { ascending: false })
        .limit(5);
    if (doneError) throw doneError;

    return [...(open || []), ...(doneToday || [])];
}

async function toggleTask(user, taskId) {
    const { data: existing, error: lookupError } = await supabase
        .from('tasks')
        .select('status, assigned_to, assigned_by')
        .eq('id', taskId)
        .eq('school_id', user.school_id)
        .maybeSingle();

    if (lookupError) throw lookupError;
    if (!existing) return false;

    const isAssignee = existing.assigned_to === user.id;
    const isOwner = existing.assigned_by === user.id || user.role === 'admin';
    if (!isAssignee && !isOwner) return false;

    const newStatus = existing.status === 'done' ? 'pending' : 'done';
    const { error } = await supabase
        .from('tasks')
        .update({
            status: newStatus,
            completed_at: newStatus === 'done' ? new Date().toISOString() : null,
        })
        .eq('id', taskId)
        .eq('school_id', user.school_id);

    return !error;
}

async function getMyClasses(user, yearId) {
    const { data, error } = await supabase
        .from('class_staff')
        .select('class:classes(id, name)')
        .eq('user_id', user.id)
        .eq('academic_year_id', yearId)
        .eq('position', 'main');
    if (error) throw error;
    return (data || []).map((r) => r.class).filter(Boolean);
}

async function getKlass(classId, schoolId) {
    const { data } = await supabase
        .from('classes')
        .select('id, name')
        .eq('id', classId)
        .eq('school_id', schoolId)
        .maybeSingle();
    return data || null;
}

async function getStudents(classId) {
    const { data, error } = await supabase
        .from('students')
        .select('id, name, admission_no, roll_num')
        .eq('class_id', classId)
        .eq('is_active', true)
        .order('name');
    if (error) throw error;
    return data || [];
}

async function getNotices(user) {
    const { data: notices, error } = await supabase
        .from('notices')
        .select('id, title, body, audience, requires_ack, posted_on')
        .eq('school_id', user.school_id)
        .in('audience', ['all', user.role])
        .order('is_pinned', { ascending: false })
        .order('posted_on', { ascending: false })
        .limit(5);
    if (error) throw error;

    const ids = (notices || []).map((n) => n.id);
    const acked = new Set();
    if (ids.length) {
        const { data: receipts } = await supabase
            .from('notice_receipts')
            .select('notice_id, acknowledged_at')
            .eq('user_id', user.id)
            .in('notice_id', ids);
        (receipts || []).forEach((r) => {
            if (r.acknowledged_at) acked.add(r.notice_id);
        });
    }
    return { notices: notices || [], acked };
}

async function acknowledgeNotice(user, noticeId) {
    await supabase
        .from('notice_receipts')
        .upsert(
            {
                notice_id: noticeId,
                user_id: user.id,
                read_at: new Date().toISOString(),
                acknowledged_at: new Date().toISOString(),
            },
            { onConflict: 'notice_id,user_id' }
        );
}

/**
 * Guards for "mark all present", shared by the confirm screen and the write.
 *
 * Held to the same rules as the website: staff roles only, the class must be
 * in the user's school, and a submitted (locked) month stays locked for
 * everyone but admins. Returning the roster lets the confirm screen name the
 * exact number of pupils before anything is written — and lets the write
 * reuse the same rows it counted.
 */
async function checkMarkAllPresent(classId, user) {
    if (!ATTENDANCE_ROLES.has(user.role)) return { ok: false, reason: 'Only teachers can record attendance' };

    const klass = await getKlass(classId, user.school_id);
    if (!klass) return { ok: false, reason: 'Class not found' };

    const date = schoolTime.todayIso();
    if (user.role !== 'admin') {
        const { data: submission } = await supabase
            .from('attendance_submissions')
            .select('status')
            .eq('class_id', classId)
            .eq('month', date.slice(0, 7))
            .maybeSingle();
        if (submission?.status === 'submitted') {
            return { ok: false, reason: 'This month is submitted and locked — ask an admin to return it' };
        }
    }

    const students = await getStudents(classId);
    if (!students.length) return { ok: false, reason: 'No students in this class' };

    return { ok: true, klass, students, date };
}

/**
 * Write the register. Re-checks everything first: the confirm screen may have
 * been open for a while, and a month can be submitted in between.
 */
async function markAllPresent(classId, user) {
    const check = await checkMarkAllPresent(classId, user);
    if (!check.ok) return check;

    const records = check.students.map((s) => ({ studentId: s.id, status: 'present', note: '' }));
    const { error } = await supabase.rpc('mark_attendance', {
        p_school_id: user.school_id,
        p_class_id: classId,
        p_subject_id: null,
        p_date: check.date,
        p_marked_by: user.id,
        p_records: records,
    });

    if (error) {
        console.error('[telegram] markAttendance failed:', error.message);
        return { ok: false, reason: 'Failed to save' };
    }

    await resolveAttendanceReminder({ schoolId: user.school_id, classId, date: check.date });
    return { ok: true, klass: check.klass, students: check.students };
}

// ---------------------------------------------------------------------------
// Message + keyboard builders
//
// Every button lives in services/telegramMenus.js — this layer only supplies
// the environment-dependent bits (web URLs, the school's date) and the data.
// ---------------------------------------------------------------------------
const WEB_APP_URL = `${WEB_APP}/app`;
const MINI_APP_URL = `${WEB_APP}/tma/`;
const registerUrl = (classId) =>
    `${WEB_APP}/app/attendance?classId=${classId}&date=${schoolTime.todayIso()}`;

/** Role gate shared by the menu (whether to show Attendance) and the action. */
const canRecordAttendance = (user) => ATTENDANCE_ROLES.has(user.role);

function buildMainMenu(user) {
    const firstName = (user.name || 'there').split(' ')[0];
    return menus.buildMainMenu({
        firstName,
        isTeacher: canRecordAttendance(user),
        webAppUrl: WEB_APP_URL,
        miniAppUrl: MINI_APP_URL,
    });
}

function buildToday(user, yearId, slots, tasks) {
    return menus.buildToday({ dayLabel: todayStr(), slots, tasks });
}

/** Class list. `rowPrefix: 'ca'` turns it into an attendance picker. */
function buildClasses(classes, { title, rowPrefix, pageBase, icon } = {}) {
    return menus.buildClassPicker({ classes, back: 'menu', title, rowPrefix, pageBase, icon });
}

function buildClassDetail(klass, studentCount, user) {
    return menus.buildClassDetail({
        klass,
        studentCount,
        webAppUrl: WEB_APP_URL,
        canTakeAttendance: user ? canRecordAttendance(user) : true,
    });
}

function buildStudents(students, klass, page = 1) {
    return menus.buildRoster({
        students,
        klassName: klass?.name || 'Class',
        classId: klass?.id || '',
        page,
        back: `c:${klass?.id || ''}`,
    });
}

function buildAttendanceOptions(klass) {
    return menus.buildAttendanceOptions({
        klass,
        dayLabel: todayStr(),
        registerUrl: registerUrl(klass.id),
    });
}

function buildAttendanceConfirm(klass, count) {
    return menus.buildAttendanceConfirm({ klass, dayLabel: todayStr(), count });
}

function buildNotices(notices, acked, page = 1) {
    return menus.buildNotices({ notices, acked, page });
}

function buildNoticeConfirm(notice) {
    return menus.buildNoticeConfirm({ notice });
}

// ---------------------------------------------------------------------------
// Edit helpers (re-render the current message after a button press)
// ---------------------------------------------------------------------------
async function editMessage(chatId, messageId, built) {
    return editMessageText(chatId, messageId, built.text, { replyMarkup: built.replyMarkup });
}
const editMenu = (c, m, u) => editMessage(c, m, buildMainMenu(u));

// The data-driven menus are resolved in the *WithData wrappers below:
async function editTodayWithData(chatId, messageId, user) {
    const yearId = await getCurrentYearId(user);
    const slots = yearId ? await getTodayTimetable(user, yearId) : [];
    const tasks = await getMyTasks(user);
    return editMessage(chatId, messageId, buildToday(user, yearId, slots, tasks));
}
async function editClassesWithData(chatId, messageId, user) {
    const yearId = await getCurrentYearId(user);
    const classes = yearId ? await getMyClasses(user, yearId) : [];
    return editMessage(chatId, messageId, buildClasses(classes));
}
async function editNoticesWithData(chatId, messageId, user, page = 1) {
    const { notices, acked } = await getNotices(user);
    return editMessage(chatId, messageId, buildNotices(notices, acked, page));
}
/** "✅ Attendance" from the menu: straight in when there is one class. */
async function editAttendanceShortcut(chatId, messageId, user) {
    const yearId = await getCurrentYearId(user);
    const classes = yearId ? await getMyClasses(user, yearId) : [];

    if (classes.length === 1) {
        return editMessage(chatId, messageId, buildAttendanceOptions(classes[0]));
    }
    if (classes.length === 0) {
        return editMessage(
            chatId,
            messageId,
            menus.buildInfo({
                text: '✅ Attendance\n\nYou are not a main teacher of any class this year, so there is ' +
                    'no homeroom register for you to take. Subject registers are on the web app.',
                rows: [[menus.urlBtn('🌐 Open the web app', WEB_APP_URL)]],
            })
        );
    }
    return editMessage(
        chatId,
        messageId,
        buildClasses(classes, {
            title: '✅ Attendance — which class?',
            rowPrefix: 'ca',
            pageBase: 'at',
            icon: '✅',
        })
    );
}

// ---------------------------------------------------------------------------
// One-time account linking
// ---------------------------------------------------------------------------
/**
 * Plain-English replies for every consume outcome. Nothing here reveals
 * whether a token existed — an unknown token and a token belonging to
 * someone else read the same.
 */
const LINK_REPLIES = {
    linked: '✅ Linked! This Telegram account is now connected to your BIS NOC staff account.',
    invalid:
        '❌ This link is not valid. Open the web app → Settings → Telegram and create a new link.',
    expired:
        '⌛ This link has expired. Links last 10 minutes — open the web app → Settings → Telegram and create a new one.',
    used:
        '❌ This link has already been used. If you need to link again, create a new link in the web app → Settings → Telegram.',
    inactive:
        '🔒 This staff account is not active. Contact the school office.',
    account_already_linked:
        '❌ Your staff account is already linked to a different Telegram account. Unlink it in the web app → Settings → Telegram first.',
    telegram_already_linked:
        '❌ This Telegram account is already linked to another staff member. Unlink it there first, or use a different Telegram account.',
    not_ready:
        '🔒 Telegram linking is not set up on this server yet. Ask the school office to finish the setup.',
};

/** `https://t.me/<bot>?start=link_<token>` — bind the sender to the staff account. */
async function handleLinkStart(msg, chatId, payload) {
    const from = msg.from || {};

    // A link binds a person, so it is only honoured in a private chat — never
    // from a group where anyone could read or forward the payload.
    if (msg.chat?.type && msg.chat.type !== 'private') {
        await sendTelegramMessage(
            chatId,
            '🔒 For your security, Telegram linking only works in a private chat with me.'
        );
        return;
    }

    const token = payload.slice(LINK_PAYLOAD_PREFIX.length);
    const result = await consumeLinkToken({
        token,
        telegramId: from.id,
        username: from.username || null,
    });

    if (!result.ok) {
        await sendTelegramMessage(chatId, LINK_REPLIES[result.code] || LINK_REPLIES.invalid);
        return;
    }

    // Name the staff account and the Telegram id that was bound. It is the
    // fastest way to spot a mix-up (the wrong Telegram account, or a link
    // requested while signed in as somebody else) — and the same id is shown
    // on Settings → Telegram, so the two can be compared at a glance.
    const who = `id ${from.id}${from.username ? ` · @${from.username}` : ''}`;
    const staff = result.user || {};
    const account = staff.name
        ? `${staff.name}${staff.email ? ` (${staff.email})` : ''}`
        : 'your staff account';

    await sendTelegramMessage(
        chatId,
        `${LINK_REPLIES.linked}\n\n👤 Staff account: ${account}\n📱 Telegram: ${who}\n\nSend /start to open your menu.`
    );

    const menu = buildMainMenu(staff);
    await sendTelegramMessage(chatId, menu.text, { replyMarkup: menu.replyMarkup });
}

// ---------------------------------------------------------------------------
// Update handlers
// ---------------------------------------------------------------------------
async function handleMessage(msg) {
    const chatId = msg.chat?.id;
    if (!chatId) return;

    // One-time link: Telegram delivers the deep-link payload as the first
    // argument of /start. Handle it before the linked-user gate, because the
    // whole point is that this account is not linked yet.
    const text = (msg.text || '').trim();
    const startMatch = /^\/start(?:@\w+)?(?:\s+(\S+))?$/i.exec(text);
    const payload = startMatch?.[1] || '';
    if (payload.startsWith(LINK_PAYLOAD_PREFIX)) {
        await handleLinkStart(msg, chatId, payload);
        return;
    }

    const user = await resolveUser(chatId);
    if (!user) {
        await sendTelegramMessage(
            chatId,
            '👋 Welcome to the BIS NOC staff bot.\n\n' +
                'Your Telegram account is not linked yet. Tap "Open Mini App" below to sign in and link right here, ' +
                'or open the web app → Settings → Telegram to create a one-time link.',
            {
                replyMarkup: menus.kb([
                    [menus.webAppBtn('🌐 Open Mini App', MINI_APP_URL)],
                ]),
            }
        );
        return;
    }

    const cmd = text.toLowerCase();
    if (['/start', '/menu', '/help'].includes(cmd)) {
        const menu = buildMainMenu(user);
        await sendTelegramMessage(chatId, menu.text, { replyMarkup: menu.replyMarkup });
        return;
    }

    const menu = buildMainMenu(user);
    await sendTelegramMessage(chatId, "I didn't catch that. Here are your options:", {
        replyMarkup: menu.replyMarkup,
    });
}

async function handleCallback(query) {
    const cbId = query.id;
    const from = query.from;
    const message = query.message;
    const data = query.data;
    const chatId = message?.chat?.id;
    const messageId = message?.message_id;

    const user = await resolveUser(from?.id);
    if (!user) {
        await answerCallbackQuery(cbId, { text: 'Link your Telegram in the web app first.' });
        return;
    }
    if (!chatId || !messageId) {
        await answerCallbackQuery(cbId);
        return;
    }

    // Builders that need DB data are resolved per-branch. Every branch ends
    // by editing the same message, so the chat stays a single, tidy screen
    // instead of a growing pile of keyboards. Older keyboards (sent before
    // this design) keep working: their callbacks are still understood.
    if (data === 'menu') {
        await editMenu(chatId, messageId, user);
    } else if (data === 'today') {
        await editTodayWithData(chatId, messageId, user);

    // ── tasks ────────────────────────────────────────────────────────────
    } else if (data.startsWith('task:done:')) {
        const taskId = data.slice('task:done:'.length);
        const ok = await toggleTask(user, taskId);
        await answerCallbackQuery(cbId, { text: ok ? 'Updated ✓' : 'Could not update', showAlert: !ok });
        if (ok) await editTodayWithData(chatId, messageId, user);

    // ── classes ──────────────────────────────────────────────────────────
    } else if (data === 'cls' || /^cls:\d+$/.test(data)) {
        await editClassesWithData(chatId, messageId, user);
    } else if (data.startsWith('c:')) {
        const classId = data.slice(2);
        const klass = await getKlass(classId, user.school_id);
        if (!klass) {
            await answerCallbackQuery(cbId, { text: 'That class is no longer available', showAlert: true });
            await editClassesWithData(chatId, messageId, user);
            return;
        }
        const students = await getStudents(classId);
        await editMessage(chatId, messageId, buildClassDetail(klass, students.length, user));

    // ── roster (paginated) ───────────────────────────────────────────────
    } else if (data.startsWith('cs:')) {
        const [, classId, page] = data.split(':');
        const klass = await getKlass(classId, user.school_id);
        if (!klass) {
            await answerCallbackQuery(cbId, { text: 'That class is no longer available', showAlert: true });
            await editClassesWithData(chatId, messageId, user);
            return;
        }
        const students = await getStudents(classId);
        await editMessage(chatId, messageId, buildStudents(students, klass, Number(page) || 1));

    // ── attendance ───────────────────────────────────────────────────────
    } else if (data === 'at' || /^at:\d+$/.test(data)) {
        if (!canRecordAttendance(user)) {
            await answerCallbackQuery(cbId, { text: 'Attendance is recorded by homeroom teachers', showAlert: true });
            return;
        }
        await editAttendanceShortcut(chatId, messageId, user);
    } else if (data.startsWith('ca:')) {
        if (!canRecordAttendance(user)) {
            await answerCallbackQuery(cbId, { text: 'Attendance is recorded by homeroom teachers', showAlert: true });
            return;
        }
        const classId = data.slice(3);
        const klass = await getKlass(classId, user.school_id);
        if (!klass) {
            await answerCallbackQuery(cbId, { text: 'That class is no longer available', showAlert: true });
            await editClassesWithData(chatId, messageId, user);
            return;
        }
        await editMessage(chatId, messageId, buildAttendanceOptions(klass));

    // Mark all present is a bulk write: ap:<id> asks, ap:<id>:y writes,
    // ap:<id>:n goes back. Nothing is written without the extra tap.
    } else if (data.startsWith('ap:')) {
        const [, classId, action] = data.split(':');

        if (action === 'n') {
            const klass = await getKlass(classId, user.school_id);
            await answerCallbackQuery(cbId, { text: 'Cancelled — nothing was saved' });
            if (klass) await editMessage(chatId, messageId, buildAttendanceOptions(klass));
            return;
        }

        const check = await checkMarkAllPresent(classId, user);
        if (!check.ok) {
            await answerCallbackQuery(cbId, { text: check.reason, showAlert: true });
            return;
        }

        if (action !== 'y') {
            await answerCallbackQuery(cbId);
            await editMessage(chatId, messageId, buildAttendanceConfirm(check.klass, check.students.length));
            return;
        }

        const result = await markAllPresent(classId, user);
        await answerCallbackQuery(cbId, {
            text: result.ok
                ? `✅ ${check.students.length} marked present`
                : result.reason,
            showAlert: !result.ok,
        });
        if (result.ok) {
            await editMessage(chatId, messageId, buildClassDetail(result.klass, result.students.length, user));
        }

    // ── notices (paginated) ──────────────────────────────────────────────
    } else if (data === 'nt' || /^nt:\d+$/.test(data)) {
        await editNoticesWithData(chatId, messageId, user, Number(data.split(':')[1]) || 1);

    // Acknowledging is a permanent record: na:<id> asks, na:<id>:y confirms.
    } else if (data.startsWith('na:')) {
        const [, noticeId, action] = data.split(':');
        const { notices, acked } = await getNotices(user);
        const notice = notices.find((n) => String(n.id) === noticeId);

        if (!notice) {
            await answerCallbackQuery(cbId, { text: 'That notice is no longer available', showAlert: true });
            await editNoticesWithData(chatId, messageId, user);
            return;
        }

        if (action === 'n') {
            await answerCallbackQuery(cbId, { text: 'Cancelled' });
            await editNoticesWithData(chatId, messageId, user);
            return;
        }

        if (action !== 'y') {
            // Already acknowledged? Then there is nothing to confirm.
            if (acked.has(notice.id)) {
                await answerCallbackQuery(cbId, { text: 'Already acknowledged ✓' });
                return;
            }
            await answerCallbackQuery(cbId);
            await editMessage(chatId, messageId, buildNoticeConfirm(notice));
            return;
        }

        await acknowledgeNotice(user, notice.id);
        await answerCallbackQuery(cbId, { text: 'Acknowledged ✓' });
        await editNoticesWithData(chatId, messageId, user);

    } else {
        await answerCallbackQuery(cbId, { text: 'That button is out of date — opening the menu' });
        await editMenu(chatId, messageId, user);
    }
}

async function handleUpdate(update) {
    if (!update) return;
    if (update.message) await handleMessage(update.message);
    else if (update.callback_query) await handleCallback(update.callback_query);
}

/**
 * Express handler for the Telegram webhook. Verifies the secret token header
 * (when configured), acknowledges Telegram immediately, then processes the
 * update off the request cycle so we never hit Telegram's 60s timeout.
 */
const webhookHandler = (req, res) => {
    const secret = env.telegram.webhookSecret;
    if (secret) {
        const header = req.headers['x-telegram-bot-api-secret-token'];
        if (header !== secret) {
            res.status(401).json({ error: 'unauthorized' });
            return;
        }
    }

    res.status(200).send('ok');
    handleUpdate(req.body).catch((err) => console.error('[telegram] update handling failed:', err));
};

module.exports = { handleUpdate, webhookHandler };
