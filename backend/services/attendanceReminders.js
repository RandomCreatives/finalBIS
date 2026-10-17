const supabase = require('../config/supabase');
const schoolTime = require('../utils/schoolTime');
const { selectAll } = require('../utils/selectAll');
const { notify, notifyAdmins } = require('../utils/nudges');
const { sendTelegramMessage } = require('../utils/telegram');
const { sendPush, subscriptionsForUsers, vapidConfigured } = require('../services/webpush');

/**
 * Daily attendance reminders for main teachers.
 *
 * Registration runs 08:10–08:30, school time (Addis Ababa, GMT+3). From the
 * reminder time (default 08:45, env ATTENDANCE_REMINDER_TIME) until the end
 * of the teaching day, on school days only, every main teacher whose class
 * has no homeroom register for today gets:
 *   - a bell notification that opens the register for that class and day;
 *   - a Telegram message with "Mark all present" / "Open the register",
 *     if they linked Telegram.
 * The office gets one digest listing the registers still missing.
 *
 * Everything is deduplicated per class per day, so the two triggers can
 * both fire safely — whichever comes first sends the reminders:
 *   - the bell: any signed-in user's feed refresh runs the sweep
 *     (throttled per server instance) — see maybeRunAttendanceReminders;
 *   - a Vercel cron (vercel.json), the backstop when nobody is online.
 * Saving the register marks the teacher's reminder as read.
 */

const DEFAULT_REMINDER_TIME = '08:45';
const REMINDER_WINDOW_END = '15:00'; // end of period 6 — no reminders in the evening
const SWEEP_EVERY_MS = 5 * 60 * 1000;
const WEB_APP = process.env.FRONTEND_URL || 'https://final-bis.vercel.app';

const reminderTime = () => {
    const configured = String(process.env.ATTENDANCE_REMINDER_TIME || '').trim();
    return /^([01]\d|2[0-3]):[0-5]\d$/.test(configured) ? configured : DEFAULT_REMINDER_TIME;
};

const reminderKey = (classId, date) => `attendance-reminder:${classId}:${date}`;
const digestKey = (date) => `attendance-digest:${date}`;
const registerPath = (classId, date) => `/app/attendance?classId=${classId}&date=${date}`;

const missingTable = (error) =>
    error?.code === '42P01' || /notifications.*does not exist/i.test(error?.message || '');

/** Is `now` inside today's reminder window (school time)? */
const reminderWindow = (now = schoolTime.clock.now()) => {
    const time = schoolTime.timeNow(now);
    const minutes = schoolTime.minutesOf(time);
    const from = reminderTime();
    return {
        date: schoolTime.todayIso(now),
        time,
        from,
        until: REMINDER_WINDOW_END,
        open: minutes >= schoolTime.minutesOf(from) && minutes < schoolTime.minutesOf(REMINDER_WINDOW_END),
    };
};

/** Weekdays in term, minus whole-school holidays on the calendar. */
const isSchoolDay = async (schoolId, date) => {
    if (schoolTime.isoWeekday(date) > 5) return { open: false, reason: 'weekend' };

    const [termsRes, holidaysRes] = await Promise.all([
        supabase.from('terms').select('starts_on, ends_on').eq('school_id', schoolId),
        supabase.from('calendar_events')
            .select('title, class_id')
            .eq('school_id', schoolId)
            .eq('category', 'holiday')
            .lte('starts_on', date)
            .gte('ends_on', date),
    ]);
    if (termsRes.error) throw termsRes.error;
    if (holidaysRes.error) throw holidaysRes.error;

    const terms = termsRes.data || [];
    if (terms.length && !terms.some((t) => t.starts_on <= date && date <= t.ends_on)) {
        return { open: false, reason: 'between terms' };
    }

    // A class trip doesn't cancel registration for everyone else.
    const holiday = (holidaysRes.data || []).find((event) => !event.class_id);
    if (holiday) return { open: false, reason: `holiday: ${holiday.title}` };

    return { open: true };
};

