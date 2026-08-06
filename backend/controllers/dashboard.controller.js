const supabase = require('../config/supabase');
const { resolveYearId } = require('./academicYear.controller');
const { weekCount } = require('./term.controller');
const { asyncHandler } = require('../utils/errors');

const today = () => new Date().toISOString().slice(0, 10);

/**
 * GET /api/dashboard/summary
 * School-wide figures for admins.
 */
const getAdminSummary = asyncHandler(async (req, res) => {
    const schoolId = req.user.school_id;

    const countOf = (table, apply = (q) => q) =>
        apply(supabase.from(table).select('id', { count: 'exact', head: true }).eq('school_id', schoolId));

    const [students, classes, staff, loans, overdue, pendingLeave, openThreads, openTasks, attendanceToday] =
        await Promise.all([
            countOf('students', (q) => q.eq('is_active', true)),
            countOf('classes'),
            countOf('users', (q) => q.eq('is_active', true)),
            countOf('library_loans', (q) => q.eq('status', 'borrowed')),
            countOf('library_loans', (q) => q.eq('status', 'borrowed').lt('due_on', today())),
            countOf('clinic_visits', (q) => q.eq('leave_status', 'pending')),
            countOf('threads', (q) => q.eq('status', 'open')),
            countOf('tasks', (q) => q.in('status', ['pending', 'in_progress'])),
            supabase
                .from('attendance')
                .select('status')
                .eq('school_id', schoolId)
                .eq('date', today())
                .is('subject_id', null),
        ]);

    for (const r of [students, classes, staff, loans, overdue, pendingLeave, openThreads, openTasks, attendanceToday]) {
        if (r.error) throw r.error;
    }

    const records = attendanceToday.data || [];
    const present = records.filter((r) => r.status === 'present' || r.status === 'late').length;

    res.json({
        students: students.count ?? 0,
        classes: classes.count ?? 0,
        staff: staff.count ?? 0,
        booksOnLoan: loans.count ?? 0,
        overdueBooks: overdue.count ?? 0,
        pendingLeaveRequests: pendingLeave.count ?? 0,
        openThreads: openThreads.count ?? 0,
        openTasks: openTasks.count ?? 0,
        attendanceToday: {
            marked: records.length,
            present,
            rate: records.length ? Number(((present / records.length) * 100).toFixed(1)) : null,
        },
    });
});

/**
 * GET /api/dashboard/me
 *
 * The teacher's own view: the classes they run, the subjects they teach,
 * today's timetable, their open tasks and unread conversations.
 */
