const supabase = require('../config/supabase');
const schoolTime = require('../utils/schoolTime');
const { notify } = require('../utils/nudges');
const { isFixtureSubject } = require('../utils/subjects');
const { sendTelegramMessage, publicWebOrigin } = require('../utils/telegram');
const { sendPush, subscriptionsForUsers, vapidConfigured } = require('./webpush');

/**
 * School-wide teacher reminders. All clock times are Addis Ababa time.
 *
 * Defaults chosen for the supplied rota:
 *   - class/period card: the dashboard shows the live or next lesson;
 *   - weekly briefing and missing lesson-plan reminder: Monday 08:00;
 *   - snack/lunch/home-time duty alerts: five minutes before the duty starts;
 *   - no morning-duty alerts.
 *
 * Timed alerts are deduplicated in `notifications` and delivered in-app,
 * through Telegram when linked, and through Web Push when subscribed. The
 * Vercel cron is the backstop; the notification feed also runs a throttled
 * sweep while staff are using the app.
 */

const SCHOOL_WEEKLY_BRIEFING_TIME = '08:00';
const REMINDER_WINDOW_MINUTES = 5;
const SWEEP_EVERY_MS = 60 * 1000;
const TEACHER_ROLES = new Set(['main_teacher', 'assistant_teacher', 'subject_teacher']);

// Canonical account names are from the checked-in staff roster and the
// corrections supplied by the user. Short/public-directory spellings are
// accepted only as explicit aliases. Mr. Michael and Mr. Mike are deliberately
// separate identities.
const PEOPLE = {
    mekdelawitN: { display: 'Ms. Mekdelawit N.', aliases: ['Mekdelawit Nigusu Alemu', 'Mekdelawit N.'] },
    abigiyaT: { display: 'Ms. Abigiya T.', aliases: ['Abigiya Tadele Biru', 'Abigiya T.', 'Abigia T.'] },
    mariamawitB: { display: 'Ms. Mariamawit B.', aliases: ['Mariamawit Belay Nadew', 'Mariamawit B.', 'Mariamawait B.'] },
    degnetE: { display: 'Mr. Degnet Engida', aliases: ['Degnet Engida Addis', 'Mr. Degnet Engida', 'Deginet E.'] },
    denebeA: { display: 'Ms. Denebe A.', aliases: ['Denebe Abu Shuniye', 'Denebe A.'] },
    kalkidanZ: { display: 'Ms. Kalkidan Z.', aliases: ['Kalkidan Gezaheg Eltore', 'Kalkidan Z.'] },
    bethelhemG: { display: 'Ms. Bethelhem G.', aliases: ['Bethelhem Girma', 'Bethelhem G.'] },
    simegnY: { display: 'Ms. Simegn Y.', aliases: ['Simegn Yilma Akalu', 'Simegn Y.'] },
    thomasA: { display: 'Mr. Thomas A.', aliases: ['Thomas Asmelash Gebray', 'Thomas A.'] },
    edilawitW: { display: 'Ms. Edilawit W.', aliases: ['Edilawit W.'] },
    meronA: { display: 'Ms. Meron A.', aliases: ['Meron Abebe Tarekegn', 'Meron A.'] },
    samrawitE: { display: 'Ms. Samrawit E.', aliases: ['Samrawit E.', 'Samrawit Girma'] },
    mekdelawitA: { display: 'Ms. Mekdelawit A.', aliases: ['Mekdelawit Abate Nebebe', 'Mekdelawit A.'] },
    mahiletN: { display: 'Ms. Mahilet N.', aliases: ['Mahilet N.', 'Ms. Mahilet', 'Mahilet'] },
    selamG: { display: 'Ms. Selam G.', aliases: ['Selam Goyte Abza', 'Selam G.'] },
    mulugetaJ: { display: 'Mr. Mulugeta J.', aliases: ['Mulugeta Jemberu Dargie', 'Mulugeta J.'] },
    anduG: { display: 'Mr. Andu G.', aliases: ['Andu Getachew Tulu', 'Andu G.'] },
    kaleab: { display: 'Mr. Kaleab', aliases: ['Mr. Kaleab', 'Kalab Bizueinh Mekonen'] },
    michaelFrench: { display: 'Mr. Michael', aliases: ['Mr. Michael'], exactOnly: true },
    mikeEnglish: { display: 'Mr. Mike', aliases: ['Michael Okwara Okwara'], exactOnly: true },
};