/**
 * Classes (with pupils) that have no homeroom register for `date`, each with
 * its active main teachers.
 */
const findMissingRegisters = async (schoolId, date) => {
    const { data: year, error: yearError } = await supabase
        .from('academic_years')
        .select('id')
        .eq('school_id', schoolId)
        .eq('is_current', true)
        .maybeSingle();
    if (yearError) throw yearError;

    const [classesRes, pupils, marked, seatsRes] = await Promise.all([
        supabase.from('classes').select('id, name').eq('school_id', schoolId).order('name'),
        selectAll('students', 'class_id', (q) => q.eq('school_id', schoolId).eq('is_active', true)),
        selectAll(
            'attendance',
            'class_id',
            (q) => q.eq('school_id', schoolId).eq('date', date).is('subject_id', null),
        ),
        year
            ? supabase.from('class_staff')
                .select('class_id, user:users(id, name, role, is_active, telegram_id)')
                .eq('school_id', schoolId)
                .eq('academic_year_id', year.id)
                .eq('position', 'main')
            : Promise.resolve({ data: [], error: null }),
    ]);
    if (classesRes.error) throw classesRes.error;
    if (seatsRes.error) throw seatsRes.error;

    const withPupils = new Set(pupils.map((p) => p.class_id).filter(Boolean));
    const taken = new Set(marked.map((r) => r.class_id));

    const teachersOf = new Map();
    for (const seat of seatsRes.data || []) {
        const u = seat.user;
        if (!u?.is_active) continue;
        const list = teachersOf.get(seat.class_id) || [];
        list.push({ id: u.id, name: u.name, telegramId: u.telegram_id || null });
        teachersOf.set(seat.class_id, list);
    }

    return (classesRes.data || [])
        .filter((klass) => withPupils.has(klass.id) && !taken.has(klass.id))
        .map((klass) => ({ classId: klass.id, className: klass.name, teachers: teachersOf.get(klass.id) || [] }));
};

const telegramReminder = (klass, date, dayLabel) => ({
    text: [
        '⏰ Daily attendance reminder',
        `${klass.className} — ${dayLabel}`,
        '',
        "Today's register hasn't been taken yet. Please record it now.",
    ].join('\n'),
    replyMarkup: {
        inline_keyboard: [
            [{ text: '✅ Mark all present', callback_data: `ap:${klass.classId}` }],
            [{ text: '📝 Open the register', url: `${WEB_APP}${registerPath(klass.classId, date)}` }],
        ],
    },
});

