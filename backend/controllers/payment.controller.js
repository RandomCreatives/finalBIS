const supabase = require('../config/supabase');
const { AppError, BadRequestError, ForbiddenError, NotFoundError, asyncHandler } = require('../utils/errors');

/*
 * Student fee payments — one status per student per term ('paid_term',
 * 'paid_annum'; no row = unpaid). Recording is done by the class's main
 * teacher (from the class student card) only when the admin switch is on;
 * admins can view everywhere and correct. Status-only by design — amounts
 * and receipts stay with the office paperwork.
 */

const WRITABLE_STATUSES = ['paid_term', 'paid_annum', 'unpaid'];
const missingSettingsTable = (error) =>
    error?.code === '42P01' || /school_settings.*does not exist/i.test(error?.message || '');

const readTeacherPaymentSetting = async (schoolId) => {
    const { data, error } = await supabase
        .from('school_settings')
        .select('teacher_payment_enabled')
        .eq('school_id', schoolId)
        .maybeSingle();
    if (error && missingSettingsTable(error)) return { enabled: false, migrationPending: true };
    if (error) throw error;
    return { enabled: Boolean(data?.teacher_payment_enabled), migrationPending: false };
};

const assertTeacherPaymentEnabled = async (req) => {
    if (req.user.role === 'admin') return;
    const setting = await readTeacherPaymentSetting(req.user.school_id);
    if (!setting.enabled) {
        throw new ForbiddenError('Teacher payment panel is disabled by the administrator');
    }
};

const shape = (row) => ({
    studentId: row.student_id,
    termId: row.term_id,
    status: row.status,
    markedBy: row.marker?.name || null,
    markedAt: row.marked_at,
});


/** GET /api/settings/teacher-payments — visible to signed-in staff. */
const getTeacherPaymentVisibility = asyncHandler(async (req, res) => {
    // Safe default: until migration 020 is pasted, teachers do not see or
    // manage payments. Admins can still use the office Students page.
    const setting = await readTeacherPaymentSetting(req.user.school_id);
    res.json({ teacherPaymentsEnabled: setting.enabled, migrationPending: setting.migrationPending });
});

/** PATCH /api/settings/teacher-payments — admin-only school-wide switch. */
const setTeacherPaymentVisibility = asyncHandler(async (req, res) => {
    const enabled = Boolean(req.body?.enabled);
    const { error: deleteError } = await supabase
        .from('school_settings')
        .delete()
        .eq('school_id', req.user.school_id);
    if (deleteError && missingSettingsTable(deleteError)) {
        throw new AppError('Payment visibility settings need migration 020 first', 503);
    }
    if (deleteError) throw deleteError;

    const { error: insertError } = await supabase
        .from('school_settings')
        .insert({
            school_id: req.user.school_id,
            teacher_payment_enabled: enabled,
            updated_by: req.user.id,
            updated_at: new Date().toISOString(),
        });
    if (insertError && missingSettingsTable(insertError)) {
        throw new AppError('Payment visibility settings need migration 020 first', 503);
    }
    if (insertError) throw insertError;
    res.json({ teacherPaymentsEnabled: enabled, migrationPending: false });
});

/**
 * GET /api/students/payments?termId=…[&classId=…] — status rows for a term,
 * optionally narrowed to one class. Any signed-in staff member may read;
 * writes are guarded separately.
 */
const listPayments = asyncHandler(async (req, res) => {
    const { termId, classId } = req.query;
    if (!termId) throw new BadRequestError('termId is required');
    await assertTeacherPaymentEnabled(req);

    let studentIds = null;
    if (classId) {
        const { data: students, error } = await supabase
            .from('students')
            .select('id')
            .eq('school_id', req.user.school_id)
            .eq('class_id', classId);
        if (error) throw error;
        studentIds = (students || []).map((s) => s.id);
    }

    let query = supabase
        .from('student_payments')
        .select('student_id, term_id, status, marked_at, marker:users!marked_by(name)')
        .eq('school_id', req.user.school_id)
        .eq('term_id', termId);
    if (studentIds) query = query.in('student_id', studentIds.length ? studentIds : ['00000000-0000-0000-0000-000000000000']);

    const { data, error } = await query;
    if (error) throw error;
    res.json({ payments: (data || []).map(shape) });
});

/**
 * PUT /api/students/:id/payment — record or correct a student's status for a
 * term. Body: { termId, status } where status is paid_term | paid_annum |
 * unpaid (unpaid clears the record). Callers: the class's main teacher or
 * an admin.
 */
const setPayment = asyncHandler(async (req, res) => {
    const { termId, status } = req.body || {};
    if (!termId) throw new BadRequestError('termId is required');
    if (!WRITABLE_STATUSES.includes(status))
        throw new BadRequestError(`status must be one of ${WRITABLE_STATUSES.join(', ')}`);
    await assertTeacherPaymentEnabled(req);

    const [{ data: student, error: sErr }, { data: term, error: tErr }] = await Promise.all([
        supabase.from('students').select('id, name, class_id')
            .eq('school_id', req.user.school_id).eq('id', req.params.id).maybeSingle(),
        supabase.from('terms').select('id, name, academic_year_id')
            .eq('school_id', req.user.school_id).eq('id', termId).maybeSingle(),
    ]);
    if (sErr) throw sErr;
    if (tErr) throw tErr;
    if (!student) throw new NotFoundError('Student not found');
    if (!term) throw new NotFoundError('Term not found');

    // Authorization: admins always; otherwise the main teacher of the
    // student's class (this academic year).
    if (req.user.role !== 'admin') {
        if (req.user.role !== 'main_teacher' || !student.class_id)
            throw new ForbiddenError('Only the class main teacher or an admin can record payments');
        const { data: staffRow } = await supabase
            .from('class_staff')
            .select('id')
            .eq('academic_year_id', term.academic_year_id)
            .eq('class_id', student.class_id)
            .eq('user_id', req.user.id)
            .eq('position', 'main')
            .maybeSingle();
        if (!staffRow)
            throw new ForbiddenError('Only the class main teacher or an admin can record payments');
    }

    if (status === 'unpaid') {
        const { error } = await supabase
            .from('student_payments').delete()
            .eq('school_id', req.user.school_id)
            .eq('student_id', student.id)
            .eq('term_id', termId);
        if (error) throw error;
        return res.json({ payment: { studentId: student.id, termId, status: 'unpaid', markedBy: null, markedAt: null } });
    }

    const now = new Date().toISOString();
    // delete+insert rather than upsert-on-conflict: deterministic both in
    // Postgres (unique(student_id, term_id)) and in the test harness.
    const { error: delErr } = await supabase
        .from('student_payments').delete()
        .eq('school_id', req.user.school_id)
        .eq('student_id', student.id)
        .eq('term_id', termId);
    if (delErr) throw delErr;

    const { error } = await supabase
        .from('student_payments')
        .insert({
            school_id: req.user.school_id,
            student_id: student.id,
            term_id: termId,
            status,
            marked_by: req.user.id,
            marked_at: now,
            updated_at: now,
        });
    if (error) throw error;

    const { data: row } = await supabase
        .from('student_payments')
        .select('student_id, term_id, status, marked_at, marker:users!marked_by(name)')
        .eq('school_id', req.user.school_id)
        .eq('student_id', student.id)
        .eq('term_id', termId)
        .maybeSingle();

    res.json({ payment: row ? shape(row) : { studentId: student.id, termId, status, markedBy: req.user.name, markedAt: now } });
});

module.exports = {
    listPayments, setPayment, getTeacherPaymentVisibility, setTeacherPaymentVisibility,
};
