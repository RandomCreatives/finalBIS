const supabase = require('../config/supabase');
const { BadRequestError, NotFoundError, ForbiddenError, ConflictError, asyncHandler } = require('../utils/errors');
const { teacherClassIds, assertClassAccess } = require('../utils/classAccess');

/**
 * Attendance in two modes:
 *   homeroom  — one record per student per day (subject_id NULL)
 *   subject   — one record per student per day per subject
 *
 * The schema's partial unique indexes back both modes, so we can upsert
 * a whole class in a single round trip instead of looping per student.
 */

/**
 * POST /api/attendance — bulk mark/update one class for one date.
 *
 * Delegated to a DB function: attendance is keyed by partial unique indexes
 * (homeroom vs subject), which PostgREST's upsert cannot target. The function
 * also makes marking a whole register atomic.
 */
const markAttendance = asyncHandler(async (req, res) => {
    const { classId, subjectId, date, records } = req.body;

    if (!Array.isArray(records) || records.length === 0) {
        throw new BadRequestError('records must be a non-empty array');
    }

    // Submitted months are frozen for everyone except admins.
    await assertMonthEditable(req, classId, date);

    const { data, error } = await supabase.rpc('mark_attendance', {
        p_school_id: req.user.school_id,
        p_class_id: classId,
        p_subject_id: subjectId ?? null,
        p_date: date,
        p_marked_by: req.user.id,
        p_records: records.map((r) => ({
            studentId: r.studentId,
            status: r.status,
            note: r.note ?? '',
        })),
    });

    if (error) {
        if (error.message?.includes('CLASS_NOT_FOUND')) throw new NotFoundError('Class not found');
        throw error;
    }

    const count = data?.count ?? records.length;
    res.status(201).json({ message: `Attendance saved for ${count} student(s)`, count });
});

/** GET /api/attendance?classId=&date=&subjectId= */
const getClassAttendance = asyncHandler(async (req, res) => {
    const { classId, date, subjectId } = req.query;

    let query = supabase
        .from('attendance')
        .select('id, date, status, note, student:students(id, name, admission_no, roll_num)')
        .eq('school_id', req.user.school_id)
        .eq('class_id', classId)
        .eq('date', date);

    query = subjectId ? query.eq('subject_id', subjectId) : query.is('subject_id', null);

    const { data, error } = await query;
    if (error) throw error;

    res.json({ attendance: data });
});

/** GET /api/attendance/student/:studentId?from=&to= */
const getStudentAttendance = asyncHandler(async (req, res) => {
    const { from, to } = req.query;

    let query = supabase
        .from('attendance')
        .select('id, date, status, note, subject:subjects(id, name)')
        .eq('student_id', req.params.studentId)
        .eq('school_id', req.user.school_id)
        .order('date', { ascending: false });

    if (from) query = query.gte('date', from);
    if (to) query = query.lte('date', to);

    const { data, error } = await query;
    if (error) throw error;

    const total = data.length;
    const present = data.filter((r) => r.status === 'present').length;
    const late = data.filter((r) => r.status === 'late').length;
    const absent = data.filter((r) => r.status === 'absent').length;
    const excused = data.filter((r) => r.status === 'excused').length;

    res.json({
        attendance: data,
        stats: {
            total,
            present,
            late,
            absent,
            excused,
            // Late still counts as attending; excused is removed from the denominator.
            attendanceRate: total - excused > 0
                ? Number((((present + late) / (total - excused)) * 100).toFixed(1))
                : null,
        },
    });
});

/** GET /api/attendance/summary?classId=&from=&to= */
const getAttendanceSummary = asyncHandler(async (req, res) => {
    const { classId, from, to } = req.query;

    let query = supabase
        .from('attendance')
        .select('status, date')
        .eq('school_id', req.user.school_id);

    if (classId) query = query.eq('class_id', classId);
    if (from) query = query.gte('date', from);
    if (to) query = query.lte('date', to);

    const { data, error } = await query;
    if (error) throw error;

    const byStatus = data.reduce((acc, r) => {
        acc[r.status] = (acc[r.status] || 0) + 1;
        return acc;
    }, {});

    res.json({ total: data.length, byStatus });
});


/*
 * Monthly review & submission workflow.
 *
 * A main teacher reviews the month's registers and submits them; submission
 * locks the month (status 'submitted') so registers can no longer change.
 * An admin can return a month for correction (status 'returned'), unlocking
 * it until the teacher resubmits.
 *
 * Attendance-rate convention (matches getStudentAttendance): Late counts as
 * attending; excused absences are removed from the denominator.
 */

