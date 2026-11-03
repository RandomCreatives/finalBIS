const supabase = require('../config/supabase');
const ExcelJS = require('exceljs');
const { normalizeStudentName, sortStudentsCanonically } = require('../utils/studentRolls');
const { BadRequestError, NotFoundError, ForbiddenError, ConflictError, asyncHandler } = require('../utils/errors');
const { notifyAdmins } = require('../utils/nudges');
const { teacherClassIds, assertClassAccess } = require('../utils/classAccess');
const { selectAll } = require('../utils/selectAll');
const schoolTime = require('../utils/schoolTime');
const { resolveAttendanceReminder, reminderWindow } = require('../services/attendanceReminders');

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

    // The daily register is in: the main teacher's reminder has done its job.
    if (!subjectId) {
        await resolveAttendanceReminder({ schoolId: req.user.school_id, classId, date });
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

    res.json({
        attendance: (data || []).map((row) => ({
            ...row,
            student: row.student
                ? { ...row.student, name: normalizeStudentName(row.student.name) }
                : null,
        })),
    });
});

/** GET /api/attendance/student/:studentId?from=&to= */
const getStudentAttendance = asyncHandler(async (req, res) => {
    const { from, to } = req.query;

    // A year of lesson-by-lesson registers passes the API's 1000-row cap.
    const data = await selectAll('attendance', 'id, date, status, note, subject:subjects(id, name)', (query) => {
        let q = query
            .eq('student_id', req.params.studentId)
            .eq('school_id', req.user.school_id);
        if (from) q = q.gte('date', from);
        if (to) q = q.lte('date', to);
        return q;
    }, { order: [['date', false], ['id', true]] });

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

const STATUS_LIST = ['present', 'absent', 'late', 'excused'];

/** GET /api/attendance/summary?classId=&from=&to= */
const getAttendanceSummary = asyncHandler(async (req, res) => {
    const { classId, from, to } = req.query;

    // Exact counts per status: a school's history is far beyond what one
    // API page returns, and the summary must not stop at the first 1000 rows.
    const countFor = (status) => {
        let query = supabase
            .from('attendance')
            .select('id', { count: 'exact', head: true })
            .eq('school_id', req.user.school_id)
            .eq('status', status);
        if (classId) query = query.eq('class_id', classId);
        if (from) query = query.gte('date', from);
        if (to) query = query.lte('date', to);
        return query;
    };

    const results = await Promise.all(STATUS_LIST.map(countFor));
    const byStatus = {};
    let total = 0;
    results.forEach(({ count, error }, i) => {
        if (error) throw error;
        if (count) byStatus[STATUS_LIST[i]] = count;
        total += count || 0;
    });

    res.json({ total, byStatus });
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
const monthlySchoolDays = (month, todayIso) => {
    const [y, m] = month.split('-').map(Number);
    const days = [];
    for (let d = 1; d <= lastDayOf(month); d += 1) {
        const iso = `${month}-${String(d).padStart(2, '0')}`;
        if (iso > todayIso) break;
        const dow = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
        if (dow >= 1 && dow <= 5) days.push(iso);
    }
    return days;
};

const schoolDaysSoFar = (month, todayIso) => monthlySchoolDays(month, todayIso).length;

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

/**
 * One class's homeroom rows for a month, every page of them, shaped like a
 * supabase result so the callers' error labelling keeps working.
 */
const monthRows = (schoolId, classId, month, daysInMonth) => selectAll(
    'attendance',
    'student_id, date, status',
    (query) => query
        .eq('school_id', schoolId)
        .eq('class_id', classId)
        .is('subject_id', null)
        .gte('date', `${month}-01`)
        .lte('date', `${month}-${String(daysInMonth).padStart(2, '0')}`),
).then((data) => ({ data, error: null }), (error) => ({ data: null, error }));

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
        monthRows(schoolId, classId, month, daysInMonth),
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
        schoolDays: schoolDaysSoFar(month, schoolTime.todayIso()),
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
    const days = monthlySchoolDays(month, schoolTime.todayIso());

    const [klassRes, rosterRes, attRes, submissionRes] = await Promise.all([
        supabase.from('classes').select('id, name').eq('id', classId)
            .eq('school_id', req.user.school_id).maybeSingle(),
        supabase.from('students')
            .select('id, name, admission_no, roll_num')
            .eq('school_id', req.user.school_id)
            .eq('class_id', classId)
            .eq('is_active', true)
            .order('name'),
        monthRows(req.user.school_id, classId, month, daysInMonth),
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

    // Bell nudge for the office — a month's attendance was handed in.
    const { data: klass } = await supabase
        .from('classes')
        .select('name')
        .eq('id', classId)
        .eq('school_id', req.user.school_id)
        .maybeSingle();

    await notifyAdmins({
        schoolId: req.user.school_id,
        excludeUserId: req.user.id,
        kind: 'attendance_submitted',
        title: 'Monthly attendance submitted',
        body: `${month} · ${klass?.name || 'Class'} — handed in by ${req.user.name}`,
        link: '/app/attendance',
        dedupeKey: `attendance:${classId}:${month}:${data?.submitted_at || 'resubmit'}`,
    });

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

const ATTENDANCE_EXPORT_STATUS = {
    present: { symbol: '✓', label: 'Present', font: 'FF15803D', fill: 'FFEAF8EF' },
    late: { symbol: 'L', label: 'Late', font: 'FFB45309', fill: 'FFFFF7E6' },
    absent: { symbol: 'A', label: 'Absent', font: 'FFB91C1C', fill: 'FFFEECEC' },
    excused: { symbol: 'E', label: 'Excused', font: 'FF0369A1', fill: 'FFEAF4FF' },
    unmarked: { symbol: '·', label: 'Not recorded', font: 'FF6B7280', fill: 'FFF3F4F6' },
};

/**
 * Shared data for the admin's monthly workbook. The roster and attendance
 * queries are paged so a larger school never silently loses pupils or marks
 * at Supabase's 1,000-row response limit.
 */
const buildMonthlyAttendanceReport = async (schoolId, month, classId = null) => {
    const classRows = await selectAll('classes', 'id, name', (query) => {
        let filtered = query.eq('school_id', schoolId);
        if (classId) filtered = filtered.eq('id', classId);
        return filtered;
    }, { order: [['name', true], ['id', true]] });

    if (classId && classRows.length === 0) throw new NotFoundError('Class not found');
    if (classRows.length === 0) throw new NotFoundError('No classes are available for this report');

    const classIds = classRows.map((klass) => klass.id);
    const lastDay = lastDayOf(month);
    const [rosterRows, attendanceRows, submissionRows] = await Promise.all([
        selectAll('students', 'id, name, admission_no, roll_num, class_id', (query) => query
            .eq('school_id', schoolId)
            .eq('is_active', true)
            .in('class_id', classIds)),
        selectAll('attendance', 'student_id, class_id, date, status', (query) => query
            .eq('school_id', schoolId)
            .in('class_id', classIds)
            .is('subject_id', null)
            .gte('date', `${month}-01`)
            .lte('date', `${month}-${String(lastDay).padStart(2, '0')}`)),
        selectAll('attendance_submissions', 'class_id, status', (query) => query
            .in('class_id', classIds)
            .eq('month', month)),
    ]);

    const rostersByClass = new Map(classIds.map((id) => [id, []]));
    const activeStudentIds = new Set();
    for (const student of rosterRows) {
        if (!rostersByClass.has(student.class_id)) continue;
        rostersByClass.get(student.class_id).push(student);
        activeStudentIds.add(student.id);
    }

    const marksByStudent = new Map();
    const markedDatesByClass = new Map(classIds.map((id) => [id, new Set()]));
    for (const row of attendanceRows) {
        // Monthly grids, like the existing class review, use the active roster.
        if (!activeStudentIds.has(row.student_id)) continue;
        const marks = marksByStudent.get(row.student_id) || {};
        marks[row.date] = row.status;
        marksByStudent.set(row.student_id, marks);
        markedDatesByClass.get(row.class_id)?.add(row.date);
    }

    const submissionsByClass = new Map(submissionRows.map((row) => [row.class_id, row.status]));
    const todayIso = schoolTime.todayIso();
    const weekdayDates = monthlySchoolDays(month, todayIso);
    const workbookDates = new Set(weekdayDates);
    // Keep any actual weekend/exceptional register visible as a date column too.
    for (const marks of marksByStudent.values()) {
        Object.keys(marks).forEach((date) => workbookDates.add(date));
    }
    const days = [...workbookDates].sort();

    const classes = classRows.map((klass) => {
        const students = sortStudentsCanonically(rostersByClass.get(klass.id) || []).map((student) => {
            const marks = marksByStudent.get(student.id) || {};
            const counts = { present: 0, late: 0, absent: 0, excused: 0 };
            Object.values(marks).forEach((status) => {
                if (Object.hasOwn(counts, status)) counts[status] += 1;
            });
            const markedDays = counts.present + counts.late + counts.absent + counts.excused;
            const denominator = markedDays - counts.excused;
            return {
                id: student.id,
                rollNum: student.roll_num,
                admissionNo: student.admission_no,
                name: normalizeStudentName(student.name),
                marks,
                ...counts,
                markedDays,
                attendanceRate: denominator > 0
                    ? Number((((counts.present + counts.late) / denominator) * 100).toFixed(1))
                    : null,
            };
        });

        const totals = students.reduce((sum, student) => {
            for (const status of ['present', 'late', 'absent', 'excused']) sum[status] += student[status];
            return sum;
        }, { present: 0, late: 0, absent: 0, excused: 0 });
        const marked = totals.present + totals.late + totals.absent + totals.excused;
        const denominator = marked - totals.excused;

        return {
            id: klass.id,
            name: klass.name,
            students,
            days,
            weekdays: weekdayDates.length,
            daysMarked: markedDatesByClass.get(klass.id)?.size || 0,
            ...totals,
            attendanceRate: denominator > 0
                ? Number((((totals.present + totals.late) / denominator) * 100).toFixed(1))
                : null,
            submission: submissionsByClass.get(klass.id) || 'pending',
        };
    });

    return { month, classes };
};

const safeWorksheetName = (name, index, usedNames) => {
    const cleaned = String(name || `Class ${index + 1}`)
        .replace(/[\\/*?:\[\]]/g, ' ')
        .replace(/^'+|'+$/g, '')
        .trim();
    const base = (cleaned || `Class ${index + 1}`).slice(0, 31);
    let candidate = base;
    let suffix = 2;
    while (usedNames.has(candidate.toLowerCase())) {
        const tail = ` (${suffix})`;
        candidate = `${base.slice(0, 31 - tail.length)}${tail}`;
        suffix += 1;
    }
    usedNames.add(candidate.toLowerCase());
    return candidate;
};

const styleReportHeader = (row) => {
    row.height = 24;
    row.eachCell((cell) => {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1F3B5B' } };
        cell.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 10 };
        cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
        cell.border = { bottom: { style: 'thin', color: { argb: 'FFCBD5E1' } } };
    });
};

const addReportLegend = (sheet, rowNumber, columnCount) => {
    sheet.mergeCells(rowNumber, 1, rowNumber, columnCount);
    const cell = sheet.getCell(rowNumber, 1);
    cell.value = {
        richText: [
            { text: 'Key: ' },
            { text: '✓ Present', font: { bold: true, color: { argb: ATTENDANCE_EXPORT_STATUS.present.font } } },
            { text: '   ' },
            { text: 'L Late', font: { bold: true, color: { argb: ATTENDANCE_EXPORT_STATUS.late.font } } },
            { text: '   ' },
            { text: 'A Absent', font: { bold: true, color: { argb: ATTENDANCE_EXPORT_STATUS.absent.font } } },
            { text: '   ' },
            { text: 'E Excused', font: { bold: true, color: { argb: ATTENDANCE_EXPORT_STATUS.excused.font } } },
            { text: '   · Not recorded', font: { color: { argb: ATTENDANCE_EXPORT_STATUS.unmarked.font } } },
        ],
    };
    cell.alignment = { vertical: 'middle', wrapText: true };
    sheet.getRow(rowNumber).height = 24;
};

const addMonthlyAttendanceSheet = (workbook, reportClass, month, index, usedNames) => {
    const sheet = workbook.addWorksheet(safeWorksheetName(reportClass.name, index, usedNames));
    const lastColumn = 3 + reportClass.days.length + 6;
    const dateStartColumn = 4;
    const totalsStartColumn = dateStartColumn + reportClass.days.length;
    const submissionLabel = reportClass.submission === 'submitted'
        ? 'Submitted'
        : reportClass.submission === 'returned' ? 'Returned for correction' : 'Not submitted';

    sheet.properties.defaultRowHeight = 19;
    sheet.columns = [
        { width: 9 },
        { width: 17 },
        { width: 28 },
        ...reportClass.days.map(() => ({ width: 12 })),
        { width: 12 }, { width: 10 }, { width: 10 }, { width: 10 }, { width: 10 }, { width: 14 },
    ];

    sheet.addRow([`Monthly Attendance Report — ${month}`]);
    sheet.mergeCells(1, 1, 1, lastColumn);
    sheet.getCell(1, 1).font = { bold: true, size: 16, color: { argb: 'FFFFFFFF' } };
    sheet.getCell(1, 1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF17324D' } };
    sheet.getCell(1, 1).alignment = { vertical: 'middle' };
    sheet.getRow(1).height = 32;

    sheet.addRow([`${reportClass.name}  |  ${reportClass.students.length} active students  |  ${submissionLabel}`]);
    sheet.mergeCells(2, 1, 2, lastColumn);
    sheet.getCell(2, 1).font = { bold: true, color: { argb: 'FF334155' }, size: 11 };
    sheet.getCell(2, 1).alignment = { vertical: 'middle' };
    sheet.getRow(2).height = 23;
    addReportLegend(sheet, 3, lastColumn);

    const header = sheet.addRow([
        'Roll no.', 'Admission no.', 'Student',
        ...reportClass.days.map((date) => new Date(`${date}T00:00:00.000Z`)),
        'Days marked', 'Present', 'Late', 'Absent', 'Excused', 'Attendance %',
    ]);
    styleReportHeader(header);
    reportClass.days.forEach((_, index) => {
        header.getCell(dateStartColumn + index).numFmt = 'ddd dd-mmm';
    });

    for (const [rowIndex, student] of reportClass.students.entries()) {
        const values = [
            student.rollNum ?? '',
            student.admissionNo || '',
            student.name,
            ...reportClass.days.map((date) => {
                const status = student.marks[date];
                return ATTENDANCE_EXPORT_STATUS[status]?.symbol || ATTENDANCE_EXPORT_STATUS.unmarked.symbol;
            }),
            student.markedDays,
            student.present,
            student.late,
            student.absent,
            student.excused,
            student.attendanceRate ?? '',
        ];
        const row = sheet.addRow(values);
        row.height = 21;
        row.eachCell((cell, columnNumber) => {
            cell.border = { bottom: { style: 'hair', color: { argb: 'FFE2E8F0' } } };
            if (columnNumber <= 3 && rowIndex % 2 === 1) {
                cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF8FAFC' } };
            }
            if (columnNumber >= dateStartColumn) {
                cell.alignment = { vertical: 'middle', horizontal: 'center' };
            }
        });
        for (let dateIndex = 0; dateIndex < reportClass.days.length; dateIndex += 1) {
            const status = student.marks[reportClass.days[dateIndex]];
            const meta = ATTENDANCE_EXPORT_STATUS[status] || ATTENDANCE_EXPORT_STATUS.unmarked;
            const cell = row.getCell(dateStartColumn + dateIndex);
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: meta.fill } };
            cell.font = { bold: true, color: { argb: meta.font }, size: 11 };
        }
        row.getCell(totalsStartColumn + 5).numFmt = '0.0"%"';
        row.getCell(3).font = { bold: true, color: { argb: 'FF0F172A' } };
    }

    if (reportClass.students.length > 0) {
        sheet.autoFilter = {
            from: { row: 4, column: 1 },
            to: { row: 4 + reportClass.students.length, column: lastColumn },
        };
    } else {
        const emptyRow = sheet.addRow(['No active students in this class for the report.']);
        sheet.mergeCells(emptyRow.number, 1, emptyRow.number, lastColumn);
        emptyRow.getCell(1).font = { italic: true, color: { argb: 'FF64748B' } };
    }

    sheet.views = [{ state: 'frozen', xSplit: 3, ySplit: 4, topLeftCell: 'D5', activeCell: 'D5' }];
    sheet.pageSetup = { orientation: 'landscape', fitToPage: true, fitToWidth: 1, fitToHeight: 0 };
    sheet.pageSetup.margins = { left: 0.25, right: 0.25, top: 0.5, bottom: 0.5, header: 0.2, footer: 0.2 };
    sheet.headerFooter.oddFooter = '&LMonthly attendance report&RPage &P of &N';
    return sheet;
};

const addOverviewSheet = (workbook, report, usedNames) => {
    const sheet = workbook.addWorksheet(safeWorksheetName('Overview', 0, usedNames), { properties: { tabColor: { argb: 'FF2563EB' } } });
    const headers = [
        'Class', 'Active students', 'Class-days marked', 'Weekdays in month',
        'Present', 'Late', 'Absent', 'Excused', 'Attendance %', 'Submission',
    ];
    sheet.columns = [
        { width: 28 }, { width: 16 }, { width: 19 }, { width: 18 },
        { width: 12 }, { width: 10 }, { width: 10 }, { width: 10 }, { width: 14 }, { width: 22 },
    ];
    sheet.addRow([`Monthly Attendance Overview — ${report.month}`]);
    sheet.mergeCells(1, 1, 1, headers.length);
    sheet.getCell(1, 1).font = { bold: true, size: 16, color: { argb: 'FFFFFFFF' } };
    sheet.getCell(1, 1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF17324D' } };
    sheet.getCell(1, 1).alignment = { vertical: 'middle' };
    sheet.getRow(1).height = 32;
    addReportLegend(sheet, 2, headers.length);
    const header = sheet.addRow(headers);
    styleReportHeader(header);

    for (const reportClass of report.classes) {
        const row = sheet.addRow([
            reportClass.name,
            reportClass.students.length,
            reportClass.daysMarked,
            reportClass.weekdays,
            reportClass.present,
            reportClass.late,
            reportClass.absent,
            reportClass.excused,
            reportClass.attendanceRate ?? '',
            reportClass.submission === 'submitted'
                ? 'Submitted'
                : reportClass.submission === 'returned' ? 'Returned for correction' : 'Not submitted',
        ]);
        row.getCell(9).numFmt = '0.0"%"';
        row.eachCell((cell) => {
            cell.border = { bottom: { style: 'hair', color: { argb: 'FFE2E8F0' } } };
        });
    }

    const allTotals = report.classes.reduce((sum, reportClass) => {
        sum.students += reportClass.students.length;
        for (const status of ['present', 'late', 'absent', 'excused']) sum[status] += reportClass[status];
        sum.classDays += reportClass.daysMarked;
        return sum;
    }, { students: 0, classDays: 0, present: 0, late: 0, absent: 0, excused: 0 });
    const marked = allTotals.present + allTotals.late + allTotals.absent + allTotals.excused;
    const denominator = marked - allTotals.excused;
    const overallRate = denominator > 0 ? Number((((allTotals.present + allTotals.late) / denominator) * 100).toFixed(1)) : null;
    const totalRow = sheet.addRow([
        'All classes', allTotals.students, allTotals.classDays, '—',
        allTotals.present, allTotals.late, allTotals.absent, allTotals.excused,
        overallRate ?? '', '—',
    ]);
    totalRow.font = { bold: true };
    totalRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE2E8F0' } };
    totalRow.getCell(9).numFmt = '0.0"%"';
    totalRow.eachCell((cell) => {
        cell.border = { top: { style: 'thin', color: { argb: 'FF94A3B8' } } };
    });

    sheet.autoFilter = {
        from: { row: 3, column: 1 },
        to: { row: 2 + report.classes.length + 1, column: headers.length },
    };
    sheet.views = [{ state: 'frozen', ySplit: 3, topLeftCell: 'A4', activeCell: 'A4' }];
    sheet.pageSetup = { orientation: 'landscape', fitToPage: true, fitToWidth: 1, fitToHeight: 0 };
    return sheet;
};

/** GET /api/attendance/report.xlsx?classId=&month=YYYY-MM — admin only. */
const exportMonthlyXlsx = asyncHandler(async (req, res) => {
    const { classId, month } = req.query;
    assertMonthFormat(month);
    const report = await buildMonthlyAttendanceReport(req.user.school_id, month, classId || null);
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'BIS NOC School Management';
    workbook.created = new Date();
    workbook.subject = 'Monthly homeroom attendance';
    workbook.title = `Monthly attendance ${month}`;

    const usedNames = new Set();
    if (!classId) addOverviewSheet(workbook, report, usedNames);
    report.classes.forEach((reportClass, index) =>
        addMonthlyAttendanceSheet(workbook, reportClass, month, index, usedNames));

    const classLabel = classId
        ? (report.classes[0]?.name || 'class').replace(/[^a-z0-9]+/gi, '-').replace(/^-+|-+$/g, '') || 'class'
        : 'all-classes';
    const filename = `attendance_${classLabel}_${month}.xlsx`;
    const buffer = await workbook.xlsx.writeBuffer();
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(Buffer.from(buffer));
});

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

/*
 * Daily report — every class's homeroom register for one school day.
 *
 * The office's live view: which registers are in, who still owes one, and
 * the day's numbers. Rate convention matches the dashboard's "Attendance
 * today" card: present or late, out of the pupils marked.
 */

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const rate = (attended, marked) => (marked ? Number(((attended / marked) * 100).toFixed(1)) : null);
const emptyCounts = () => ({ marked: 0, present: 0, late: 0, absent: 0, excused: 0 });

const buildDailyReport = async (schoolId, date) => {
    const { data: year, error: yearError } = await supabase
        .from('academic_years')
        .select('id')
        .eq('school_id', schoolId)
        .eq('is_current', true)
        .maybeSingle();
    if (yearError) throw yearError;

    const [classesRes, pupils, rows, staffRes] = await Promise.all([
        supabase.from('classes').select('id, name').eq('school_id', schoolId).order('name'),
        selectAll('students', 'class_id', (q) => q.eq('school_id', schoolId).eq('is_active', true)),
        selectAll(
            'attendance',
            'class_id, status, marked_by, updated_at',
            (q) => q.eq('school_id', schoolId).eq('date', date).is('subject_id', null),
        ),
        year
            ? supabase.from('class_staff')
                .select('class_id, user:users(id, name)')
                .eq('school_id', schoolId)
                .eq('academic_year_id', year.id)
                .eq('position', 'main')
            : Promise.resolve({ data: [], error: null }),
    ]);
    if (classesRes.error) throw classesRes.error;
    if (staffRes.error) throw staffRes.error;

    const roster = new Map();
    for (const pupil of pupils) {
        if (pupil.class_id) roster.set(pupil.class_id, (roster.get(pupil.class_id) || 0) + 1);
    }

    const mainTeacher = new Map();
    for (const seat of staffRes.data || []) {
        if (seat.user?.name && !mainTeacher.has(seat.class_id)) mainTeacher.set(seat.class_id, seat.user.name);
    }

    const perClass = new Map();
    for (const row of rows) {
        const c = perClass.get(row.class_id) || { ...emptyCounts(), lastAt: null, lastBy: null };
        if (c[row.status] !== undefined) c[row.status] += 1;
        c.marked += 1;
        if (row.updated_at && (!c.lastAt || row.updated_at > c.lastAt)) {
            c.lastAt = row.updated_at;
            c.lastBy = row.marked_by;
        }
        perClass.set(row.class_id, c);
    }

    // Names of whoever saved each register last.
    const markerIds = [...new Set([...perClass.values()].map((c) => c.lastBy).filter(Boolean))];
    const markerName = new Map();
    if (markerIds.length) {
        const { data: markers, error } = await supabase.from('users').select('id, name').in('id', markerIds);
        if (error) throw error;
        for (const m of markers || []) markerName.set(m.id, m.name);
    }

    const totals = { classes: 0, taken: 0, notTaken: 0, partial: 0, roster: 0, ...emptyCounts() };
    const classes = (classesRes.data || []).map((klass) => {
        const c = perClass.get(klass.id) || { ...emptyCounts(), lastAt: null, lastBy: null };
        const size = roster.get(klass.id) || 0;
        const status = c.marked === 0 ? 'not_taken' : (c.marked < size ? 'partial' : 'taken');

        totals.classes += 1;
        totals.roster += size;
        if (status === 'not_taken') totals.notTaken += 1;
        else totals.taken += 1;
        if (status === 'partial') totals.partial += 1;
        for (const key of ['marked', 'present', 'late', 'absent', 'excused']) totals[key] += c[key];

        return {
            classId: klass.id,
            className: klass.name,
            mainTeacher: mainTeacher.get(klass.id) || null,
            status,
            roster: size,
            marked: c.marked,
            present: c.present,
            late: c.late,
            absent: c.absent,
            excused: c.excused,
            rate: rate(c.present + c.late, c.marked),
            lastSavedAt: c.lastAt,
            lastSavedBy: c.lastBy ? markerName.get(c.lastBy) || null : null,
        };
    });
    totals.rate = rate(totals.present + totals.late, totals.marked);

    const today = schoolTime.todayIso();
    return {
        date,
        today,
        isToday: date === today,
        timeZone: schoolTime.SCHOOL_TIME_ZONE,
        // When class teachers still owing a register are reminded (school time).
        reminderTime: reminderWindow().from,
        generatedAt: new Date().toISOString(),
        totals,
        classes,
    };
};

/*
 * Week report — every class's homeroom register for one school week
 * (Monday–Friday), with previous/next navigation and the term week number.
 *
 * Holidays on the calendar and days outside every term are closed days, not
 * missing registers; days after today are upcoming, and today's untaken
 * registers are pending (still open), so `missing` counts only school days
 * before today. "Expected" registers are open days so far × classes with pupils.
 */

const DAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'];
const mondayOf = (isoDate) => schoolTime.schoolWeek(isoDate)[0];

const buildWeekReport = async (schoolId, date) => {
    const today = schoolTime.todayIso();
    const dates = schoolTime.schoolWeek(date);
    const weekStart = dates[0];
    const weekEnd = dates[4];
    const currentWeekStart = mondayOf(today);

    const { data: year, error: yearError } = await supabase
        .from('academic_years')
        .select('id')
        .eq('school_id', schoolId)
        .eq('is_current', true)
        .maybeSingle();
    if (yearError) throw yearError;

    const [classesRes, pupils, rows, staffRes, termsRes, holidaysRes] = await Promise.all([
        supabase.from('classes').select('id, name').eq('school_id', schoolId).order('name'),
        selectAll('students', 'class_id', (q) => q.eq('school_id', schoolId).eq('is_active', true)),
        // A week of homeroom rows is ~2000 at this school: page past the cap.
        selectAll(
            'attendance',
            'class_id, date, status',
            (q) => q.eq('school_id', schoolId).in('date', dates).is('subject_id', null),
        ),
        year
            ? supabase.from('class_staff')
                .select('class_id, user:users(id, name)')
                .eq('school_id', schoolId)
                .eq('academic_year_id', year.id)
                .eq('position', 'main')
            : Promise.resolve({ data: [], error: null }),
        supabase.from('terms').select('name, starts_on, ends_on').eq('school_id', schoolId).order('starts_on'),
        supabase.from('calendar_events')
            .select('title, class_id, starts_on, ends_on')
            .eq('school_id', schoolId)
            .eq('category', 'holiday')
            .lte('starts_on', weekEnd)
            .gte('ends_on', weekStart),
    ]);
    for (const r of [classesRes, staffRes, termsRes, holidaysRes]) {
        if (r.error) throw r.error;
    }

    const terms = termsRes.data || [];
    const holidays = (holidaysRes.data || []).filter((h) => !h.class_id); // whole-school only
    const closedReason = (day) => {
        const holiday = holidays.find((h) => h.starts_on <= day && day <= h.ends_on);
        if (holiday) return holiday.title;
        if (terms.length && !terms.some((t) => t.starts_on <= day && day <= t.ends_on)) return 'No school';
        return null;
    };

    // Term weeks run Monday–Friday, counted from the week the term starts in.
    const term = terms.find((t) => t.starts_on <= weekEnd && t.ends_on >= weekStart) || null;
    const termWeek = term
        ? {
            name: term.name,
            weekNumber: Math.floor(schoolTime.daysBetween(mondayOf(term.starts_on), weekStart) / 7) + 1,
            weekCount: Math.floor(schoolTime.daysBetween(mondayOf(term.starts_on), mondayOf(term.ends_on)) / 7) + 1,
        }
        : null;

    const roster = new Map();
    for (const pupil of pupils) {
        if (pupil.class_id) roster.set(pupil.class_id, (roster.get(pupil.class_id) || 0) + 1);
    }
    const mainTeacher = new Map();
    for (const seat of staffRes.data || []) {
        if (seat.user?.name && !mainTeacher.has(seat.class_id)) mainTeacher.set(seat.class_id, seat.user.name);
    }
    const counts = new Map();
    for (const row of rows) {
        const key = `${row.class_id}|${row.date}`;
        const c = counts.get(key) || emptyCounts();
        if (c[row.status] !== undefined) c[row.status] += 1;
        c.marked += 1;
        counts.set(key, c);
    }

    const days = dates.map((day, i) => ({
        date: day,
        label: DAY_LABELS[i],
        isToday: day === today,
        isFuture: day > today,
        closed: closedReason(day),
        taken: 0,
        expected: 0,
    }));

    const totals = { expected: 0, taken: 0, missing: 0, openToday: 0, ...emptyCounts() };
    const classes = (classesRes.data || []).map((klass) => {
        const size = roster.get(klass.id) || 0;
        let taken = 0;
        let expected = 0;

        const cells = days.map((day) => {
            const open = !day.closed && !day.isFuture;
            if (open && size > 0) {
                expected += 1;
                day.expected += 1;
            }
            const c = counts.get(`${klass.id}|${day.date}`);
            if (c) {
                if (open) {
                    taken += 1;
                    day.taken += 1;
                }
                for (const key of ['marked', 'present', 'late', 'absent', 'excused']) totals[key] += c[key];
                return {
                    date: day.date,
                    status: c.marked < size ? 'partial' : 'taken',
                    ...c,
                    rate: rate(c.present + c.late, c.marked),
                };
            }
            let status = 'not_taken';
            if (day.isFuture) status = 'upcoming';
            else if (day.closed) status = 'closed';
            else if (size === 0) status = 'no_pupils';
            else if (day.isToday) status = 'pending';
            if (status === 'not_taken') totals.missing += 1;
            if (status === 'pending') totals.openToday += 1;
            return { date: day.date, status, ...emptyCounts(), rate: null };
        });

        totals.expected += expected;
        totals.taken += taken;
        return {
            classId: klass.id,
            className: klass.name,
            mainTeacher: mainTeacher.get(klass.id) || null,
            roster: size,
            taken,
            expected,
            days: cells,
        };
    });
    totals.rate = rate(totals.present + totals.late, totals.marked);

    return {
        weekStart,
        weekEnd,
        today,
        isCurrentWeek: weekStart === currentWeekStart,
        term: termWeek,
        previousWeek: schoolTime.addDays(weekStart, -7),
        nextWeek: weekStart < currentWeekStart ? schoolTime.addDays(weekStart, 7) : null,
        timeZone: schoolTime.SCHOOL_TIME_ZONE,
        generatedAt: new Date().toISOString(),
        days,
        classes,
        totals,
    };
};

/** GET /api/attendance/week?date=YYYY-MM-DD — admin; the school week containing `date` (default: this week). */
const getWeekReport = asyncHandler(async (req, res) => {
    const date = req.query.date || schoolTime.todayIso();
    if (!DATE_RE.test(date)) throw new BadRequestError('date must be YYYY-MM-DD');
    res.json(await buildWeekReport(req.user.school_id, date));
});

/** GET /api/attendance/daily?date=YYYY-MM-DD — admin; defaults to today (school time). */
const getDailyReport = asyncHandler(async (req, res) => {
    const date = req.query.date || schoolTime.todayIso();
    if (!DATE_RE.test(date)) throw new BadRequestError('date must be YYYY-MM-DD');
    res.json(await buildDailyReport(req.user.school_id, date));
});

module.exports = {
    markAttendance, getClassAttendance, getStudentAttendance, getAttendanceSummary,
    getMonthlySummary, getMonthlyGrid, submitMonth, returnMonth, listSubmissions, exportCsv, exportMonthlyXlsx,
    getDailyReport, buildDailyReport, getWeekReport, buildWeekReport,
};