const MONTHLY_HOME_ROTA = {
    '2026-11-02': ['mekdelawitN'],
    '2026-11-03': ['abigiyaT'],
    '2026-11-04': ['mariamawitB'],
    '2026-11-05': ['degnetE'],
    '2026-11-06': ['denebeA'],
    '2026-11-09': ['kalkidanZ'],
    '2026-11-10': ['bethelhemG'],
    '2026-11-11': ['simegnY'],
    '2026-11-12': ['thomasA'],
    '2026-11-13': ['edilawitW'],
    '2026-11-16': ['meronA'],
    '2026-11-17': ['samrawitE'],
    '2026-11-18': ['mekdelawitA'],
    '2026-11-19': ['mahiletN'],
    '2026-11-20': ['selamG'],
    '2026-11-23': ['mulugetaJ'],
    '2026-11-24': ['mekdelawitN'],
    '2026-11-25': ['abigiyaT'],
    '2026-11-26': ['mariamawitB'],
    '2026-11-27': ['degnetE'],
    '2026-11-30': ['denebeA'],
};

const WEEKLY_DUTIES = {
    snack: {
        startsAt: '10:10',
        byDay: {
            1: ['meronA', 'mahiletN', 'mariamawitB'],
            2: ['mariamawitB', 'mekdelawitN', 'meronA', 'anduG'],
            3: ['selamG', 'simegnY', 'abigiyaT', 'degnetE'],
            4: ['mekdelawitA', 'denebeA', 'selamG', 'michaelFrench'],
            5: ['degnetE', 'kalkidanZ', 'kaleab', 'thomasA'],
        },
    },
    lunch: {
        startsAt: '12:20',
        byDay: {
            1: ['selamG', 'simegnY', 'denebeA', 'kaleab'],
            2: ['degnetE', 'mahiletN', 'edilawitW'],
            3: ['mekdelawitA', 'meronA', 'anduG', 'kalkidanZ'],
            4: ['mariamawitB', 'edilawitW', 'samrawitE', 'thomasA'],
            5: ['abigiyaT', 'mekdelawitN', 'michaelFrench'],
        },
    },
    home_time: {
        startsAt: '15:10',
        // The weekly sheet assigns all active assistant teachers and Mr. Mike.
        allAssistants: true,
        people: ['mikeEnglish'],
    },
};

