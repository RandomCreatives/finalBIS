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



const percent = (part, total) => (total > 0 ? Math.round((part / total) * 100) : 100);

const flowState = (progress) => {
    if (progress >= 90) return 'healthy';
    if (progress >= 60) return 'attention';
    return 'critical';
};

const flow = ({ id, title, source, destination, metric, detail, progress, href, nextAction }) => ({
    id,
    title,
    source,
    destination,
    metric,
    detail,
    progress: Math.max(0, Math.min(100, progress)),
    status: flowState(progress),
    href,
    nextAction,
});

const assertOk = (...responses) => {
    for (const response of responses) {
        if (response?.error) throw response.error;
    }
};

const statusCount = (rows, statuses) => rows.filter((row) => statuses.includes(row.status)).length;

const countOf = (schoolId, table, apply = (q) => q) =>
    apply(supabase.from(table).select('id', { count: 'exact', head: true }).eq('school_id', schoolId));

const getCurrentTermRecord = async (schoolId) => {
    const { data, error } = await supabase
        .from('terms')
        .select('id, name, starts_on, ends_on')
        .eq('school_id', schoolId)
        .eq('is_current', true)
        .maybeSingle();

    if (error) throw error;
    return data;
};

const currentWeekFor = (term) => {
    if (!term) return null;
    if (today() < term.starts_on || today() > term.ends_on) return null;
    const total = weekCount(term.starts_on, term.ends_on);
    const elapsed = (new Date(today()) - new Date(term.starts_on)) / 86400000;
    return Math.min(total, Math.floor(elapsed / 7) + 1);
};

const getNoticeAckStats = async ({ schoolId, role = null, userId = null }) => {
    const [noticeRes, usersRes] = await Promise.all([
        supabase
            .from('notices')
            .select('id, audience, requires_ack')
            .eq('school_id', schoolId)
            .eq('requires_ack', true),
        userId
            ? Promise.resolve({ data: [], error: null })
            : supabase
                .from('users')
                .select('id, role, is_active')
                .eq('school_id', schoolId)
                .eq('is_active', true),
    ]);

    assertOk(noticeRes, usersRes);

    const notices = (noticeRes.data || []).filter((notice) => !role || notice.audience === 'all' || notice.audience === role);
    if (notices.length === 0) {
        return { requiredNotices: 0, requiredReceipts: 0, acknowledged: 0, outstanding: 0, progress: 100 };
    }

    const receiptQuery = supabase
        .from('notice_receipts')
        .select('notice_id, user_id, acknowledged_at')
        .in('notice_id', notices.map((notice) => notice.id));

    const receiptRes = userId ? await receiptQuery.eq('user_id', userId) : await receiptQuery;
    assertOk(receiptRes);

    const receipts = receiptRes.data || [];

    if (userId) {
        const acknowledged = new Set(receipts.filter((r) => r.acknowledged_at).map((r) => r.notice_id)).size;
        const requiredReceipts = notices.length;
        const outstanding = Math.max(0, requiredReceipts - acknowledged);
        return {
            requiredNotices: notices.length,
            requiredReceipts,
            acknowledged,
            outstanding,
            progress: percent(acknowledged, requiredReceipts),
        };
    }

    const activeUsers = usersRes.data || [];
    let requiredReceipts = 0;
    let acknowledged = 0;

    for (const notice of notices) {
        const targetIds = new Set(
            activeUsers
                .filter((user) => notice.audience === 'all' || user.role === notice.audience)
                .map((user) => user.id)
        );

        requiredReceipts += targetIds.size;
        acknowledged += receipts.filter(
            (receipt) => targetIds.has(receipt.user_id) && receipt.notice_id === notice.id && receipt.acknowledged_at
        ).length;
    }

    const outstanding = Math.max(0, requiredReceipts - acknowledged);
    return {
        requiredNotices: notices.length,
        requiredReceipts,
        acknowledged,
        outstanding,
        progress: percent(acknowledged, requiredReceipts),
    };
};

