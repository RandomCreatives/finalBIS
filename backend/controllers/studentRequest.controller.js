const crypto = require('crypto');
const supabase = require('../config/supabase');
const { notify, notifyAdmins } = require('../utils/nudges');
const {
    AppError, NotFoundError, ConflictError, BadRequestError, ForbiddenError, asyncHandler,
} = require('../utils/errors');
const { resolveYearId } = require('./academicYear.controller');

/*
 * Main-teacher student intake (Mike, 2026-09-23).
 *
 * A main teacher proposes a new student for their own class; the office
 * (admin) gets a bell nudge and approves or declines. Approving creates the
 * real student record with the next admission number (BIS2026-…) and the
 * next roll number in that class; the teacher is nudged either way.
 *
 * The student_requests table arrives with migration 019. Until it is pasted,
 * reads degrade to an empty list and writes answer with a clear 503 — the
 * rest of the app is untouched.
 */

const TABLE = 'student_requests';

const missingTable = (error) =>
    error?.code === '42P01' || /student_requests.*does not exist/i.test(error?.message || '');

const unavailable = () =>
    new AppError('New-student requests are being switched on — please try again in a few minutes', 503);

const slugFor = (className) =>
    String(className || '').toLowerCase().replace(/\s*-\s*/g, '-').replace(/\s+/g, '-');

const shape = (row, extras = {}) => ({
    id: row.id,
    classId: row.class_id,
    name: row.name,
    gender: row.gender,
    dateOfBirth: row.date_of_birth,
    guardianName: row.guardian_name,
    guardianPhone: row.guardian_phone,
    guardianEmail: row.guardian_email,
    specialNeeds: row.special_needs,
    specialNeedsNote: row.special_needs_note,
    status: row.status,
    reviewNote: row.review_note,
    studentId: row.student_id,
    createdAt: row.created_at,
    ...extras,
});

/** The one class this main teacher is the main teacher of, this year. */
const mainClassOf = async (req) => {
    const yearId = await resolveYearId(req);
    const { data, error } = await supabase
        .from('class_staff')
        .select('class_id, class:classes(name)')
        .eq('school_id', req.user.school_id)
        .eq('academic_year_id', yearId)
        .eq('position', 'main')
        .eq('user_id', req.user.id)
        .maybeSingle();

    if (error) throw error;
    if (!data) throw new ForbiddenError('Only a class\'s main teacher can request a new student');
    return { id: data.class_id, name: data.class?.name || 'your class', yearId };
};

/**
 * POST /api/student-requests — main teacher proposes a new student for their
 * class. Body: { name, gender?, dateOfBirth?, guardianName?, guardianPhone?,
 * guardianEmail?, specialNeeds?, specialNeedsNote? }.
 */
const submitRequest = asyncHandler(async (req, res) => {
    const klass = await mainClassOf(req);
    const name = String(req.body.name || '').trim().replace(/\s+/g, ' ');
    if (name.length < 2) throw new BadRequestError('The student\'s full name is required');

    // code-level duplicate guard (the partial unique index backs it up)
    const { data: dup, error: dupError } = await supabase
        .from(TABLE).select('id')
        .eq('school_id', req.user.school_id).eq('class_id', klass.id)
        .eq('status', 'pending').ilike('name', name).maybeSingle();
    if (dupError) { if (missingTable(dupError)) throw unavailable(); throw dupError; }
    if (dup) throw new ConflictError(`"${name}" already has a pending request for your class`);

    const row = {
        id: crypto.randomUUID(),
        school_id: req.user.school_id,
        academic_year_id: klass.yearId,
        class_id: klass.id,
        requested_by: req.user.id,
        name,
        gender: req.body.gender || null,
        date_of_birth: req.body.dateOfBirth || null,
        guardian_name: req.body.guardianName || null,
        guardian_phone: req.body.guardianPhone || null,
        guardian_email: req.body.guardianEmail || null,
        special_needs: Boolean(req.body.specialNeeds),
        special_needs_note: req.body.specialNeedsNote || null,
        status: 'pending',
    };

    const { error } = await supabase.from(TABLE).insert(row);
    if (error) {
        if (missingTable(error)) throw unavailable();
        if (error.code === '23505') throw new ConflictError(`"${name}" already has a pending request for your class`);
        throw error;
    }

    await notifyAdmins({
        schoolId: req.user.school_id,
        kind: 'student_request',
        title: 'New student request',
        body: `${req.user.name} wants to add ${name} to ${klass.name}.`,
        link: '/app/students',
        dedupeKey: `student_request:${row.id}`,
    });

    res.status(201).json({ request: shape(row, { className: klass.name }) });
});

/**
 * GET /api/student-requests?status=pending — admins see the whole school;
 * a main teacher sees only their own class. Degrades to an empty list until
 * migration 019 lands.
 */
const listRequests = asyncHandler(async (req, res) => {
    const status = ['pending', 'approved', 'rejected'].includes(req.query.status)
        ? req.query.status : 'pending';

    let classFilter = null;
    if (req.user.role !== 'admin') {
        const klass = await mainClassOf(req);
        classFilter = klass.id;
    }

    let query = supabase
        .from(TABLE)
        .select('id, class_id, requested_by, name, gender, date_of_birth, guardian_name, guardian_phone, guardian_email, special_needs, special_needs_note, status, review_note, student_id, created_at')
        .eq('school_id', req.user.school_id)
        .eq('status', status)
        .order('created_at', { ascending: false });
    if (classFilter) query = query.eq('class_id', classFilter);

    const { data, error } = await query;
    if (error) {
        if (missingTable(error)) return res.json({ requests: [] });
        throw error;
    }

    const [classesRes, usersRes] = await Promise.all([
        supabase.from('classes').select('id, name').eq('school_id', req.user.school_id),
        supabase.from('users').select('id, name').eq('school_id', req.user.school_id),
    ]);
    if (classesRes.error) throw classesRes.error;
    if (usersRes.error) throw usersRes.error;
    const className = new Map((classesRes.data || []).map((c) => [c.id, c.name]));
    const userName = new Map((usersRes.data || []).map((u) => [u.id, u.name]));

    res.json({
        requests: (data || []).map((row) => shape(row, {
            className: className.get(row.class_id) || null,
            requestedByName: userName.get(row.requested_by) || null,
        })),
    });
});

