const env = require('../config/env');
const supabase = require('../config/supabase');
const {
    sendTelegramMessage,
    editMessageText,
    answerCallbackQuery,
    setWebhook,
    setMyCommands,
    setChatMenuButton,
    publicWebOrigin,
} = require('../utils/telegram');
const schoolTime = require('../utils/schoolTime');
const { resolveAttendanceReminder } = require('./attendanceReminders');
const { consumeLinkToken, LINK_PAYLOAD_PREFIX } = require('./telegramLink');
const menus = require('./telegramMenus');

const webOrigin = () => publicWebOrigin();

// Dates and weekdays on the school's clock (Addis Ababa, GMT+3), not the server's UTC.
const todayStr = () =>
    schoolTime.formatDay(schoolTime.todayIso(), { weekday: 'long', day: 'numeric', month: 'short' });

// Homeroom & leadership roles that record daily attendance in Telegram.
// Subject teachers do not take daily class attendance.
const ATTENDANCE_ROLES = new Set(['admin', 'main_teacher', 'assistant_teacher']);
const MAIN_TEACHER_MARKSHEET_CODES = new Set(['MAT', 'SCI', 'GLS']);

const STATUS_FROM_CODE = {
    p: 'present',
    a: 'absent',
    l: 'late',
    e: 'excused',
};

const STATUS_LABEL = {
    present: 'Present',
    absent: 'Absent',
    late: 'Late',
    excused: 'Excused',
};

// ---------------------------------------------------------------------------
// Data access (scoped like the HTTP controllers)
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

