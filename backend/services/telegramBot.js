const env = require('../config/env');
const supabase = require('../config/supabase');
const {
    sendTelegramMessage,
    editMessageText,
    answerCallbackQuery,
} = require('../utils/telegram');

const WEB_APP = process.env.FRONTEND_URL || 'https://final-bis.vercel.app';

// ---------------------------------------------------------------------------
// Inline keyboard helpers
// ---------------------------------------------------------------------------
const btn = (text, callback_data) => ({ text, callback_data });
const urlBtn = (text, url) => ({ text, url });
const kb = (rows) => ({ inline_keyboard: rows });

// Short text so callback_data stays well under Telegram's 64-byte limit.
const trunc = (s, n) => (s && s.length > n ? `${s.slice(0, n - 1)}…` : s);
const fmtTime = (t) => (t || '').slice(0, 5);
const todayStr = () =>
    new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'short' });

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
    // JS getDay(): 0=Sun..6=Sat → DB day_of_week 1=Mon..7=Sun
    const dow = ((new Date().getDay() + 6) % 7) + 1;
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

async function getMyTasks(user) {
    const { data, error } = await supabase
        .from('tasks')
        .select('id, title, status, due_on, priority')
        .eq('school_id', user.school_id)
        .eq('assigned_to', user.id)
        .in('status', ['pending', 'in_progress'])
        .order('due_on', { ascending: true, nullsFirst: false });
    if (error) throw error;
    return data || [];
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

async function markAllPresent(classId, user) {
    const students = await getStudents(classId);
    if (!students.length) return false;

    const records = students.map((s) => ({ studentId: s.id, status: 'present', note: '' }));
    const { error } = await supabase.rpc('mark_attendance', {
        p_school_id: user.school_id,
        p_class_id: classId,
        p_subject_id: null,
        p_date: new Date().toISOString().slice(0, 10),
        p_marked_by: user.id,
        p_records: records,
    });

    if (error) {
        console.error('[telegram] markAttendance failed:', error.message);
        return false;
    }
    return true;
}

// ---------------------------------------------------------------------------
// Message + keyboard builders
// ---------------------------------------------------------------------------
function buildMainMenu(user) {
    const firstName = (user.name || 'there').split(' ')[0];
    const text = `👋 Hello ${firstName}!\nChoose an option:`;
    const replyMarkup = kb([
        [btn('📅 Today', 'today')],
        [btn('🏫 My Classes', 'cls')],
        [btn('📢 Notices', 'nt')],
        [urlBtn('🌐 Open Web App', `${WEB_APP}/app`)],
    ]);
    return { text, replyMarkup };
}

function buildToday(user, yearId, slots, tasks) {
    let text = `📅 Today — ${todayStr()}\n\n`;
    if (slots.length) {
        text += '🕒 Schedule\n';
        slots.forEach((s) => {
            const subject = s.assignment?.subject?.name || 'Lesson';
            const className = s.class?.name || '';
            text += `• ${fmtTime(s.starts_at)}–${fmtTime(s.ends_at)}  ${subject}`;
            if (className) text += ` (${className})`;
            if (s.room) text += ` · ${s.room}`;
            text += '\n';
        });
    } else {
        text += '🕒 No lessons scheduled today.\n';
    }

    text += '\n✅ Your tasks\n';
    if (tasks.length) {
        tasks.slice(0, 8).forEach((t) => {
            text += `• ${t.title}${t.due_on ? ` (due ${t.due_on})` : ''}\n`;
        });
    } else {
        text += '• Nothing pending. 🎉\n';
    }

    const rows = tasks.slice(0, 8).map((t) => [btn(`✅ ${trunc(t.title, 28)}`, `task:done:${t.id}`)]);
    rows.push([btn('🔄 Refresh', 'today'), btn('⬅️ Menu', 'menu')]);
    return { text, replyMarkup: kb(rows) };
}

function buildClasses(classes) {
    let text = '🏫 Your classes (main teacher)\n\n';
    if (classes.length) classes.forEach((c) => (text += `• ${c.name}\n`));
    else text += 'You are not a main teacher for any class this year.\n';

    const rows = classes.slice(0, 10).map((c) => [btn(`🏫 ${c.name}`, `c:${c.id}`)]);
    rows.push([btn('⬅️ Menu', 'menu')]);
    return { text, replyMarkup: kb(rows) };
}

function buildClassDetail(klass, studentCount) {
    const text = `🏫 ${klass?.name || 'Class'}\n👥 ${studentCount} student(s)\n`;
    const replyMarkup = kb([
        [btn('👥 Students', `cs:${klass.id}`)],
        [btn('✅ Take Attendance', `ca:${klass.id}`)],
        [btn('⬅️ Back', 'cls')],
    ]);
    return { text, replyMarkup };
}

function buildStudents(students, classId) {
    let text = `👥 Students (${students.length})\n\n`;
    students.slice(0, 30).forEach((s, i) => {
        text += `${i + 1}. ${s.name}${s.admission_no ? ` (${s.admission_no})` : ''}\n`;
    });
    if (students.length > 30) text += `…and ${students.length - 30} more\n`;
    const replyMarkup = kb([[btn('⬅️ Back', `c:${classId}`)]]);
    return { text, replyMarkup };
}

function buildAttendanceOptions(klass, classId) {
    const text = `✅ Attendance — ${klass?.name || 'class'}\nQuick action, or open the full register.`;
    const replyMarkup = kb([
        [btn('✅ Mark all present', `ap:${classId}`)],
        [urlBtn('🌐 Detailed register', `${WEB_APP}/app/attendance?class=${classId}`)],
        [btn('⬅️ Back', `c:${classId}`)],
    ]);
    return { text, replyMarkup };
}

function buildNotices(notices, acked) {
    let text = '📢 Recent notices\n\n';
    if (notices.length) {
        notices.forEach((n) => {
            const flag = n.requires_ack && !acked.has(n.id) ? '  [needs ack]' : '';
            text += `• ${n.title}${flag}\n`;
        });
    } else {
        text += 'No notices.\n';
    }

    const rows = notices
        .filter((n) => n.requires_ack && !acked.has(n.id))
        .slice(0, 8)
        .map((n) => [btn(`✅ Ack: ${trunc(n.title, 22)}`, `na:${n.id}`)]);
    rows.push([btn('⬅️ Menu', 'menu')]);
    return { text, replyMarkup: kb(rows) };
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
async function editNoticesWithData(chatId, messageId, user) {
    const { notices, acked } = await getNotices(user);
    return editMessage(chatId, messageId, buildNotices(notices, acked));
}

// ---------------------------------------------------------------------------
// Update handlers
// ---------------------------------------------------------------------------
async function handleMessage(msg) {
    const chatId = msg.chat?.id;
    if (!chatId) return;

    const user = await resolveUser(chatId);
    if (!user) {
        await sendTelegramMessage(
            chatId,
            '👋 Welcome to the BIS NOC staff bot.\n\n' +
                'Your Telegram account is not linked yet. Open the web app → Settings → Link Telegram, then send /start again.'
        );
        return;
    }

    const cmd = (msg.text || '').trim().toLowerCase();
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

    // Builders that need DB data are resolved per-branch.
    if (data === 'menu') {
        await editMenu(chatId, messageId, user);
    } else if (data === 'today') {
        await editTodayWithData(chatId, messageId, user);
    } else if (data.startsWith('task:done:')) {
        const taskId = data.slice('task:done:'.length);
        const ok = await toggleTask(user, taskId);
        await answerCallbackQuery(cbId, { text: ok ? 'Updated ✓' : 'Could not update' });
        if (ok) await editTodayWithData(chatId, messageId, user);
    } else if (data === 'cls') {
        await editClassesWithData(chatId, messageId, user);
    } else if (data.startsWith('c:')) {
        const classId = data.slice(2);
        const klass = await getKlass(classId, user.school_id);
        const students = await getStudents(classId);
        await editMessage(chatId, messageId, buildClassDetail(klass, students.length));
    } else if (data.startsWith('cs:')) {
        const classId = data.slice(3);
        const students = await getStudents(classId);
        await editMessage(chatId, messageId, buildStudents(students, classId));
    } else if (data.startsWith('ca:')) {
        const classId = data.slice(3);
        const klass = await getKlass(classId, user.school_id);
        await editMessage(chatId, messageId, buildAttendanceOptions(klass, classId));
    } else if (data.startsWith('ap:')) {
        const classId = data.slice(3);
        const ok = await markAllPresent(classId, user);
        await answerCallbackQuery(cbId, { text: ok ? '✅ All present saved' : 'Failed to save' });
        if (ok) {
            const klass = await getKlass(classId, user.school_id);
            const students = await getStudents(classId);
            await editMessage(chatId, messageId, buildClassDetail(klass, students.length));
        }
    } else if (data === 'nt') {
        await editNoticesWithData(chatId, messageId, user);
    } else if (data.startsWith('na:')) {
        const noticeId = data.slice(3);
        await acknowledgeNotice(user, noticeId);
        await answerCallbackQuery(cbId, { text: 'Acknowledged ✓' });
        await editNoticesWithData(chatId, messageId, user);
    } else {
        await answerCallbackQuery(cbId, { text: 'Unknown action' });
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