/** Remind one school's main teachers. Idempotent for the day. */
const sweepSchool = async (schoolId, date, time) => {
    const day = await isSchoolDay(schoolId, date);
    if (!day.open) {
        return { schoolId, schoolDay: false, reason: day.reason, missing: [], reminded: [], telegram: 0, digest: false };
    }

    const missing = await findMissingRegisters(schoolId, date);
    const dayLabel = schoolTime.formatDay(date);
    const reminded = [];
    const telegramSends = [];

    for (const klass of missing) {
        if (klass.teachers.length === 0) continue;

        const created = await notify({
            schoolId,
            userIds: klass.teachers.map((t) => t.id),
            kind: 'attendance_reminder',
            title: `Take the register: ${klass.className}`,
            body: `${dayLabel} — today's daily attendance hasn't been recorded yet.`,
            link: registerPath(klass.classId, date),
            dedupeKey: reminderKey(klass.classId, date),
        });
        if (created.length === 0) continue; // already reminded today

        // Push to the same teachers who just got the bell nudge — the
        // morning attendance reminder lands on their phone even if the app
        // is closed.
        if (vapidConfigured) {
            const subs = await subscriptionsForUsers(created);
            await Promise.allSettled(
                subs.map((s) =>
                    sendPush(
                        s,
                        {
                            title: `Take the register: ${klass.className}`,
                            body: `${dayLabel} — today's daily attendance hasn't been recorded yet.`,
                            url: registerPath(klass.classId, date),
                        },
                    ),
                ),
            );
        }

        reminded.push({ className: klass.className, teachers: klass.teachers.filter((t) => created.includes(t.id)).map((t) => t.name) });

        // Telegram only for reminders created just now: one message per day.
        const message = telegramReminder(klass, date, dayLabel);
        for (const teacher of klass.teachers) {
            if (!teacher.telegramId || !created.includes(teacher.id)) continue;
            telegramSends.push(() => sendTelegramMessage(teacher.telegramId, message.text, { replyMarkup: message.replyMarkup }));
        }
    }

    // Sent together (well under Telegram's 30 messages/second), so the bell
    // refresh that triggers the sweep stays quick.
    const results = await Promise.allSettled(telegramSends.map((send) => send()));
    const telegram = results.filter((r) => r.status === 'fulfilled' && r.value?.ok).length;

    let digest = false;
    if (missing.length) {
        const list = missing
            .map((k) => `${k.className} (${k.teachers.map((t) => t.name).join(', ') || 'no class teacher'})`)
            .join(', ');
        const created = await notifyAdmins({
            schoolId,
            kind: 'attendance_digest',
            title: `Daily attendance: ${missing.length} register${missing.length === 1 ? '' : 's'} missing`,
            body: `${dayLabel}, ${time} — ${list}. Their class teachers have been reminded.`,
            link: '/app/attendance',
            dedupeKey: digestKey(date),
        });
        digest = created.length > 0;
    }

    return {
        schoolId,
        schoolDay: true,
        missing: missing.map((k) => k.className),
        reminded,
        telegram,
        digest,
    };
};

/**
 * Send any reminders that are due. Safe to call any number of times.
 * @param {{ now?: Date, schoolId?: string }} [options]
 */
const runAttendanceReminders = async ({ now = schoolTime.clock.now(), schoolId = null } = {}) => {
    const window = reminderWindow(now);
    const result = { date: window.date, time: window.time, window: `${window.from}–${window.until}`, due: window.open, schools: [] };
    if (!window.open) return result;

    let schoolIds = schoolId ? [schoolId] : [];
    if (!schoolId) {
        const { data, error } = await supabase.from('schools').select('id');
        if (error) throw error;
        schoolIds = (data || []).map((s) => s.id);
    }

    for (const id of schoolIds) {
        result.schools.push(await sweepSchool(id, window.date, window.time));
    }
    return result;
};

/*
 * Bell-driven trigger: called from the notification feed. Cheap when not
 * due (no queries), at most one sweep per school per instance every few
 * minutes, and it never throws — the bell must keep working regardless.
 */
const lastSweep = new Map();

const maybeRunAttendanceReminders = async (schoolId) => {
    try {
        const now = schoolTime.clock.now();
        if (!schoolId || !reminderWindow(now).open) return null;

        const last = lastSweep.get(schoolId) || 0;
        if (now.getTime() - last < SWEEP_EVERY_MS) return null;
        lastSweep.set(schoolId, now.getTime());

        return await runAttendanceReminders({ now, schoolId });
    } catch (error) {
        console.warn('[attendance-reminders] sweep skipped:', error.message);
        return null;
    }
};

/** The register is in: mark that class's reminder for the day as read. */
const resolveAttendanceReminder = async ({ schoolId, classId, date }) => {
    try {
        const { error } = await supabase
            .from('notifications')
            .update({ read_at: new Date().toISOString() })
            .eq('school_id', schoolId)
            .eq('dedupe_key', reminderKey(classId, date))
            .is('read_at', null);
        if (error && !missingTable(error)) throw error;
    } catch (error) {
        console.warn('[attendance-reminders] could not clear reminder:', error.message);
    }
};

module.exports = {
    runAttendanceReminders,
    maybeRunAttendanceReminders,
    resolveAttendanceReminder,
    reminderWindow,
    reminderKey,
    digestKey,
    _resetThrottle: () => lastSweep.clear(),
};