const getUnreadMessageCount = async (userId) => {
    const membershipRes = await supabase
        .from('thread_participants')
        .select('thread_id, last_read_at')
        .eq('user_id', userId);

    assertOk(membershipRes);

    const memberships = membershipRes.data || [];
    if (memberships.length === 0) return { unreadMessages: 0, threadIds: [] };

    const msgRes = await supabase
        .from('messages')
        .select('thread_id, sender_id, created_at')
        .in('thread_id', memberships.map((m) => m.thread_id));

    assertOk(msgRes);

    const readMap = new Map(memberships.map((m) => [m.thread_id, m.last_read_at]));
    const unreadMessages = (msgRes.data || []).filter((message) => {
        if (message.sender_id === userId) return false;
        const lastRead = readMap.get(message.thread_id);
        return !lastRead || new Date(message.created_at) > new Date(lastRead);
    }).length;

    return { unreadMessages, threadIds: memberships.map((m) => m.thread_id) };
};

const getTeacherYearScope = async (userId, yearId) => {
    if (!yearId) return { homerooms: [], teachingSubjects: [] };

    const [staffRes, subjectRes] = await Promise.all([
        supabase
            .from('class_staff')
            .select('position, class:classes(id, name)')
            .eq('user_id', userId)
            .eq('academic_year_id', yearId),
        supabase
            .from('class_subjects')
            .select('id, class:classes(id, name), subject:subjects(id, name, code)')
            .eq('teacher_id', userId)
            .eq('academic_year_id', yearId),
    ]);

    assertOk(staffRes, subjectRes);

    return {
        homerooms: (staffRes.data || []).map((row) => ({ position: row.position, class: row.class })),
        teachingSubjects: subjectRes.data || [],
    };
};

/**
 * GET /api/dashboard/data-flow
 *
 * A compact operations layer showing whether information is moving between
 * teachers, reviewers and administrators as expected. It is scoped by role:
 * admins see the whole branch; teachers see only their own obligations.
 */
