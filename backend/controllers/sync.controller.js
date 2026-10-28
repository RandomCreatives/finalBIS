const crypto = require('crypto');
const supabase = require('../config/supabase');
const { asyncHandler } = require('../utils/errors');

const PAGE_SIZE = 1000;

const isMissingOptionalTable = (error) =>
    error?.code === '42P01'
    || error?.code === 'PGRST205'
    || /does not exist|schema cache/i.test(error?.message || '');

async function selectAllForSchool(table, columns, schoolId, { optional = false } = {}) {
    const out = [];
    for (let from = 0; ; from += PAGE_SIZE) {
        const { data, error } = await supabase
            .from(table)
            .select(columns)
            .eq('school_id', schoolId)
            .range(from, from + PAGE_SIZE - 1);

        if (error) {
            if (optional && isMissingOptionalTable(error)) return [];
            throw error;
        }

        const batch = data || [];
        out.push(...batch);
        if (batch.length < PAGE_SIZE) break;
    }
    return out;
}

function digestRows(rows, serialize) {
    const hash = crypto.createHash('sha1');
    const sorted = [...(rows || [])].sort((a, b) =>
        String(a?.id || '').localeCompare(String(b?.id || ''))
    );
    hash.update(String(sorted.length));
    for (const row of sorted) {
        hash.update('\n');
        hash.update(serialize(row));
    }
    return hash.digest('hex').slice(0, 16);
}

/**
 * GET /api/sync/version
 *
 * Stateless, serverless-safe live-sync fingerprint derived directly from
 * school tables so open web portals, installed PWAs, and Telegram Mini Apps
 * detect roster, pending-request, staffing, and assessment changes immediately
 * regardless of which serverless instance handled the write.
 */
const getSyncVersion = asyncHandler(async (req, res) => {
    const schoolId = req.user.school_id;

    const [
        students,
        studentRequests,
        classes,
        classStaff,
        classSubjects,
        assessments,
        assessmentMarks,
        marksheets,
    ] = await Promise.all([
        selectAllForSchool(
            'students',
            'id, name, class_id, roll_num, is_active, special_needs, sen_teacher_name',
            schoolId,
        ),
        selectAllForSchool(
            'student_requests',
            'id, class_id, name, status',
            schoolId,
            { optional: true },
        ),
        selectAllForSchool('classes', 'id, name, capacity', schoolId),
        selectAllForSchool(
            'class_staff',
            'id, class_id, user_id, position, academic_year_id',
            schoolId,
            { optional: true },
        ),
        selectAllForSchool(
            'class_subjects',
            'id, class_id, subject_id, teacher_id, sessions_per_week, academic_year_id',
            schoolId,
            { optional: true },
        ),
        selectAllForSchool(
            'assessments',
            'id, class_id, subject_id, term_id, label, max_marks, sort_order, updated_at',
            schoolId,
            { optional: true },
        ),
        selectAllForSchool(
            'assessment_marks',
            'id, assessment_id, student_id, marks, updated_at',
            schoolId,
            { optional: true },
        ),
        selectAllForSchool(
            'marksheets',
            'id, student_id, subject_id, term_id, marks, max_marks, updated_at',
            schoolId,
            { optional: true },
        ),
    ]);

    const studentsDigest = digestRows(
        students,
        (s) => `${s.id}|${s.name || ''}|${s.class_id || ''}|${s.roll_num ?? ''}|${s.is_active !== false ? 1 : 0}|${s.special_needs ? 1 : 0}|${s.sen_teacher_name || ''}`,
    );
    const requestsDigest = digestRows(
        studentRequests,
        (r) => `${r.id}|${r.class_id || ''}|${r.name || ''}|${r.status || ''}`,
    );
    const studentsVersion = `${studentsDigest}-${requestsDigest}`;

    const classesDigest = digestRows(classes, (c) => `${c.id}|${c.name || ''}|${c.capacity ?? ''}`);
    const staffDigest = digestRows(
        classStaff,
        (s) => `${s.id}|${s.class_id || ''}|${s.user_id || ''}|${s.position || ''}|${s.academic_year_id || ''}`,
    );
    const subjectsDigest = digestRows(
        classSubjects,
        (a) => `${a.id}|${a.class_id || ''}|${a.subject_id || ''}|${a.teacher_id || ''}|${a.sessions_per_week ?? ''}|${a.academic_year_id || ''}`,
    );
    const assignmentsVersion = `${classesDigest}-${staffDigest}-${subjectsDigest}`;

    const assessmentsVersion = digestRows(
        assessments,
        (a) => `${a.id}|${a.class_id || ''}|${a.subject_id || ''}|${a.term_id || ''}|${a.label || ''}|${a.max_marks ?? ''}|${a.sort_order ?? ''}|${a.updated_at || ''}`,
    );
    const assessmentMarksVersion = digestRows(
        assessmentMarks,
        (m) => `${m.id}|${m.assessment_id || ''}|${m.student_id || ''}|${m.marks ?? ''}|${m.updated_at || ''}`,
    );
    const marksheetsVersion = digestRows(
        marksheets,
        (m) => `${m.id}|${m.student_id || ''}|${m.subject_id || ''}|${m.term_id || ''}|${m.marks ?? ''}|${m.max_marks ?? ''}|${m.updated_at || ''}`,
    );

    const version = `${studentsVersion}:${assignmentsVersion}:${assessmentsVersion}:${assessmentMarksVersion}:${marksheetsVersion}`;

    res.json({
        version,
        studentsVersion,
        assignmentsVersion,
        assessmentsVersion,
        assessmentMarksVersion,
        marksheetsVersion,
        serverTime: new Date().toISOString(),
    });
});

module.exports = { getSyncVersion };