const pendingRequestOf = async (req) => {
    const { data, error } = await supabase
        .from(TABLE)
        .select('*')
        .eq('school_id', req.user.school_id)
        .eq('id', req.params.id)
        .maybeSingle();

    if (error) { if (missingTable(error)) throw unavailable(); throw error; }
    if (!data) throw new NotFoundError('That request was not found');
    if (data.status !== 'pending') throw new ConflictError('This request has already been reviewed');
    return data;
};

/** Next admission number — BIS2026-316 after BIS2026-315 (retry-safe). */
const nextAdmissionNo = async (req) => {
    const { data, error } = await supabase
        .from('students')
        .select('admission_no')
        .eq('school_id', req.user.school_id);
    if (error) throw error;
    let max = 0;
    for (const r of data || []) {
        const m = /^BIS2026-(\d+)$/.exec(r.admission_no || '');
        if (m) max = Math.max(max, Number(m[1]));
    }
    return `BIS2026-${String(max + 1).padStart(3, '0')}`;
};

/** Next roll number inside the class (1 when the class is empty). */
const nextRollNum = async (req, classId) => {
    const { data, error } = await supabase
        .from('students')
        .select('roll_num')
        .eq('school_id', req.user.school_id)
        .eq('class_id', classId)
        .order('roll_num', { ascending: false })
        .limit(1);
    if (error) throw error;
    return ((data && data[0] && data[0].roll_num) || 0) + 1;
};

const markReviewed = async (req, requestId, patch) => {
    const { data, error, count } = await supabase
        .from(TABLE)
        .update({ ...patch, reviewed_by: req.user.id, reviewed_at: new Date().toISOString(), updated_at: new Date().toISOString() }, { count: 'exact' })
        .eq('id', requestId).eq('status', 'pending');
    if (error) { if (missingTable(error)) throw unavailable(); throw error; }
    if (count === 0) throw new ConflictError('This request has already been reviewed');
    return data;
};

/** PATCH /api/student-requests/:id/approve — admin only. Creates the student. */
const approveRequest = asyncHandler(async (req, res) => {
    const request = await pendingRequestOf(req);

    let student = null;
    for (let attempt = 0; attempt < 3 && !student; attempt += 1) {
        const candidate = {
            id: crypto.randomUUID(),
            school_id: req.user.school_id,
            class_id: request.class_id,
            admission_no: await nextAdmissionNo(req),
            name: request.name,
            roll_num: await nextRollNum(req, request.class_id),
            date_of_birth: request.date_of_birth,
            gender: request.gender,
            guardian_name: request.guardian_name,
            guardian_phone: request.guardian_phone,
            guardian_email: request.guardian_email,
            special_needs: request.special_needs,
            special_needs_note: request.special_needs_note,
            is_active: true,
        };
        const { error } = await supabase.from('students').insert(candidate);
        if (error && error.code === '23505' && /admission/i.test(error.message || '')) continue;
        if (error) throw error;
        student = { id: candidate.id, admission_no: candidate.admission_no, roll_num: candidate.roll_num };
    }
    if (!student) throw new ConflictError('Could not allocate an admission number — try again');

    await markReviewed(req, request.id, { status: 'approved', student_id: student.id });

    const { data: klass } = await supabase
        .from('classes').select('name').eq('id', request.class_id).maybeSingle();
    const className = klass?.name || 'the class';

    await notify({
        schoolId: req.user.school_id,
        userIds: [request.requested_by],
        kind: 'student_request',
        title: 'Student added ✓',
        body: `${request.name} joined ${className} — roll ${student.roll_num}, ${student.admission_no}.`,
        link: `/class-home/${slugFor(className)}`,
        dedupeKey: `student_request_review:${request.id}`,
    });

    res.json({
        request: shape({ ...request, status: 'approved', student_id: student.id }, { className }),
        student: { id: student.id, admissionNo: student.admission_no, rollNum: student.roll_num, name: request.name },
    });
});

/** PATCH /api/student-requests/:id/reject — admin only. Body: { note? }. */
const rejectRequest = asyncHandler(async (req, res) => {
    const request = await pendingRequestOf(req);
    const note = String(req.body.note || '').trim();

    await markReviewed(req, request.id, { status: 'rejected', review_note: note || null });

    const { data: klass } = await supabase
        .from('classes').select('name').eq('id', request.class_id).maybeSingle();
    const className = klass?.name || 'the class';

    await notify({
        schoolId: req.user.school_id,
        userIds: [request.requested_by],
        kind: 'student_request',
        title: 'Student request declined',
        body: note
            ? `${request.name} (${className}) was not added: ${note}`
            : `${request.name} (${className}) was not added.`,
        link: `/class-home/${slugFor(className)}`,
        dedupeKey: `student_request_review:${request.id}`,
    });

    res.json({ request: shape({ ...request, status: 'rejected', review_note: note || null }, { className }) });
});

module.exports = { submitRequest, listRequests, approveRequest, rejectRequest };