const MONTH_RE = /^\d{4}-(0[1-9]|1[0-2])$/;

const assertMonthFormat = (month) => {
    if (!MONTH_RE.test(month || '')) {
        throw new BadRequestError('month must be YYYY-MM');
    }
};

const lastDayOf = (month) => {
    const [y, m] = month.split('-').map(Number);
    return new Date(Date.UTC(y, m, 0)).getUTCDate();
};

/** Monday–Friday days of the month up to (and including) today. */
const schoolDaysSoFar = (month, todayIso) => {
    const [y, m] = month.split('-').map(Number);
    const daysInMonth = lastDayOf(month);
    let count = 0;
    for (let d = 1; d <= daysInMonth; d += 1) {
        const iso = `${month}-${String(d).padStart(2, '0')}`;
        if (iso > todayIso) break;
        const dow = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
        if (dow >= 1 && dow <= 5) count += 1;
    }
    return count;
};

const getSubmission = async (classId, month) => {
    const { data, error } = await supabase
        .from('attendance_submissions')
        .select('id, class_id, month, status, submitted_by, submitted_at, note')
        .eq('class_id', classId)
        .eq('month', month)
        .maybeSingle();

    if (error) throw error;
    return data;
};

const assertMonthEditable = async (req, classId, dateStr) => {
    if (req.user.role === 'admin') return;
    const month = String(dateStr || '').slice(0, 7);
    const sub = await getSubmission(classId, month);
    if (sub && sub.status === 'submitted') {
        throw new ConflictError(
            'This month has been submitted and is locked. Ask an admin to return it for correction.'
        );
    }
};

/** Shared builder for the review screen and the CSV export. */
const buildMonthlySummary = async (schoolId, classId, month) => {
    const daysInMonth = lastDayOf(month);

    const [klassRes, rosterRes, rowsRes, submissionRes] = await Promise.all([
        supabase.from('classes').select('id, name').eq('id', classId)
            .eq('school_id', schoolId).maybeSingle(),
        supabase.from('students')
            .select('id, name, admission_no, roll_num')
            .eq('school_id', schoolId)
            .eq('class_id', classId)
            .eq('is_active', true)
            .order('name'),
        supabase.from('attendance')
            .select('student_id, date, status')
            .eq('school_id', schoolId)
            .eq('class_id', classId)
            .is('subject_id', null)
            .gte('date', `${month}-01`)
            .lte('date', `${month}-${String(daysInMonth).padStart(2, '0')}`),
        supabase.from('attendance_submissions')
            .select('id, class_id, month, status, submitted_by, submitted_at, note')
            .eq('class_id', classId)
            .eq('month', month)
            .maybeSingle(),
    ]);

    // Surface real query errors instead of failing silently.
    for (const [label, r] of [['class', klassRes], ['students', rosterRes],
                              ['attendance', rowsRes], ['submission', submissionRes]]) {
        if (r.error) {
            throw new BadRequestError(`Monthly summary (${label}): ${r.error.message}`);
        }
    }

    const klass = klassRes.data;
    const roster = rosterRes.data;
    const rows = rowsRes.data;
    const submission = submissionRes.data;

    if (!klass) throw new NotFoundError('Class not found');

    const perStudent = {};
    const markedDates = new Set();
    for (const r of rows || []) {
        markedDates.add(r.date);
        const s = (perStudent[r.student_id] ||= { present: 0, late: 0, absent: 0, excused: 0 });
        if (s[r.status] !== undefined) s[r.status] += 1;
    }

    const students = (roster || []).map((st) => {
        const counts = perStudent[st.id] || { present: 0, late: 0, absent: 0, excused: 0 };
        const marked = counts.present + counts.late + counts.absent + counts.excused;
        const denominator = marked - counts.excused;
        return {
            id: st.id,
            name: st.name,
            admissionNo: st.admission_no,
            rollNum: st.roll_num,
            ...counts,
            markedDays: marked,
            // Late counts as attending; excused leaves the denominator.
            attendanceRate: denominator > 0
                ? Number((((counts.present + counts.late) / denominator) * 100).toFixed(1))
                : null,
        };
    });

    return {
        classId: klass.id,
        className: klass.name,
        month,
        schoolDays: schoolDaysSoFar(month, new Date().toISOString().slice(0, 10)),
        daysMarked: markedDates.size,
        submission: submission
            ? {
                status: submission.status,
                submittedAt: submission.submitted_at,
                submittedBy: submission.submitted_by,
                note: submission.note,
            }
            : null,
        students,
    };
};