const getDataFlow = asyncHandler(async (req, res) => {
    const schoolId = req.user.school_id;
    const isAdmin = req.user.role === 'admin';

    let yearId = null;
    try {
        yearId = await resolveYearId(req);
    } catch {
        // A new branch can be configured before an academic year exists.
    }

    if (isAdmin) {
        const term = await getCurrentTermRecord(schoolId);

        const [classRes, staffSeatRes, attendanceRes, schemesRes, plansRes, tasksRes, threadsRes, clinicRes] =
            await Promise.all([
                countOf(schoolId, 'classes'),
                yearId
                    ? countOf(schoolId, 'class_staff', (q) => q.eq('academic_year_id', yearId))
                    : Promise.resolve({ count: 0, error: null }),
                supabase
                    .from('attendance')
                    .select('class_id, status')
                    .eq('school_id', schoolId)
                    .eq('date', today())
                    .is('subject_id', null),
                (term
                    ? supabase.from('schemes_of_work').select('status').eq('school_id', schoolId).eq('term_id', term.id)
                    : supabase.from('schemes_of_work').select('status').eq('school_id', schoolId)),
                (term
                    ? supabase.from('lesson_plans').select('status').eq('school_id', schoolId).eq('term_id', term.id)
                    : supabase.from('lesson_plans').select('status').eq('school_id', schoolId)),
                supabase
                    .from('tasks')
                    .select('id, status, due_on, priority')
                    .eq('school_id', schoolId),
                supabase
                    .from('threads')
                    .select('id, status, priority')
                    .eq('school_id', schoolId),
                countOf(schoolId, 'clinic_visits', (q) => q.eq('leave_status', 'pending')),
            ]);

        assertOk(classRes, staffSeatRes, attendanceRes, schemesRes, plansRes, tasksRes, threadsRes, clinicRes);

        const noticeStats = await getNoticeAckStats({ schoolId });

        const totalClasses = classRes.count ?? 0;
        const expectedSeats = totalClasses * 2;
        const filledSeats = staffSeatRes.count ?? 0;
        const staffingProgress = percent(filledSeats, expectedSeats);

        const attendanceRows = attendanceRes.data || [];
        const submittedClasses = new Set(attendanceRows.map((row) => row.class_id)).size;
        const attendanceProgress = percent(submittedClasses, totalClasses);
        const present = attendanceRows.filter((row) => row.status === 'present' || row.status === 'late').length;
        const attendanceRate = attendanceRows.length ? Number(((present / attendanceRows.length) * 100).toFixed(1)) : null;

        const planningDocs = [...(schemesRes.data || []), ...(plansRes.data || [])];
        const pendingReview = statusCount(planningDocs, ['submitted']);
        const changesRequested = statusCount(planningDocs, ['changes_requested']);
        const approved = statusCount(planningDocs, ['approved']);
        const planningProgress = planningDocs.length ? percent(approved, planningDocs.length) : 100;

        const taskRows = tasksRes.data || [];
        const openTasks = taskRows.filter((task) => ['pending', 'in_progress'].includes(task.status));
        const overdueTasks = openTasks.filter((task) => task.due_on && task.due_on < today());
        const taskProgress = openTasks.length === 0
            ? 100
            : Math.max(0, 100 - Math.min(100, overdueTasks.length * 25 + openTasks.length * 5));

        const threadRows = threadsRes.data || [];
        const openThreads = threadRows.filter((thread) => thread.status === 'open');
        const highThreads = openThreads.filter((thread) => thread.priority === 'high');
        const messageProgress = openThreads.length === 0
            ? 100
            : Math.max(0, 100 - Math.min(100, highThreads.length * 25 + openThreads.length * 4));

        const pendingLeave = clinicRes.count ?? 0;
        const clinicProgress = pendingLeave === 0 ? 100 : Math.max(35, 100 - pendingLeave * 20);

        const flows = [
            flow({
                id: 'staffing',
                title: 'Branch staffing setup',
                source: 'Admin office',
                destination: 'Teacher portals',
                metric: `${filledSeats}/${expectedSeats || 0} class seats`,
                detail: 'Main and assistant teacher assignments published to class, timetable and dashboard views.',
                progress: staffingProgress,
                href: '/app/assignments',
                nextAction: filledSeats < expectedSeats ? 'Fill every main and assistant teacher seat' : 'Staffing model is ready',
            }),
            flow({
                id: 'attendance',
                title: 'Daily attendance loop',
                source: 'Teachers',
                destination: 'Admin dashboard',
                metric: `${submittedClasses}/${totalClasses} classes submitted`,
                detail: attendanceRate === null
                    ? 'No homeroom register has been sent today.'
                    : `${attendanceRate}% present or late among submitted registers.`,
                progress: attendanceProgress,
                href: '/app/attendance',
                nextAction: submittedClasses < totalClasses ? 'Follow up on missing registers' : 'Registers are complete for today',
            }),
            flow({
                id: 'planning',
                title: 'Planning review queue',
                source: 'Teachers',
                destination: 'Admin reviewers',
                metric: `${pendingReview} awaiting review`,
                detail: `${approved} approved · ${changesRequested} returned for changes${term ? ` · ${term.name}` : ''}`,
                progress: planningProgress,
                href: '/app/planning',
                nextAction: pendingReview > 0 ? 'Review submitted schemes and lesson plans' : 'No pending review items',
            }),
            flow({
                id: 'tasks',
                title: 'Admin task handoff',
                source: 'Leadership',
                destination: 'Assigned staff',
                metric: `${openTasks.length} open task(s)`,
                detail: `${overdueTasks.length} overdue item(s) need escalation.`,
                progress: taskProgress,
                href: '/app/tasks',
                nextAction: overdueTasks.length > 0 ? 'Escalate overdue operational tasks' : 'Open tasks are under control',
            }),
            flow({
                id: 'messages',
                title: 'Conversation pipeline',
                source: 'Admin ↔ Teachers',
                destination: 'Resolved decisions',
                metric: `${openThreads.length} open thread(s)`,
                detail: `${highThreads.length} high-priority conversation(s) still open.`,
                progress: messageProgress,
                href: '/app/messages',
                nextAction: highThreads.length > 0 ? 'Close high-priority conversations first' : 'Keep response times tight',
            }),
            flow({
                id: 'notices',
                title: 'Notice acknowledgement',
                source: 'Admin notices',
                destination: 'Staff confirmations',
                metric: `${noticeStats.outstanding} ack(s) outstanding`,
                detail: `${noticeStats.acknowledged}/${noticeStats.requiredReceipts} required acknowledgements captured.`,
                progress: noticeStats.progress,
                href: '/app/notices',
                nextAction: noticeStats.outstanding > 0 ? 'Remind staff to acknowledge notices' : 'All required notices acknowledged',
            }),
            flow({
                id: 'clinic',
                title: 'Clinic leave approvals',
                source: 'Teachers / clinic',
                destination: 'Admin approval',
                metric: `${pendingLeave} pending leave`,
                detail: 'Medical leave requests remain admin-approved to protect safeguarding decisions.',
                progress: clinicProgress,
                href: '/app/clinic',
                nextAction: pendingLeave > 0 ? 'Review pending medical leave requests' : 'No leave approvals waiting',
            }),
        ];

        const healthScore = Math.round(flows.reduce((sum, item) => sum + item.progress, 0) / flows.length);
        const openItems = Math.max(0, expectedSeats - filledSeats) + Math.max(0, totalClasses - submittedClasses) +
            pendingReview + openTasks.length + openThreads.length + noticeStats.outstanding + pendingLeave;

        return res.json({
            role: 'admin',
            date: today(),
            academicYearId: yearId,
            term: term ? { id: term.id, name: term.name, currentWeek: currentWeekFor(term) } : null,
            healthScore,
            openItems,
            flows,
        });
    }

    const term = await getCurrentTermRecord(schoolId);
    const currentWeek = currentWeekFor(term);
    const yearScoped = await getTeacherYearScope(req.user.id, yearId);

    const homeroomClassIds = yearScoped.homerooms.map((homeroom) => homeroom.class?.id).filter(Boolean);
    let attendanceOutstanding = [];

    if (homeroomClassIds.length > 0) {
        const markedRes = await supabase
            .from('attendance')
            .select('class_id')
            .in('class_id', homeroomClassIds)
            .eq('date', today())
            .is('subject_id', null);

        assertOk(markedRes);
        const marked = new Set((markedRes.data || []).map((row) => row.class_id));
        attendanceOutstanding = yearScoped.homerooms
            .filter((homeroom) => homeroom.class && !marked.has(homeroom.class.id))
            .map((homeroom) => homeroom.class);
    }

    let planningGaps = [];
    let planningDocs = [];
    if (term && yearScoped.teachingSubjects.length > 0) {
        const [schemeRes, planRes, thisWeekPlanRes] = await Promise.all([
            supabase
                .from('schemes_of_work')
                .select('class_subject_id, status')
                .eq('term_id', term.id)
                .eq('author_id', req.user.id),
            supabase
                .from('lesson_plans')
                .select('class_subject_id, week_number, status')
                .eq('term_id', term.id)
                .eq('author_id', req.user.id),
            currentWeek
                ? supabase
                    .from('lesson_plans')
                    .select('class_subject_id')
                    .eq('term_id', term.id)
                    .eq('author_id', req.user.id)
                    .eq('week_number', currentWeek)
                : Promise.resolve({ data: [], error: null }),
        ]);

        assertOk(schemeRes, planRes, thisWeekPlanRes);

        const schemes = schemeRes.data || [];
        const plans = planRes.data || [];
        planningDocs = [...schemes, ...plans];

        const haveScheme = new Set(schemes.map((scheme) => scheme.class_subject_id));
        const havePlanThisWeek = new Set((thisWeekPlanRes.data || []).map((plan) => plan.class_subject_id));

        planningGaps = yearScoped.teachingSubjects
            .filter((subject) => !haveScheme.has(subject.id) || (currentWeek && !havePlanThisWeek.has(subject.id)))
            .map((subject) => ({
                classSubjectId: subject.id,
                subject: subject.subject,
                class: subject.class,
                missingScheme: !haveScheme.has(subject.id),
                missingThisWeek: Boolean(currentWeek) && !havePlanThisWeek.has(subject.id),
            }));
    }

    const [taskRes, unreadInfo, noticeStats] = await Promise.all([
        supabase
            .from('tasks')
            .select('id, status, due_on, priority')
            .eq('school_id', schoolId)
            .eq('assigned_to', req.user.id)
            .in('status', ['pending', 'in_progress']),
        getUnreadMessageCount(req.user.id),
        getNoticeAckStats({ schoolId, role: req.user.role, userId: req.user.id }),
    ]);

    assertOk(taskRes);

    const threadRes = unreadInfo.threadIds.length > 0
        ? await supabase
            .from('threads')
            .select('id, status, priority')
            .in('id', unreadInfo.threadIds)
        : { data: [], error: null };

    assertOk(threadRes);

    const openTasks = taskRes.data || [];
    const overdueTasks = openTasks.filter((task) => task.due_on && task.due_on < today());
    const openThreads = (threadRes.data || []).filter((thread) => thread.status === 'open');
    const submittedPlanning = statusCount(planningDocs, ['submitted']);
    const returnedPlanning = statusCount(planningDocs, ['changes_requested']);

    const attendanceProgress = percent(homeroomClassIds.length - attendanceOutstanding.length, homeroomClassIds.length);
    const planningProgress = yearScoped.teachingSubjects.length
        ? Math.max(0, 100 - Math.min(100, planningGaps.length * 30 + returnedPlanning * 15))
        : 100;
    const taskProgress = openTasks.length === 0
        ? 100
        : Math.max(0, 100 - Math.min(100, overdueTasks.length * 30 + openTasks.length * 8));
    const messageProgress = unreadInfo.unreadMessages === 0
        ? 100
        : Math.max(0, 100 - Math.min(100, unreadInfo.unreadMessages * 15));

    const flows = [
        flow({
            id: 'attendance',
            title: 'Attendance to admin',
            source: 'Your homeroom',
            destination: 'Admin attendance view',
            metric: attendanceOutstanding.length === 0 ? 'Submitted today' : `${attendanceOutstanding.length} register(s) pending`,
            detail: attendanceOutstanding.length === 0
                ? 'No homeroom register is waiting on you today.'
                : attendanceOutstanding.map((klass) => klass.name).join(', '),
            progress: attendanceProgress,
            href: '/app/attendance',
            nextAction: attendanceOutstanding.length > 0 ? 'Send the missing homeroom register' : 'Attendance loop is complete',
        }),
        flow({
            id: 'planning',
            title: 'Planning to reviewers',
            source: 'Your schemes and plans',
            destination: 'Admin / main teacher review',
            metric: `${planningGaps.length} gap(s)`,
            detail: `${submittedPlanning} submitted · ${returnedPlanning} returned for changes${term ? ` · ${term.name}` : ''}`,
            progress: planningProgress,
            href: '/app/planning',
            nextAction: planningGaps.length > 0 ? 'Complete missing schemes or weekly plans' : 'Planning is ready for review',
        }),
        flow({
            id: 'tasks',
            title: 'Assigned tasks from admin',
            source: 'Leadership',
            destination: 'Your action list',
            metric: `${openTasks.length} open task(s)`,
            detail: `${overdueTasks.length} overdue task(s) need attention.`,
            progress: taskProgress,
            href: '/app/tasks',
            nextAction: overdueTasks.length > 0 ? 'Prioritise overdue tasks today' : 'Update task statuses as work progresses',
        }),
        flow({
            id: 'messages',
            title: 'Messages with admin',
            source: 'Admin ↔ You',
            destination: 'Resolved conversations',
            metric: `${unreadInfo.unreadMessages} unread message(s)`,
            detail: `${openThreads.length} open conversation(s) you participate in.`,
            progress: messageProgress,
            href: '/app/messages',
            nextAction: unreadInfo.unreadMessages > 0 ? 'Read and respond to new messages' : 'Inbox is clear',
        }),
        flow({
            id: 'notices',
            title: 'Notice acknowledgements',
            source: 'Admin notices',
            destination: 'Your confirmation',
            metric: `${noticeStats.outstanding} ack(s) due`,
            detail: `${noticeStats.acknowledged}/${noticeStats.requiredReceipts} required notices acknowledged.`,
            progress: noticeStats.progress,
            href: '/app/notices',
            nextAction: noticeStats.outstanding > 0 ? 'Acknowledge required notices' : 'All required notices acknowledged',
        }),
    ];

    const healthScore = Math.round(flows.reduce((sum, item) => sum + item.progress, 0) / flows.length);
    const openItems = attendanceOutstanding.length + planningGaps.length + openTasks.length +
        unreadInfo.unreadMessages + noticeStats.outstanding;

    return res.json({
        role: 'teacher',
        date: today(),
        academicYearId: yearId,
        term: term ? { id: term.id, name: term.name, currentWeek } : null,
        healthScore,
        openItems,
        flows,
    });
});


module.exports = { getAdminSummary, getMySummary, getDataFlow };