const getMySummary = asyncHandler(async (req, res) => {
    const userId = req.user.id;
    const schoolId = req.user.school_id;

    let yearId = null;
    try {
        yearId = await resolveYearId(req);
    } catch {
        // No academic year configured yet — return an empty but valid shape.
    }

    const emptyYear = { homerooms: [], teachingSubjects: [], todaySlots: [] };

    const yearScoped = yearId
        ? await (async () => {
            // JS getDay(): Sunday=0. Schema uses ISO 1..7 with Monday=1.
            const jsDay = new Date().getDay();
            const isoDay = jsDay === 0 ? 7 : jsDay;

            const [staffRes, subjectRes] = await Promise.all([
                supabase
                    .from('class_staff')
                    .select('position, class:classes(id, name)')
                    .eq('user_id', userId)
                    .eq('academic_year_id', yearId),
                supabase
                    .from('class_subjects')
                    .select('id, sessions_per_week, class:classes(id, name), subject:subjects(id, name, code)')
                    .eq('teacher_id', userId)
                    .eq('academic_year_id', yearId),
            ]);

            if (staffRes.error) throw staffRes.error;
            if (subjectRes.error) throw subjectRes.error;

            const assignmentIds = (subjectRes.data || []).map((s) => s.id);

            let todaySlots = [];
            if (assignmentIds.length > 0) {
                const { data: slots, error: slotError } = await supabase
                    .from('timetable_slots')
                    .select('id, starts_at, ends_at, room, class_subject_id')
                    .in('class_subject_id', assignmentIds)
                    .eq('day_of_week', isoDay)
                    .order('starts_at');

                if (slotError) throw slotError;

                const byId = new Map((subjectRes.data || []).map((s) => [s.id, s]));
                todaySlots = (slots || []).map((slot) => {
                    const assignment = byId.get(slot.class_subject_id);
                    return {
                        id: slot.id,
                        startsAt: slot.starts_at,
                        endsAt: slot.ends_at,
                        room: slot.room,
                        class: assignment?.class ?? null,
                        subject: assignment?.subject ?? null,
                    };
                });
            }

            return {
                homerooms: (staffRes.data || []).map((s) => ({
                    position: s.position,
                    class: s.class,
                })),
                teachingSubjects: (subjectRes.data || []).map((s) => ({
                    id: s.id,
                    class: s.class,
                    subject: s.subject,
                    sessionsPerWeek: s.sessions_per_week,
                })),
                todaySlots,
            };
        })()
        : emptyYear;

    // Tasks and unread threads are not year-scoped.
    const [taskRes, membershipRes] = await Promise.all([
        supabase
            .from('tasks')
            .select('id, title, due_on, priority, status')
            .eq('school_id', schoolId)
            .eq('assigned_to', userId)
            .in('status', ['pending', 'in_progress'])
            .order('due_on', { ascending: true, nullsFirst: false }),
        supabase.from('thread_participants').select('thread_id, last_read_at').eq('user_id', userId),
    ]);

    if (taskRes.error) throw taskRes.error;
    if (membershipRes.error) throw membershipRes.error;

    let unreadMessages = 0;
    if ((membershipRes.data || []).length > 0) {
        const { data: messages, error: msgError } = await supabase
            .from('messages')
            .select('thread_id, sender_id, created_at')
            .in('thread_id', membershipRes.data.map((m) => m.thread_id));

        if (msgError) throw msgError;

        const readMap = new Map(membershipRes.data.map((m) => [m.thread_id, m.last_read_at]));
        unreadMessages = messages.filter((m) => {
            if (m.sender_id === userId) return false;
            const lastRead = readMap.get(m.thread_id);
            return !lastRead || new Date(m.created_at) > new Date(lastRead);
        }).length;
    }

    const tasks = taskRes.data || [];
    const openTasks = tasks.map((t) => ({
        id: t.id,
        title: t.title,
        dueOn: t.due_on,
        priority: t.priority,
        status: t.status,
        isOverdue: Boolean(t.due_on && t.due_on < today()),
    }));

    // Homeroom attendance the teacher still owes today.
    const homeroomClassIds = yearScoped.homerooms.map((h) => h.class?.id).filter(Boolean);
    let attendanceOutstanding = [];

    if (homeroomClassIds.length > 0) {
        const { data: marked, error: markedError } = await supabase
            .from('attendance')
            .select('class_id')
            .in('class_id', homeroomClassIds)
            .eq('date', today())
            .is('subject_id', null);

        if (markedError) throw markedError;

        const done = new Set((marked || []).map((m) => m.class_id));
        attendanceOutstanding = yearScoped.homerooms
            .filter((h) => h.class && !done.has(h.class.id))
            .map((h) => h.class);
    }

    // Current term, this week's number, and what is coming up.
    const { data: term, error: termError } = await supabase
        .from('terms')
        .select('id, name, starts_on, ends_on')
        .eq('school_id', schoolId)
        .eq('is_current', true)
        .maybeSingle();

    if (termError) throw termError;

    let termInfo = null;
    let planningGaps = [];

    if (term) {
        const total = weekCount(term.starts_on, term.ends_on);
        let thisWeek = null;

        if (today() >= term.starts_on && today() <= term.ends_on) {
            const elapsed = (new Date(today()) - new Date(term.starts_on)) / 86400000;
            thisWeek = Math.min(total, Math.floor(elapsed / 7) + 1);
        }

        termInfo = { id: term.id, name: term.name, weekCount: total, currentWeek: thisWeek };

        // Which of my subjects still lack a scheme, and is this week planned?
        const assignmentIds = yearScoped.teachingSubjects.map((s) => s.id);

        if (assignmentIds.length > 0) {
            const [schemeRes, planRes] = await Promise.all([
                supabase.from('schemes_of_work')
                    .select('class_subject_id').eq('term_id', term.id).eq('author_id', userId),
                thisWeek
                    ? supabase.from('lesson_plans')
                        .select('class_subject_id')
                        .eq('term_id', term.id).eq('author_id', userId).eq('week_number', thisWeek)
                    : Promise.resolve({ data: [], error: null }),
            ]);

            if (schemeRes.error) throw schemeRes.error;
            if (planRes.error) throw planRes.error;

            const haveScheme = new Set((schemeRes.data || []).map((s) => s.class_subject_id));
            const havePlan = new Set((planRes.data || []).map((p) => p.class_subject_id));

            planningGaps = yearScoped.teachingSubjects
                .filter((s) => !haveScheme.has(s.id) || (thisWeek && !havePlan.has(s.id)))
                .map((s) => ({
                    classSubjectId: s.id,
                    subject: s.subject,
                    class: s.class,
                    missingScheme: !haveScheme.has(s.id),
                    missingThisWeek: Boolean(thisWeek) && !havePlan.has(s.id),
                }));
        }
    }

    const horizon = new Date(Date.now() + 14 * 86400000).toISOString().slice(0, 10);
    const { data: events, error: eventError } = await supabase
        .from('calendar_events')
        .select('id, title, category, starts_on, ends_on, all_day, location, audience')
        .eq('school_id', schoolId)
        .gte('ends_on', today())
        .lte('starts_on', horizon)
        .order('starts_on')
        .limit(6);

    if (eventError) throw eventError;

    const visibleEvents = (events || [])
        .filter((e) => e.audience === 'all' || e.audience === req.user.role)
        .map((e) => ({
            id: e.id,
            title: e.title,
            category: e.category,
            startsOn: e.starts_on,
            endsOn: e.ends_on,
            location: e.location,
        }));

    res.json({
        academicYearId: yearId,
        term: termInfo,
        ...yearScoped,
        openTasks,
        overdueTaskCount: openTasks.filter((t) => t.isOverdue).length,
        unreadMessages,
        attendanceOutstanding,
        planningGaps,
        upcomingEvents: visibleEvents,
    });
});

module.exports = { getAdminSummary, getMySummary };