/** GET /api/attendance/monthly?classId=&month=YYYY-MM */
const getMonthlySummary = asyncHandler(async (req, res) => {
    const { classId, month } = req.query;
    assertMonthFormat(month);
    await assertClassAccess(req, classId);
    res.json(await buildMonthlySummary(req.user.school_id, classId, month));
});

/**
 * GET /api/attendance/monthly-grid?classId=&month=YYYY-MM
 *
 * Month-at-a-glance: every school day (Mon–Fri) up to today as a column,
 * every active student as a row, each cell the day's status. Powers the
 * expandable grid in the daily register.
 */
const getMonthlyGrid = asyncHandler(async (req, res) => {
    const { classId, month } = req.query;
    assertMonthFormat(month);
    await assertClassAccess(req, classId);

    const daysInMonth = lastDayOf(month);
    const todayIso = new Date().toISOString().slice(0, 10);
    const [y, m] = month.split('-').map(Number);

    // School days (Mon–Fri) up to today — future days have no data yet.
    const days = [];
    for (let d = 1; d <= daysInMonth; d += 1) {
        const iso = `${month}-${String(d).padStart(2, '0')}`;
        if (iso > todayIso) break;
        const dow = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
        if (dow >= 1 && dow <= 5) days.push(iso);
    }

    const [klassRes, rosterRes, attRes, submissionRes] = await Promise.all([
        supabase.from('classes').select('id, name').eq('id', classId)
            .eq('school_id', req.user.school_id).maybeSingle(),
        supabase.from('students')
            .select('id, name, admission_no, roll_num')
            .eq('school_id', req.user.school_id)
            .eq('class_id', classId)
            .eq('is_active', true)
            .order('name'),
        supabase.from('attendance')
            .select('student_id, date, status')
            .eq('school_id', req.user.school_id)
            .eq('class_id', classId)
            .is('subject_id', null)
            .gte('date', `${month}-01`)
            .lte('date', `${month}-${String(daysInMonth).padStart(2, '0')}`),
        supabase.from('attendance_submissions')
            .select('status, submitted_at, note')
            .eq('class_id', classId)
            .eq('month', month)
            .maybeSingle(),
    ]);

    for (const [label, r] of [['class', klassRes], ['students', rosterRes],
                              ['attendance', attRes], ['submission', submissionRes]]) {
        if (r.error) throw new BadRequestError(`Monthly grid (${label}): ${r.error.message}`);
    }

    const klass = klassRes.data;
    if (!klass) throw new NotFoundError('Class not found');

    const marksByStudent = {};
    for (const r of attRes.data || []) {
        (marksByStudent[r.student_id] ||= {})[r.date] = r.status;
    }

    const students = (rosterRes.data || []).map((st) => {
        const marks = marksByStudent[st.id] || {};
        let present = 0, late = 0, absent = 0, excused = 0;
        for (const s of Object.values(marks)) {
            if (s === 'present') present += 1;
            else if (s === 'late') late += 1;
            else if (s === 'absent') absent += 1;
            else if (s === 'excused') excused += 1;
        }
        const marked = present + late + absent + excused;
        const denominator = marked - excused;
        return {
            id: st.id,
            name: st.name,
            admissionNo: st.admission_no,
            rollNum: st.roll_num,
            marks,
            present, late, absent, excused,
            attendanceRate: denominator > 0
                ? Number((((present + late) / denominator) * 100).toFixed(1))
                : null,
        };
    });

    const submission = submissionRes.data;
    res.json({
        classId: klass.id,
        className: klass.name,
        month,
        days,
        students,
        submission: submission
            ? { status: submission.status, submittedAt: submission.submitted_at, note: submission.note }
            : null,
    });
});

/** POST /api/attendance/submit — teacher submits the month (locks it). */
const submitMonth = asyncHandler(async (req, res) => {
    const { classId, month } = req.body;
    assertMonthFormat(month);
    await assertClassAccess(req, classId);

    const { data, error } = await supabase
        .from('attendance_submissions')
        .upsert({
            school_id: req.user.school_id,
            class_id: classId,
            month,
            status: 'submitted',
            submitted_by: req.user.id,
            submitted_at: new Date().toISOString(),
            note: null,
        }, { onConflict: 'class_id,month' })
        .select('id, class_id, month, status, submitted_at, note')
        .maybeSingle();

    if (error) throw error;
    res.json({ message: `Attendance for ${month} submitted`, submission: data });
});

