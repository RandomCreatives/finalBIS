const supabase = require('../config/supabase');
const { BadRequestError, NotFoundError, asyncHandler } = require('../utils/errors');

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

module.exports = { markAttendance, getClassAttendance, getStudentAttendance, getAttendanceSummary };