const honorifics = new Set(['mr', 'ms', 'mrs', 'miss', 'dr']);
const normalizedTokens = (value) => String(value || '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .filter((token) => !honorifics.has(token.replace(/\.$/, '')));

const matchesNameAlias = (userName, alias, exactOnly = false) => {
    const userTokens = normalizedTokens(userName);
    const aliasTokens = normalizedTokens(alias);
    if (!userTokens.length || !aliasTokens.length) return false;

    if (exactOnly) {
        return userTokens.length === aliasTokens.length && userTokens.every((token, i) => token === aliasTokens[i]);
    }

    // A full canonical name may be a prefix of the account name if the latter
    // includes an additional family name. Never match on a surname alone.
    if (aliasTokens.length > 1 && aliasTokens.every((token, i) => userTokens[i] === token)) return true;

    // Public labels such as "Mariamawit B." use the first name plus a middle
    // initial. If the stored user name is abbreviated to one token, it still
    // must be unique in the active staff list before it can be used.
    if (aliasTokens.length === 2 && aliasTokens[1].length === 1 && userTokens[0] === aliasTokens[0]) {
        return userTokens.length === 1 || userTokens[1]?.startsWith(aliasTokens[1]);
    }

    return aliasTokens.length === 1 && userTokens.length === 1 && userTokens[0] === aliasTokens[0];
};

const resolvePerson = (personKey, users) => {
    const person = PEOPLE[personKey];
    if (!person) return null;
    const candidates = (users || []).filter((user) =>
        TEACHER_ROLES.has(user.role) && person.aliases.some((alias) =>
            matchesNameAlias(user.name, alias, person.exactOnly),
        ),
    );
    return candidates.length === 1 ? candidates[0] : null;
};

const isWithinMinuteWindow = (time, targetTime, windowMinutes = REMINDER_WINDOW_MINUTES) => {
    const nowMinutes = schoolTime.minutesOf(time);
    const targetMinutes = schoolTime.minutesOf(targetTime);
    return nowMinutes >= targetMinutes && nowMinutes < targetMinutes + windowMinutes;
};

const minuteOfDay = (time) => schoolTime.minutesOf(time);

const weeklyBriefingDue = (date, time) =>
    schoolTime.isoWeekday(date) === 1 && isWithinMinuteWindow(time, SCHOOL_WEEKLY_BRIEFING_TIME);

const schoolIsOpen = async (schoolId, date) => {
    if (schoolTime.isoWeekday(date) > 5) return { open: false, reason: 'weekend' };

    const [termsRes, holidaysRes] = await Promise.all([
        supabase.from('terms').select('starts_on, ends_on').eq('school_id', schoolId),
        supabase.from('calendar_events')
            .select('title')
            .eq('school_id', schoolId)
            .eq('category', 'holiday')
            .lte('starts_on', date)
            .gte('ends_on', date)
            .is('class_id', null),
    ]);
    if (termsRes.error) throw termsRes.error;
    if (holidaysRes.error) throw holidaysRes.error;

    const terms = termsRes.data || [];
    if (terms.length && !terms.some((term) => term.starts_on <= date && date <= term.ends_on)) {
        return { open: false, reason: 'between terms' };
    }
    const holiday = (holidaysRes.data || [])[0];
    if (holiday) return { open: false, reason: 'holiday' };
    return { open: true };
};

const getActiveStaff = async (schoolId) => {
    const { data, error } = await supabase.from('users')
        .select('id, name, role, is_active, telegram_id')
        .eq('school_id', schoolId)
        .eq('is_active', true);
    if (error) throw error;
    return (data || []).filter((user) => TEACHER_ROLES.has(user.role));
};

const roleEntryUrl = (role, nextPath) => {
    const safeRole = /^[a-z_]+$/.test(String(role || '')) ? role : 'staff';
    const next = nextPath ? `?next=${encodeURIComponent(nextPath)}` : '';
    return `${publicWebOrigin()}/telegram-entry/${encodeURIComponent(safeRole)}${next}`;
};

const deliverChannels = async ({ createdIds, usersById, title, body, link }) => {
    if (!createdIds.length) return { telegram: 0, push: 0 };
    const createdUsers = createdIds.map((id) => usersById.get(id)).filter(Boolean);
    const telegramTasks = createdUsers
        .filter((user) => user.telegram_id)
        .map((user) => sendTelegramMessage(
            user.telegram_id,
            [`🔔 ${title}`, '', body].join('\n'),
            {
                replyMarkup: link ? {
                    inline_keyboard: [[{
                        text: 'Open in BIS NOC',
                        url: roleEntryUrl(user.role, link),
                    }]],
                } : undefined,
            },
        ));

    const pushTask = async () => {
        if (!vapidConfigured) return 0;
        try {
            const subscriptions = await subscriptionsForUsers(createdIds);
            const results = await Promise.allSettled(subscriptions.map((subscription) =>
                sendPush(subscription, { title, body, url: link || '/' }),
            ));
            return results.filter((result) => result.status === 'fulfilled' && result.value === true).length;
        } catch (error) {
            console.warn('[teacher-reminders] push delivery skipped:', error.message);
            return 0;
        }
    };

    const [telegramResults, push] = await Promise.all([
        Promise.allSettled(telegramTasks),
        pushTask(),
    ]);
    const telegram = telegramResults.filter((result) => result.status === 'fulfilled' && result.value?.ok).length;
    return { telegram, push };
};

const sendNudge = async ({ schoolId, users, kind, title, body, link, dedupeKey }, usersById) => {
    const recipients = [...new Set((users || []).map((user) => user.id).filter(Boolean))];
    const createdIds = await notify({ schoolId, userIds: recipients, kind, title, body, link, dedupeKey });
    const delivered = await deliverChannels({ createdIds, usersById, title, body, link });
    return { inApp: createdIds.length, ...delivered };
};

const combineCounts = (target, counts) => {
    for (const key of ['inApp', 'telegram', 'push']) target[key] += counts[key] || 0;
};

const getWeekDeadlines = async ({ schoolId, date, staff }) => {
    const weekDates = schoolTime.schoolWeek(date);
    const from = weekDates[0];
    const to = weekDates[4];
    const staffIds = staff.map((user) => user.id);
    if (!staffIds.length) return { from, to, byUser: new Map() };

    const [tasksRes, eventsRes, currentYearRes, staffRes, assignmentsRes] = await Promise.all([
        supabase.from('tasks').select('id, title, due_on, assigned_to, status')
            .eq('school_id', schoolId).in('assigned_to', staffIds).gte('due_on', from).lte('due_on', to),
        supabase.from('calendar_events').select('id, title, starts_on, ends_on, audience, class_id')
            .eq('school_id', schoolId).eq('category', 'deadline')
            .lte('starts_on', to).gte('ends_on', from),
        supabase.from('academic_years').select('id').eq('school_id', schoolId).eq('is_current', true).maybeSingle(),
        supabase.from('class_staff').select('user_id, class_id, academic_year_id')
            .eq('school_id', schoolId).in('user_id', staffIds),
        supabase.from('class_subjects').select('teacher_id, class_id, academic_year_id')
            .eq('school_id', schoolId).in('teacher_id', staffIds),
    ]);
    for (const result of [tasksRes, eventsRes, currentYearRes, staffRes, assignmentsRes]) {
        if (result.error) throw result.error;
    }

    const byUser = new Map(staff.map((user) => [user.id, []]));
    for (const task of tasksRes.data || []) {
        if (!['pending', 'in_progress'].includes(task.status)) continue;
        if (!byUser.has(task.assigned_to)) continue;
        byUser.get(task.assigned_to).push({ date: task.due_on, title: task.title, source: 'task' });
    }

    const yearId = currentYearRes.data?.id;
    const classIdsByUser = new Map(staff.map((user) => [user.id, new Set()]));
    if (yearId) {
        for (const row of staffRes.data || []) {
            if (row.academic_year_id === yearId && classIdsByUser.has(row.user_id)) {
                classIdsByUser.get(row.user_id).add(row.class_id);
            }
        }
        for (const row of assignmentsRes.data || []) {
            if (row.academic_year_id === yearId && classIdsByUser.has(row.teacher_id)) {
                classIdsByUser.get(row.teacher_id).add(row.class_id);
            }
        }
    }

    for (const event of eventsRes.data || []) {
        const dueDate = event.ends_on >= from && event.ends_on <= to ? event.ends_on : event.starts_on;
        for (const user of staff) {
            if (event.audience !== 'all' && event.audience !== user.role) continue;
            if (event.class_id && !(classIdsByUser.get(user.id)?.has(event.class_id))) continue;
            byUser.get(user.id).push({ date: dueDate, title: event.title, source: 'calendar' });
        }
    }

    for (const items of byUser.values()) {
        items.sort((a, b) => String(a.date).localeCompare(String(b.date)) || a.title.localeCompare(b.title));
    }
    return { from, to, byUser };
};

const formatDueDate = (date) => schoolTime.formatDay(date, { weekday: 'short', day: 'numeric', month: 'short' });

const runWeeklyBriefing = async ({ schoolId, date, staff, usersById }) => {
    const { from, to, byUser } = await getWeekDeadlines({ schoolId, date, staff });
    const title = `Weekly briefing — ${formatDueDate(from)}`;
    const totals = { inApp: 0, telegram: 0, push: 0 };

    for (const user of staff) {
        if (!['main_teacher', 'subject_teacher'].includes(user.role)) continue;
        const items = byUser.get(user.id) || [];
        const lines = items.slice(0, 8).map((item) =>
            `• ${formatDueDate(item.date)}: ${String(item.title || 'Deadline').slice(0, 140)}`,
        );
        if (items.length > 8) lines.push(`• and ${items.length - 8} more deadline${items.length - 8 === 1 ? '' : 's'}`);
        const body = lines.length
            ? `Fixed deadlines for ${formatDueDate(from)}–${formatDueDate(to)}:\n${lines.join('\n')}`
            : `No task or calendar deadlines are recorded for ${formatDueDate(from)}–${formatDueDate(to)}.`;
        const counts = await sendNudge({
            schoolId,
            users: [user],
            kind: 'weekly_briefing',
            title,
            body,
            link: '/app/calendar',
            dedupeKey: `weekly-briefing:${date}`,
        }, usersById);
        combineCounts(totals, counts);
    }

    return totals;
};

const getCurrentWeekPlans = async ({ schoolId, date, staff }) => {
    const { data: terms, error: termError } = await supabase.from('terms')
        .select('id, starts_on, ends_on')
        .eq('school_id', schoolId)
        .eq('is_current', true);
    if (termError) throw termError;
    const term = (terms || []).find((row) => row.starts_on <= date && date <= row.ends_on);
    if (!term) return { termId: null, weekNumber: null, byTeacher: new Map() };

    const elapsed = schoolTime.daysBetween(term.starts_on, date);
    const weekNumber = Math.floor(elapsed / 7) + 1;
    const year = await supabase.from('academic_years').select('id')
        .eq('school_id', schoolId).eq('is_current', true).maybeSingle();
    if (year.error) throw year.error;
    if (!year.data?.id) return { termId: term.id, weekNumber, byTeacher: new Map() };

    const teacherIds = staff.filter((user) => user.role === 'subject_teacher').map((user) => user.id);
    const byTeacher = new Map(teacherIds.map((id) => [id, []]));
    if (!teacherIds.length) return { termId: term.id, weekNumber, byTeacher };

    const { data: assignments, error: assignmentError } = await supabase.from('class_subjects')
        .select('id, teacher_id, class_id, subject_id')
        .eq('school_id', schoolId)
        .eq('academic_year_id', year.data.id)
        .in('teacher_id', teacherIds);
    if (assignmentError) throw assignmentError;
    const assignmentRows = assignments || [];
    if (!assignmentRows.length) return { termId: term.id, weekNumber, byTeacher };

    const subjectIds = [...new Set(assignmentRows.map((row) => row.subject_id).filter(Boolean))];
    const classIds = [...new Set(assignmentRows.map((row) => row.class_id).filter(Boolean))];
    const [subjectsRes, classesRes, plansRes] = await Promise.all([
        subjectIds.length
            ? supabase.from('subjects').select('id, name, code').in('id', subjectIds)
            : Promise.resolve({ data: [], error: null }),
        classIds.length
            ? supabase.from('classes').select('id, name').in('id', classIds)
            : Promise.resolve({ data: [], error: null }),
        supabase.from('lesson_plans').select('class_subject_id, status')
            .eq('school_id', schoolId).eq('term_id', term.id).eq('week_number', weekNumber),
    ]);
    for (const result of [subjectsRes, classesRes, plansRes]) {
        if (result.error) throw result.error;
    }
    const subjects = new Map((subjectsRes.data || []).map((row) => [row.id, row]));
    const classes = new Map((classesRes.data || []).map((row) => [row.id, row]));
    const submitted = new Set((plansRes.data || [])
        .filter((row) => ['submitted', 'approved'].includes(row.status))
        .map((row) => row.class_subject_id));

    for (const assignment of assignmentRows) {
        const subject = subjects.get(assignment.subject_id);
        if (isFixtureSubject(subject) || submitted.has(assignment.id)) continue;
        const items = byTeacher.get(assignment.teacher_id);
        if (!items) continue;
        items.push({
            classSubjectId: assignment.id,
            className: classes.get(assignment.class_id)?.name || 'Class',
            subjectName: subject?.name || 'Subject',
        });
    }
    return { termId: term.id, weekNumber, byTeacher };
};

const runLessonPlanReminders = async ({ schoolId, date, staff, usersById }) => {
    const { termId, weekNumber, byTeacher } = await getCurrentWeekPlans({ schoolId, date, staff });
    if (!termId || !weekNumber) return { inApp: 0, telegram: 0, push: 0 };
    const totals = { inApp: 0, telegram: 0, push: 0 };

    for (const user of staff) {
        if (user.role !== 'subject_teacher') continue;
        const missing = byTeacher.get(user.id) || [];
        if (!missing.length) continue;
        const lines = missing.slice(0, 10).map((item) => `• ${item.className} — ${item.subjectName}`);
        if (missing.length > 10) lines.push(`• and ${missing.length - 10} more`);
        const title = `Lesson plans to submit — Week ${weekNumber}`;
        const body = `Please submit this week's lesson plan${missing.length === 1 ? '' : 's'}:\n${lines.join('\n')}`;
        const counts = await sendNudge({
            schoolId,
            users: [user],
            kind: 'lesson_plan_reminder',
            title,
            body,
            link: '/app/planning',
            dedupeKey: `lesson-plan-reminder:${termId}:${weekNumber}:${date}`,
        }, usersById);
        combineCounts(totals, counts);
    }
    return totals;
};

const dueDutyKeys = (date, time) => {
    const due = [];
    const dow = schoolTime.isoWeekday(date);
    if (dow > 5) return due;
    for (const [key, duty] of Object.entries(WEEKLY_DUTIES)) {
        const target = minuteOfDay(duty.startsAt) - 5;
        const targetTime = `${String(Math.floor(target / 60)).padStart(2, '0')}:${String(target % 60).padStart(2, '0')}`;
        if (isWithinMinuteWindow(time, targetTime)) due.push(key);
    }
    return due;
};

const runDutyReminder = async ({ schoolId, date, dutyKey, staff, usersById }) => {
    const duty = WEEKLY_DUTIES[dutyKey];
    const counts = { inApp: 0, telegram: 0, push: 0 };
    const userMap = new Map((staff || []).map((user) => [user.id, user]));
    let recipientIds = [];

    if (dutyKey === 'home_time' && duty.allAssistants) {
        recipientIds.push(...staff.filter((user) => user.role === 'assistant_teacher').map((user) => user.id));
    }
    const keys = [
        ...(duty.byDay?.[schoolTime.isoWeekday(date)] || []),
        ...(duty.people || []),
        ...(dutyKey === 'home_time' ? (MONTHLY_HOME_ROTA[date] || []) : []),
    ];
    for (const personKey of keys) {
        const user = resolvePerson(personKey, staff);
        if (user) recipientIds.push(user.id);
    }
    recipientIds = [...new Set(recipientIds)].filter((id) => userMap.has(id));
    const recipients = recipientIds.map((id) => userMap.get(id));
    if (!recipients.length) return counts;

    const startsAt = duty.startsAt;
    const dutyLabel = dutyKey === 'home_time' ? 'Home-time' : dutyKey === 'snack' ? 'Snack' : 'Lunch';
    const locationText = dutyKey === 'home_time' ? 'at dismissal' : 'for Year 3–4';
    const title = `${dutyLabel} duty starts at ${startsAt}`;
    const body = `Your ${dutyLabel.toLowerCase()} duty ${locationText} starts in five minutes (${startsAt}, Addis Ababa time).`;
    const result = await sendNudge({
        schoolId,
        users: recipients,
        kind: 'duty_reminder',
        title,
        body,
        link: '/app/timetable',
        dedupeKey: `duty-reminder:${dutyKey}:${date}`,
    }, usersById);
    combineCounts(counts, result);
    return counts;
};

const runSchool = async ({ schoolId, date, time, due }) => {
    const open = await schoolIsOpen(schoolId, date);
    const empty = {
        schoolId,
        schoolDay: open.open,
        reason: open.reason || null,
        briefings: 0,
        lessonPlanReminders: 0,
        dutyReminders: 0,
        telegramSent: 0,
        pushSent: 0,
    };
    if (!open.open) return empty;

    const staff = await getActiveStaff(schoolId);
    const usersById = new Map(staff.map((user) => [user.id, user]));
    const result = { ...empty };

    if (due.weeklyBriefing) {
        const counts = await runWeeklyBriefing({ schoolId, date, staff, usersById });
        result.briefings = counts.inApp;
        result.telegramSent += counts.telegram;
        result.pushSent += counts.push;

        const planCounts = await runLessonPlanReminders({ schoolId, date, staff, usersById });
        result.lessonPlanReminders = planCounts.inApp;
        result.telegramSent += planCounts.telegram;
        result.pushSent += planCounts.push;
    }

    for (const dutyKey of due.duties) {
        const counts = await runDutyReminder({ schoolId, date, dutyKey, staff, usersById });
        result.dutyReminders += counts.inApp;
        result.telegramSent += counts.telegram;
        result.pushSent += counts.push;
    }
    return result;
};

const dueAt = ({ date, time }) => {
    const weeklyBriefing = weeklyBriefingDue(date, time);
    const duties = dueDutyKeys(date, time);
    return { weeklyBriefing, duties, any: weeklyBriefing || duties.length > 0 };
};

/** Run only the scheduled reminders whose five-minute delivery window is open. */
const runTeacherReminders = async ({ now = schoolTime.clock.now(), schoolId = null } = {}) => {
    const date = schoolTime.todayIso(now);
    const time = schoolTime.timeNow(now);
    const due = dueAt({ date, time });
    const result = { date, time, due: due.any, schools: [] };
    if (!due.any) return result;

    let schoolIds = schoolId ? [schoolId] : [];
    if (!schoolId) {
        const { data, error } = await supabase.from('schools').select('id');
        if (error) throw error;
        schoolIds = (data || []).map((school) => school.id);
    }
    for (const id of schoolIds) result.schools.push(await runSchool({ schoolId: id, date, time, due }));
    return result;
};

const lastSweep = new Map();
const maybeRunTeacherReminders = async (schoolId) => {
    try {
        const now = schoolTime.clock.now();
        const date = schoolTime.todayIso(now);
        const time = schoolTime.timeNow(now);
        if (!schoolId || !dueAt({ date, time }).any) return null;
        const last = lastSweep.get(schoolId) || 0;
        if (now.getTime() - last < SWEEP_EVERY_MS) return null;
        lastSweep.set(schoolId, now.getTime());
        return await runTeacherReminders({ now, schoolId });
    } catch (error) {
        console.warn('[teacher-reminders] sweep skipped:', error.message);
        return null;
    }
};

module.exports = {
    runTeacherReminders,
    maybeRunTeacherReminders,
    weeklyBriefingDue,
    dueDutyKeys,
    schoolIsOpen,
    resolvePerson,
    _resetThrottle: () => lastSweep.clear(),
    _test: { PEOPLE, MONTHLY_HOME_ROTA, WEEKLY_DUTIES, dueAt, matchesNameAlias },
};