async function getTimetableForDow(user, yearId, dow) {
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

async function getTodayTimetable(user, yearId) {
    return getTimetableForDow(user, yearId, schoolTime.weekdayToday());
}

/**
 * Today's tasks: everything still open, plus anything completed earlier
 * today. Keeping today's completed tasks on the screen is what makes the
 * ☑/☐ toggle honest — a mis-tap can be undone in the same place instead of
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

async function getTaskForPushView(user, taskId) {
    const { data } = await supabase
        .from('tasks')
        .select('id, title, description, status, due_on, priority, assigned_to, assigned_by')
        .eq('id', taskId)
        .eq('school_id', user.school_id)
        .maybeSingle();
    return data || null;
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

/** Homeroom classes (for Attendance shortcut): all classes for admins, main/assistant seats for teachers. */
async function getHomeroomClasses(user, yearId) {
    if (user.role === 'admin') {
        const { data, error } = await supabase
            .from('classes')
            .select('id, name')
            .eq('school_id', user.school_id)
            .order('name');
        if (error) throw error;
        return data || [];
    }

    if (!yearId) return [];
    const { data, error } = await supabase
        .from('class_staff')
        .select('position, class:classes(id, name)')
        .eq('user_id', user.id)
        .eq('academic_year_id', yearId)
        .in('position', ['main', 'assistant']);
    if (error) throw error;

    const seen = new Map();
    for (const row of data || []) {
        if (row.class?.id && !seen.has(row.class.id)) {
            seen.set(row.class.id, row.class);
        }
    }
    return [...seen.values()];
}

/**
 * Classes visible in `🏫 Classes`:
 *  - Admin: every class in the school
 *  - Subject teacher: distinct classes taught via `class_subjects` (annotated with subject names)
 *  - Main / Assistant teacher: homeroom classes + any subject-taught classes
 */
async function getMyClasses(user, yearId) {
    if (user.role === 'admin') {
        return getHomeroomClasses(user, yearId);
    }

    if (!yearId) return [];

    const byId = new Map();

    if (user.role !== 'subject_teacher') {
        const homerooms = await getHomeroomClasses(user, yearId);
        homerooms.forEach((c) => {
            byId.set(c.id, { id: c.id, name: c.name, subjects: [] });
        });
    }

    const { data: subjectSeats, error: subjError } = await supabase
        .from('class_subjects')
        .select('class_id, subject_id, class:classes(id, name), subject:subjects(id, name, code)')
        .eq('teacher_id', user.id)
        .eq('academic_year_id', yearId);
    if (subjError) throw subjError;

    for (const seat of subjectSeats || []) {
        const cls = seat.class;
        const subj = seat.subject;
        if (!cls?.id) continue;
        if (subj?.code === 'REG') continue;

        const entry = byId.get(cls.id) || { id: cls.id, name: cls.name, subjects: [] };
        if (subj?.name && !entry.subjects.includes(subj.name)) {
            entry.subjects.push(subj.name);
        }
        if (subj?.id && !entry.firstSubjectId) {
            entry.firstSubjectId = subj.id;
        }
        byId.set(cls.id, entry);
    }

    return [...byId.values()]
        .map((c) => ({
            ...c,
            subtitle: c.subjects.length ? c.subjects.join(', ') : undefined,
        }))
        .sort((a, b) => a.name.localeCompare(b.name));
}

/** Resolve subjects taught by `user` in `classId` (for class detail & marksheet deep-link). */
async function getClassTeachingMeta(user, yearId, classId) {
    if (!yearId) return { subjects: [], firstSubjectId: null };

    if (user.role === 'subject_teacher') {
        const { data } = await supabase
            .from('class_subjects')
            .select('subject_id, subject:subjects(id, name, code)')
            .eq('class_id', classId)
            .eq('teacher_id', user.id)
            .eq('academic_year_id', yearId);
        const valid = (data || [])
            .map((r) => r.subject)
            .filter((s) => s?.id && s.code !== 'REG');
        return {
            subjects: [...new Set(valid.map((s) => s.name))],
            firstSubjectId: valid[0]?.id || null,
        };
    }

    if (user.role === 'main_teacher') {
        const { data } = await supabase
            .from('class_subjects')
            .select('subject_id, subject:subjects(id, name, code)')
            .eq('class_id', classId)
            .eq('academic_year_id', yearId);
        const valid = (data || [])
            .map((r) => r.subject)
            .filter((s) => s?.id && MAIN_TEACHER_MARKSHEET_CODES.has(s.code));
        return {
            subjects: [...new Set(valid.map((s) => s.name))],
            firstSubjectId: valid[0]?.id || null,
        };
    }

    return { subjects: [], firstSubjectId: null };
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
        .select('id, class_id, name, admission_no, roll_num, guardian_name, guardian_phone, guardian_email, special_needs, special_needs_note, sen_teacher_name')
        .eq('class_id', classId)
        .eq('is_active', true)
        .order('name');
    if (error) throw error;
    return data || [];
}

async function getStudentById(studentId, schoolId) {
    const { data } = await supabase
        .from('students')
        .select('id, class_id, name, admission_no, roll_num, guardian_name, guardian_phone, guardian_email, special_needs, special_needs_note, sen_teacher_name')
        .eq('id', studentId)
        .eq('school_id', schoolId)
        .eq('is_active', true)
        .maybeSingle();
    return data || null;
}

async function getTodayAttendanceMap(classId, schoolId, date = schoolTime.todayIso()) {
    const { data } = await supabase
        .from('attendance')
        .select('student_id, status')
        .eq('school_id', schoolId)
        .eq('class_id', classId)
        .eq('date', date)
        .is('subject_id', null);

    const map = {};
    for (const row of data || []) {
        if (row.student_id && row.status) {
            map[row.student_id] = row.status;
        }
    }
    return map;
}

function summarizeAttendance(students, statusByStudent) {
    const summary = {
        total: students.length,
        marked: 0,
        present: 0,
        absent: 0,
        late: 0,
        excused: 0,
        exceptions: [],
    };
    for (const s of students) {
        const st = statusByStudent[s.id];
        if (!st) continue;
        summary.marked += 1;
        if (summary[st] !== undefined) summary[st] += 1;
        if (st !== 'present') {
            summary.exceptions.push({ id: s.id, name: s.name, status: st });
        }
    }
    return summary;
}

async function getSchoolPulseData(user) {
    const date = schoolTime.todayIso();
    const yearId = await getCurrentYearId(user);

    const [classesRes, studentsRes, attRes, seatsRes] = await Promise.all([
        supabase.from('classes').select('id, name').eq('school_id', user.school_id).order('name'),
        supabase.from('students').select('id, class_id').eq('school_id', user.school_id).eq('is_active', true),
        supabase.from('attendance')
            .select('class_id, student_id, status')
            .eq('school_id', user.school_id)
            .eq('date', date)
            .is('subject_id', null),
        yearId
            ? supabase.from('class_staff')
                .select('class_id, user:users(name, is_active)')
                .eq('school_id', user.school_id)
                .eq('academic_year_id', yearId)
                .eq('position', 'main')
            : Promise.resolve({ data: [] }),
    ]);

    const pupilCountByClass = new Map();
    for (const s of studentsRes.data || []) {
        if (!s.class_id) continue;
        pupilCountByClass.set(s.class_id, (pupilCountByClass.get(s.class_id) || 0) + 1);
    }

    const teacherByClass = new Map();
    for (const seat of seatsRes.data || []) {
        if (seat.user?.is_active && seat.user.name && !teacherByClass.has(seat.class_id)) {
            teacherByClass.set(seat.class_id, seat.user.name);
        }
    }

    const takenClasses = new Set();
    const totals = { classes: 0, taken: 0, present: 0, absent: 0, late: 0, excused: 0 };

    for (const row of attRes.data || []) {
        if (row.class_id) takenClasses.add(row.class_id);
        if (row.status && totals[row.status] !== undefined) {
            totals[row.status] += 1;
        }
    }

    const activeClasses = (classesRes.data || []).filter((c) => (pupilCountByClass.get(c.id) || 0) > 0);
    totals.classes = activeClasses.length;
    totals.taken = activeClasses.filter((c) => takenClasses.has(c.id)).length;

    const missing = activeClasses
        .filter((c) => !takenClasses.has(c.id))
        .map((c) => ({
            classId: c.id,
            className: c.name,
            teacherName: teacherByClass.get(c.id) || null,
        }));

    return { totals, missing };
}

async function getNotices(user) {
    const { data: notices, error } = await supabase
        .from('notices')
        .select('id, title, body, audience, requires_ack, posted_on')
        .eq('school_id', user.school_id)
        .in('audience', ['all', user.role])
        .order('is_pinned', { ascending: false })
        .order('posted_on', { ascending: false })
        .limit(25);
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

async function recordNoticeRead(user, noticeId) {
    const { data: existing } = await supabase
        .from('notice_receipts')
        .select('notice_id, acknowledged_at')
        .eq('notice_id', noticeId)
        .eq('user_id', user.id)
        .maybeSingle();
    if (existing) return;

    await supabase
        .from('notice_receipts')
        .upsert(
            {
                notice_id: noticeId,
                user_id: user.id,
                read_at: new Date().toISOString(),
            },
            { onConflict: 'notice_id,user_id' }
        );
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
 * Guards for homeroom attendance writes, shared by "mark all present",
 * inline pupil status toggles, and "save rest present".
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

async function saveAttendanceRecords(classId, user, date, records) {
    const { error } = await supabase.rpc('mark_attendance', {
        p_school_id: user.school_id,
        p_class_id: classId,
        p_subject_id: null,
        p_date: date,
        p_marked_by: user.id,
        p_records: records,
    });

    if (error) {
        console.error('[telegram] markAttendance failed:', error.message);
        return { ok: false, reason: 'Failed to save' };
    }
    return { ok: true };
}

/**
 * Write the full register as present. Re-checks everything first: the confirm
 * screen may have been open for a while, and a month can be submitted in between.
 */
async function markAllPresent(classId, user) {
    const check = await checkMarkAllPresent(classId, user);
    if (!check.ok) return check;

    const records = check.students.map((s) => ({ studentId: s.id, status: 'present', note: '' }));
    const saved = await saveAttendanceRecords(classId, user, check.date, records);
    if (!saved.ok) return saved;

    await resolveAttendanceReminder({ schoolId: user.school_id, classId, date: check.date });
    return { ok: true, klass: check.klass, students: check.students };
}

// ---------------------------------------------------------------------------
// Message + keyboard builders
// ---------------------------------------------------------------------------
const webAppUrl = () => `${webOrigin()}/app`;
const subjectWebAppUrl = () => `${webOrigin()}/subject-home`;
const miniAppUrl = () => `${webOrigin()}/tma/`;
const marksAppUrl = () => `${webOrigin()}/tma/marks`;
const registerUrl = (classId) =>
    `${webOrigin()}/app/attendance?classId=${classId}&date=${schoolTime.todayIso()}`;
const miniAppRegisterUrl = (classId) =>
    `${webOrigin()}/tma/attendance?classId=${classId}`;
const miniAppMarksheetUrl = (classId, subjectId) =>
    subjectId
        ? `${webOrigin()}/tma/marks?classId=${classId}&subjectId=${subjectId}`
        : `${webOrigin()}/tma/marks?classId=${classId}`;

/** Role gate shared by the menu (whether to show Attendance) and the action. */
const canRecordAttendance = (user) => ATTENDANCE_ROLES.has(user.role);

function buildMainMenu(user) {
    const firstName = (user.name || 'there').split(' ')[0];
    const isSubject = user.role === 'subject_teacher';
    return menus.buildMainMenu({
        firstName,
        isTeacher: canRecordAttendance(user),
        role: user.role,
        webAppUrl: isSubject ? subjectWebAppUrl() : webAppUrl(),
        miniAppUrl: miniAppUrl(),
        marksAppUrl: marksAppUrl(),
    });
}

function buildToday(user, yearId, slots, tasks, { dow = schoolTime.weekdayToday(), dayLabel = todayStr(), isToday = true } = {}) {
    return menus.buildToday({ dayLabel, slots, tasks, dow, isToday });
}

/** Class list. `rowPrefix: 'ca'` turns it into an attendance picker. */
function buildClasses(classes, { title, emptyText, rowPrefix, page = 1, pageBase, icon } = {}) {
    return menus.buildClassPicker({
        classes,
        back: 'menu',
        title,
        emptyText,
        rowPrefix,
        page,
        pageBase,
        icon,
    });
}

function buildClassDetail(klass, studentCount, user, teachingMeta = {}) {
    const canAtt = user ? canRecordAttendance(user) : true;
    const subjects = teachingMeta.subjects || [];
    const hasMarksheet =
        user?.role === 'subject_teacher' ||
        (user?.role === 'main_teacher' && subjects.length > 0);

    return menus.buildClassDetail({
        klass,
        studentCount,
        subjects,
        webAppUrl: user?.role === 'subject_teacher' ? subjectWebAppUrl() : webAppUrl(),
        miniAppUrl: miniAppUrl(),
        marksheetUrl: hasMarksheet ? miniAppMarksheetUrl(klass.id, teachingMeta.firstSubjectId) : undefined,
        canTakeAttendance: canAtt,
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

function buildAttendanceOptions(klass, summary = null) {
    return menus.buildAttendanceOptions({
        klass,
        dayLabel: todayStr(),
        summary,
        registerUrl: registerUrl(klass.id),
        miniAppRegisterUrl: miniAppRegisterUrl(klass.id),
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

async function editTodayWithData(chatId, messageId, user, requestedDow = null) {
    const todayDow = schoolTime.weekdayToday();
    const dow = requestedDow || todayDow;
    const isToday = !requestedDow || dow === todayDow;

    let dayLabel = todayStr();
    if (!isToday && dow >= 1 && dow <= 5) {
        const weekDates = schoolTime.schoolWeek(schoolTime.todayIso());
        dayLabel = schoolTime.formatDay(weekDates[dow - 1], {
            weekday: 'long',
            day: 'numeric',
            month: 'short',
        });
    }

    const yearId = await getCurrentYearId(user);
    const slots = yearId ? await getTimetableForDow(user, yearId, dow) : [];
    const tasks = await getMyTasks(user);
    return editMessage(chatId, messageId, buildToday(user, yearId, slots, tasks, { dow, dayLabel, isToday }));
}

async function editClassesWithData(chatId, messageId, user, page = 1) {
    const yearId = await getCurrentYearId(user);
    const classes = await getMyClasses(user, yearId);
    const title =
        user.role === 'admin'
            ? '🏫 All school classes'
            : user.role === 'subject_teacher'
                ? '🏫 Classes you teach'
                : '🏫 Your classes';
    const emptyText =
        user.role === 'subject_teacher'
            ? 'No subject teaching assignments found for this academic year.'
            : 'You have no classes assigned this academic year.';

    return editMessage(chatId, messageId, buildClasses(classes, { title, emptyText, page }));
}

async function editClassDetailWithData(chatId, messageId, user, klass) {
    const [students, yearId] = await Promise.all([
        getStudents(klass.id),
        getCurrentYearId(user),
    ]);
    const teachingMeta = await getClassTeachingMeta(user, yearId, klass.id);
    return editMessage(chatId, messageId, buildClassDetail(klass, students.length, user, teachingMeta));
}

async function editAttendanceOptionsWithData(chatId, messageId, user, klass) {
    const [students, statusByStudent] = await Promise.all([
        getStudents(klass.id),
        getTodayAttendanceMap(klass.id, user.school_id),
    ]);
    const summary = summarizeAttendance(students, statusByStudent);
    return editMessage(chatId, messageId, buildAttendanceOptions(klass, summary));
}

async function editInlineRegisterWithData(chatId, messageId, user, klass, page = 1, statusOverride = null) {
    const students = await getStudents(klass.id);
    const statusByStudent = statusOverride || (await getTodayAttendanceMap(klass.id, user.school_id));
    return editMessage(
        chatId,
        messageId,
        menus.buildInlineRegister({
            klass,
            dayLabel: todayStr(),
            students,
            statusByStudent,
            page,
        })
    );
}

async function editSchoolPulseWithData(chatId, messageId, user) {
    const { totals, missing } = await getSchoolPulseData(user);
    return editMessage(
        chatId,
        messageId,
        menus.buildSchoolPulse({
            dayLabel: todayStr(),
            totals,
            missing,
            miniAppUrl: miniAppUrl(),
        })
    );
}

async function editNoticesWithData(chatId, messageId, user, page = 1) {
    const { notices, acked } = await getNotices(user);
    return editMessage(chatId, messageId, buildNotices(notices, acked, page));
}

/** "✅ Attendance" from the menu: straight in when there is one homeroom class. */
async function editAttendanceShortcut(chatId, messageId, user, page = 1) {
    const yearId = await getCurrentYearId(user);
    const classes = await getHomeroomClasses(user, yearId);

    if (classes.length === 1) {
        return editAttendanceOptionsWithData(chatId, messageId, user, classes[0]);
    }
    if (classes.length === 0) {
        return editMessage(
            chatId,
            messageId,
            menus.buildInfo({
                text: '✅ Attendance\n\nYou are not assigned as a class teacher this year, so there is ' +
                    'no homeroom register for you to take.',
                rows: [[menus.urlBtn('🌐 Open the web app', webAppUrl())]],
            })
        );
    }
    return editMessage(
        chatId,
        messageId,
        buildClasses(classes, {
            title: '✅ Attendance — which class?',
            rowPrefix: 'ca',
            page,
            pageBase: 'at',
            icon: '✅',
        })
    );
}

// ---------------------------------------------------------------------------
// Proactive outbound Telegram pushes (Notices & Tasks)
// ---------------------------------------------------------------------------
async function sendNoticeTelegramPushes(notice, senderUserId = null) {
    try {
        if (!notice?.id || !notice?.school_id) return 0;

        let query = supabase
            .from('users')
            .select('id, role, is_active, telegram_id')
            .eq('school_id', notice.school_id)
            .eq('is_active', true);

        if (notice.audience && notice.audience !== 'all') {
            query = query.eq('role', notice.audience);
        }

        const { data: recipients, error } = await query;
        if (error || !recipients?.length) return 0;

        const linked = recipients.filter(
            (u) => u.telegram_id && (!senderUserId || u.id !== senderUserId)
        );
        if (!linked.length) return 0;

        const built = menus.buildNoticePush({ notice });
        const results = await Promise.allSettled(
            linked.map((u) =>
                sendTelegramMessage(u.telegram_id, built.text, { replyMarkup: built.replyMarkup })
            )
        );
        return results.filter((r) => r.status === 'fulfilled' && r.value?.ok).length;
    } catch (err) {
        console.error('[telegram] sendNoticeTelegramPushes failed:', err.message);
        return 0;
    }
}

async function sendTaskTelegramPush(task, senderUser = null) {
    try {
        if (!task?.id || !task?.assigned_to) return false;
        if (senderUser?.id && task.assigned_to === senderUser.id) return false;

        const { data: assignee, error } = await supabase
            .from('users')
            .select('id, is_active, telegram_id')
            .eq('id', task.assigned_to)
            .maybeSingle();

        if (error || !assignee?.is_active || !assignee?.telegram_id) return false;

        const built = menus.buildTaskPush({
            task,
            assignedByName: senderUser?.name || null,
        });
        const res = await sendTelegramMessage(assignee.telegram_id, built.text, {
            replyMarkup: built.replyMarkup,
        });
        return Boolean(res?.ok);
    } catch (err) {
        console.error('[telegram] sendTaskTelegramPush failed:', err.message);
        return false;
    }
}

// ---------------------------------------------------------------------------
// One-time account linking
// ---------------------------------------------------------------------------
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
                    [menus.webAppBtn('🌐 Open Mini App', miniAppUrl())],
                ]),
            }
        );
        return;
    }

    const bareCmd = text.split(/\s+/)[0].replace(/@\w+$/, '').toLowerCase();
    if (['/start', '/menu', '/help'].includes(bareCmd)) {
        const menu = buildMainMenu(user);
        await sendTelegramMessage(chatId, menu.text, { replyMarkup: menu.replyMarkup });
        return;
    }
    if (bareCmd === '/today') {
        const yearId = await getCurrentYearId(user);
        const slots = yearId ? await getTodayTimetable(user, yearId) : [];
        const tasks = await getMyTasks(user);
        const built = buildToday(user, yearId, slots, tasks);
        await sendTelegramMessage(chatId, built.text, { replyMarkup: built.replyMarkup });
        return;
    }
    if (bareCmd === '/classes') {
        const yearId = await getCurrentYearId(user);
        const classes = await getMyClasses(user, yearId);
        const title =
            user.role === 'admin'
                ? '🏫 All school classes'
                : user.role === 'subject_teacher'
                    ? '🏫 Classes you teach'
                    : '🏫 Your classes';
        const built = buildClasses(classes, { title });
        await sendTelegramMessage(chatId, built.text, { replyMarkup: built.replyMarkup });
        return;
    }
    if (bareCmd === '/notices') {
        const { notices, acked } = await getNotices(user);
        const built = buildNotices(notices, acked, 1);
        await sendTelegramMessage(chatId, built.text, { replyMarkup: built.replyMarkup });
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

    // ── main menu & schedule ─────────────────────────────────────────────
    if (data === 'menu') {
        await answerCallbackQuery(cbId);
        await editMenu(chatId, messageId, user);
    } else if (data === 'today') {
        await answerCallbackQuery(cbId);
        await editTodayWithData(chatId, messageId, user);
    } else if (/^day:[1-5]$/.test(data)) {
        const dow = Number(data.split(':')[1]);
        await answerCallbackQuery(cbId);
        await editTodayWithData(chatId, messageId, user, dow);

    // ── admin school pulse ───────────────────────────────────────────────
    } else if (data === 'pulse') {
        if (user.role !== 'admin') {
            await answerCallbackQuery(cbId, { text: 'School pulse is for administrators only', showAlert: true });
            return;
        }
        await answerCallbackQuery(cbId);
        await editSchoolPulseWithData(chatId, messageId, user);

    // ── tasks (Today view & proactive task push cards) ───────────────────
    } else if (data.startsWith('task:done:')) {
        const taskId = data.slice('task:done:'.length);
        const ok = await toggleTask(user, taskId);
        await answerCallbackQuery(cbId, { text: ok ? 'Updated ✓' : 'Could not update', showAlert: !ok });
        if (ok) await editTodayWithData(chatId, messageId, user);
    } else if (data.startsWith('tt:')) {
        const taskId = data.slice(3);
        const ok = await toggleTask(user, taskId);
        await answerCallbackQuery(cbId, { text: ok ? 'Task updated ✓' : 'Could not update', showAlert: !ok });
        if (ok) {
            const task = await getTaskForPushView(user, taskId);
            if (task) {
                await editMessage(chatId, messageId, menus.buildTaskPush({ task }));
            } else {
                await editTodayWithData(chatId, messageId, user);
            }
        }

    // ── classes ──────────────────────────────────────────────────────────
    } else if (data === 'cls' || /^cls:\d+$/.test(data)) {
        const page = Number(data.split(':')[1]) || 1;
        await answerCallbackQuery(cbId);
        await editClassesWithData(chatId, messageId, user, page);
    } else if (data.startsWith('c:')) {
        const classId = data.slice(2);
        const klass = await getKlass(classId, user.school_id);
        if (!klass) {
            await answerCallbackQuery(cbId, { text: 'That class is no longer available', showAlert: true });
            await editClassesWithData(chatId, messageId, user);
            return;
        }
        await answerCallbackQuery(cbId);
        await editClassDetailWithData(chatId, messageId, user, klass);

    // ── roster (paginated) & pupil guardian card ─────────────────────────
    } else if (data.startsWith('cs:')) {
        const [, classId, page] = data.split(':');
        const klass = await getKlass(classId, user.school_id);
        if (!klass) {
            await answerCallbackQuery(cbId, { text: 'That class is no longer available', showAlert: true });
            await editClassesWithData(chatId, messageId, user);
            return;
        }
        const students = await getStudents(classId);
        await answerCallbackQuery(cbId);
        await editMessage(chatId, messageId, buildStudents(students, klass, Number(page) || 1));
    } else if (data.startsWith('st:')) {
        const [, studentId, pageStr] = data.split(':');
        const student = await getStudentById(studentId, user.school_id);
        if (!student) {
            await answerCallbackQuery(cbId, { text: 'Pupil not found', showAlert: true });
            await editClassesWithData(chatId, messageId, user);
            return;
        }
        const klass = await getKlass(student.class_id, user.school_id);
        const page = Number(pageStr) || 1;
        await answerCallbackQuery(cbId);
        await editMessage(
            chatId,
            messageId,
            menus.buildStudentDetail({
                student,
                klassName: klass?.name || 'Class',
                back: student.class_id ? `cs:${student.class_id}:${page}` : 'cls',
            })
        );

    // ── attendance hub & inline exception picker ─────────────────────────
    } else if (data === 'at' || /^at:\d+$/.test(data)) {
        if (!canRecordAttendance(user)) {
            await answerCallbackQuery(cbId, { text: 'Attendance is recorded by homeroom teachers', showAlert: true });
            return;
        }
        const page = Number(data.split(':')[1]) || 1;
        await answerCallbackQuery(cbId);
        await editAttendanceShortcut(chatId, messageId, user, page);
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
        await answerCallbackQuery(cbId);
        await editAttendanceOptionsWithData(chatId, messageId, user, klass);

    } else if (data.startsWith('ar:')) {
        if (!canRecordAttendance(user)) {
            await answerCallbackQuery(cbId, { text: 'Attendance is recorded by homeroom teachers', showAlert: true });
            return;
        }
        const [, classId, pageStr] = data.split(':');
        const check = await checkMarkAllPresent(classId, user);
        if (!check.ok) {
            await answerCallbackQuery(cbId, { text: check.reason, showAlert: true });
            return;
        }
        await answerCallbackQuery(cbId);
        await editInlineRegisterWithData(chatId, messageId, user, check.klass, Number(pageStr) || 1);

    } else if (data.startsWith('am:')) {
        const [, studentId, statusCode, pageStr] = data.split(':');
        const nextStatus = STATUS_FROM_CODE[statusCode];
        if (!nextStatus) {
            await answerCallbackQuery(cbId, { text: 'Invalid attendance status', showAlert: true });
            return;
        }
        const student = await getStudentById(studentId, user.school_id);
        if (!student || !student.class_id) {
            await answerCallbackQuery(cbId, { text: 'Pupil not found', showAlert: true });
            return;
        }
        const check = await checkMarkAllPresent(student.class_id, user);
        if (!check.ok) {
            await answerCallbackQuery(cbId, { text: check.reason, showAlert: true });
            return;
        }

        const saved = await saveAttendanceRecords(student.class_id, user, check.date, [
            { studentId: student.id, status: nextStatus, note: '' },
        ]);
        if (!saved.ok) {
            await answerCallbackQuery(cbId, { text: saved.reason, showAlert: true });
            return;
        }

        const currentMap = await getTodayAttendanceMap(student.class_id, user.school_id, check.date);
        const updatedMap = { ...currentMap, [student.id]: nextStatus };
        if (check.students.every((s) => Boolean(updatedMap[s.id]))) {
            await resolveAttendanceReminder({
                schoolId: user.school_id,
                classId: student.class_id,
                date: check.date,
            });
        }

        await answerCallbackQuery(cbId, {
            text: `${student.name} → ${STATUS_LABEL[nextStatus]}`,
        });
        await editInlineRegisterWithData(
            chatId,
            messageId,
            user,
            check.klass,
            Number(pageStr) || 1,
            updatedMap
        );

    } else if (data.startsWith('arp:')) {
        const [, classId, action] = data.split(':');

        if (action === 'n') {
            const klass = await getKlass(classId, user.school_id);
            await answerCallbackQuery(cbId, { text: 'Cancelled' });
            if (klass) await editInlineRegisterWithData(chatId, messageId, user, klass, 1);
            return;
        }

        const check = await checkMarkAllPresent(classId, user);
        if (!check.ok) {
            await answerCallbackQuery(cbId, { text: check.reason, showAlert: true });
            return;
        }

        const statusByStudent = await getTodayAttendanceMap(classId, user.school_id, check.date);
        const unmarked = check.students.filter((s) => !statusByStudent[s.id]);
        const exceptionCount = check.students.filter(
            (s) => statusByStudent[s.id] && statusByStudent[s.id] !== 'present'
        ).length;

        if (!unmarked.length) {
            await answerCallbackQuery(cbId, { text: 'Every pupil is already marked ✓' });
            await editAttendanceOptionsWithData(chatId, messageId, user, check.klass);
            return;
        }

        if (action !== 'y') {
            await answerCallbackQuery(cbId);
            await editMessage(
                chatId,
                messageId,
                menus.buildFillPresentConfirm({
                    klass: check.klass,
                    dayLabel: todayStr(),
                    unmarkedCount: unmarked.length,
                    exceptionCount,
                })
            );
            return;
        }

        const records = unmarked.map((s) => ({ studentId: s.id, status: 'present', note: '' }));
        const saved = await saveAttendanceRecords(classId, user, check.date, records);
        if (!saved.ok) {
            await answerCallbackQuery(cbId, { text: saved.reason, showAlert: true });
            return;
        }

        await resolveAttendanceReminder({ schoolId: user.school_id, classId, date: check.date });
        await answerCallbackQuery(cbId, { text: `✅ ${unmarked.length} marked present` });
        await editAttendanceOptionsWithData(chatId, messageId, user, check.klass);

    // Mark all present is a bulk write: ap:<id> asks, ap:<id>:y writes,
    // ap:<id>:n goes back. Nothing is written without the extra tap.
    } else if (data.startsWith('ap:')) {
        const [, classId, action] = data.split(':');

        if (action === 'n') {
            const klass = await getKlass(classId, user.school_id);
            await answerCallbackQuery(cbId, { text: 'Cancelled — nothing was saved' });
            if (klass) await editAttendanceOptionsWithData(chatId, messageId, user, klass);
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
            await editClassDetailWithData(chatId, messageId, user, result.klass);
        }

    // ── notices (paginated) & full reader ────────────────────────────────
    } else if (data === 'nt' || /^nt:\d+$/.test(data)) {
        await answerCallbackQuery(cbId);
        await editNoticesWithData(chatId, messageId, user, Number(data.split(':')[1]) || 1);
    } else if (data.startsWith('nv:')) {
        const [, noticeId, pageStr] = data.split(':');
        const { notices, acked } = await getNotices(user);
        const notice = notices.find((n) => String(n.id) === noticeId);
        if (!notice) {
            await answerCallbackQuery(cbId, { text: 'That notice is no longer available', showAlert: true });
            await editNoticesWithData(chatId, messageId, user);
            return;
        }
        await recordNoticeRead(user, notice.id);
        const page = Number(pageStr) || 1;
        await answerCallbackQuery(cbId);
        await editMessage(
            chatId,
            messageId,
            menus.buildNoticeDetail({
                notice,
                acked: acked.has(notice.id),
                back: `nt:${page}`,
            })
        );

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

const BOT_COMMANDS = [
    { command: 'start', description: 'Open your BIS NOC home menu' },
    { command: 'menu', description: 'Show quick actions & classes' },
    { command: 'today', description: "Today's timetable & tasks" },
    { command: 'classes', description: 'Your classes & pupils' },
    { command: 'notices', description: 'School notices & receipts' },
];

let webhookEnsurePromise = null;

/**
 * Self-healing webhook & `/` command menu registration for Vercel Production.
 * Runs at most once per warm serverless instance (retries automatically if a
 * network call failed), never drops pending updates, and never hijacks
 * production from a Vercel preview deployment.
 */
async function ensureTelegramWebhookOnce({ force = false } = {}) {
    if (!env.telegram.botToken) return { ok: false, reason: 'missing_bot_token' };
    if (!force) {
        if (!env.isProduction) return { ok: false, reason: 'not_production' };
        if (process.env.VERCEL_ENV && process.env.VERCEL_ENV !== 'production') {
            return { ok: false, reason: 'preview_env' };
        }
    }
    if (webhookEnsurePromise && !force) return webhookEnsurePromise;

    webhookEnsurePromise = (async () => {
        const origin = publicWebOrigin();
        const targetUrl = `${origin}/api/telegram/webhook`;
        const secret = env.telegram.webhookSecret || undefined;

        const hookRes = await setWebhook(targetUrl, secret, { dropPendingUpdates: false });
        if (!hookRes?.ok) {
            webhookEnsurePromise = null;
            return { ok: false, reason: hookRes?.description || 'set_webhook_failed', url: targetUrl };
        }

        await setChatMenuButton(`${origin}/tma/`, 'Open App');
        await setMyCommands(BOT_COMMANDS);
        return { ok: true, url: targetUrl };
    })().catch((err) => {
        webhookEnsurePromise = null;
        console.error('[telegram] ensureTelegramWebhookOnce failed:', err.message);
        return { ok: false, reason: err.message };
    });

    return webhookEnsurePromise;
}

/**
 * Push a staff member's role-smart inline menu straight into their linked
 * Telegram chat (used on Mini App link and by POST /api/telegram/send-menu).
 */
async function sendMainMenuToUser(user) {
    if (!user?.telegram_id) {
        return { ok: false, reason: 'Your account is not linked to Telegram yet.' };
    }
    const menu = buildMainMenu(user);
    const res = await sendTelegramMessage(user.telegram_id, menu.text, {
        replyMarkup: menu.replyMarkup,
    });
    if (!res?.ok) {
        return {
            ok: false,
            reason:
                res?.description ||
                'Could not deliver to Telegram — open @bisnocbot and tap Start once first.',
        };
    }
    return { ok: true };
}

async function handleUpdate(update) {
    if (!update) return;
    if (update.message) await handleMessage(update.message);
    else if (update.edited_message) await handleMessage(update.edited_message);
    else if (update.callback_query) await handleCallback(update.callback_query);
}

/**
 * Express handler for the Telegram webhook.
 *
 * IMPORTANT (Vercel Serverless / @vercel/node): we MUST `await handleUpdate`
 * BEFORE sending `200 ok`. Sending the response first causes Vercel to freeze
 * the serverless execution context before Supabase queries and outbound
 * `sendMessage` / `editMessageText` calls complete.
 */
const webhookHandler = async (req, res) => {
    const secret = env.telegram.webhookSecret;
    if (secret) {
        const header = req.headers['x-telegram-bot-api-secret-token'];
        if (header !== secret) {
            console.warn('[telegram] webhook rejected: secret token mismatch');
            res.status(401).json({ error: 'unauthorized' });
            return;
        }
    }

    try {
        await handleUpdate(req.body);
    } catch (err) {
        console.error('[telegram] update handling failed:', err);
    }
    res.status(200).send('ok');
};

const _resetWebhookEnsure = () => {
    webhookEnsurePromise = null;
};

module.exports = {
    handleUpdate,
    webhookHandler,
    ensureTelegramWebhookOnce,
    sendMainMenuToUser,
    sendNoticeTelegramPushes,
    sendTaskTelegramPush,
    _resetWebhookEnsure,
};