/** POST /api/attendance/return — admin unlocks a submitted month.
 *  The reason (`note`) is mandatory and is shown to the main teacher. */
const returnMonth = asyncHandler(async (req, res) => {
    const { classId, month, note } = req.body;
    assertMonthFormat(month);

    const existing = await getSubmission(classId, month);
    if (!existing) throw new NotFoundError('No submission found for that month');

    const { data, error } = await supabase
        .from('attendance_submissions')
        .update({ status: 'returned', note: note ?? null, updated_at: new Date().toISOString() })
        .eq('id', existing.id)
        .select('id, class_id, month, status, note')
        .maybeSingle();

    if (error) throw error;
    res.json({ message: `Attendance for ${month} returned for correction`, submission: data });
});

/** GET /api/attendance/submissions?month=YYYY-MM — admin: all, teacher: own classes. */
const listSubmissions = asyncHandler(async (req, res) => {
    const { month } = req.query;
    assertMonthFormat(month);

    let classIds = null;
    if (req.user.role !== 'admin') {
        const { data: year, error: yearError } = await supabase
            .from('academic_years')
            .select('id')
            .eq('school_id', req.user.school_id)
            .eq('is_current', true)
            .maybeSingle();

        if (yearError) throw yearError;
        if (!year) return res.json({ submissions: [] });

        const [staffRes, subjRes] = await Promise.all([
            supabase.from('class_staff')
                .select('class_id')
                .eq('academic_year_id', year.id)
                .eq('user_id', req.user.id),
            supabase.from('class_subjects')
                .select('class_id')
                .eq('academic_year_id', year.id)
                .eq('teacher_id', req.user.id),
        ]);

        if (staffRes.error) throw staffRes.error;
        if (subjRes.error) throw subjRes.error;

        classIds = [...new Set([
            ...(staffRes.data || []).map((r) => r.class_id),
            ...(subjRes.data || []).map((r) => r.class_id),
        ])];
        if (classIds.length === 0) return res.json({ submissions: [] });
    }

    let classQuery = supabase.from('classes')
        .select('id, name')
        .eq('school_id', req.user.school_id)
        .order('name');
    if (classIds) classQuery = classQuery.in('id', classIds);

    let subQuery = supabase.from('attendance_submissions')
        .select('class_id, month, status, submitted_at, submitted_by, note')
        .eq('school_id', req.user.school_id)
        .eq('month', month);
    if (classIds) subQuery = subQuery.in('class_id', classIds);

    const [{ data: classes, error: cErr }, { data: subs, error: sErr }] =
        await Promise.all([classQuery, subQuery]);

    if (cErr) throw cErr;
    if (sErr) throw sErr;

    const byClass = new Map((subs || []).map((s) => [s.class_id, s]));

    res.json({
        submissions: (classes || []).map((cl) => {
            const s = byClass.get(cl.id);
            return {
                classId: cl.id,
                className: cl.name,
                month,
                status: s?.status ?? 'pending',
                submittedAt: s?.submitted_at ?? null,
                note: s?.note ?? null,
            };
        }),
    });
});

const csvEscape = (v) => {
    const s = v === null || v === undefined ? '' : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

/** GET /api/attendance/report.csv?classId=&month=YYYY-MM */
const exportCsv = asyncHandler(async (req, res) => {
    const { classId, month } = req.query;
    assertMonthFormat(month);
    await assertClassAccess(req, classId);

    const summary = await buildMonthlySummary(req.user.school_id, classId, month);

    const header = [
        'Class', 'Month', 'Admission No', 'Roll', 'Student Name',
        'Days Marked', 'Present', 'Late', 'Absent', 'Excused', 'Attendance %',
    ];
    const lines = [header.map(csvEscape).join(',')];

    for (const s of summary.students) {
        lines.push([
            summary.className, summary.month, s.admissionNo, s.rollNum, s.name,
            s.markedDays, s.present, s.late, s.absent, s.excused,
            s.attendanceRate === null ? '' : s.attendanceRate,
        ].map(csvEscape).join(','));
    }

    const safeName = summary.className.replace(/[^a-z0-9]+/gi, '-');
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition',
        `attachment; filename="attendance_${safeName}_${month}.csv"`);
    res.send(`${lines.join('\n')}\n`);
});

module.exports = {
    markAttendance, getClassAttendance, getStudentAttendance, getAttendanceSummary,
    getMonthlySummary, getMonthlyGrid, submitMonth, returnMonth, listSubmissions, exportCsv,
};
