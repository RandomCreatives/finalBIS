const supabase = require('../config/supabase');
const { NotFoundError, ConflictError, BadRequestError, asyncHandler } = require('../utils/errors');

const XLSX = require('xlsx');

const SELECT = `
    id, admission_no, name, roll_num, date_of_birth, gender,
    guardian_name, guardian_phone, guardian_email,
    special_needs, special_needs_note, is_active, class_id,
    class:classes(id, name)
`;

const shape = (s) => ({
    id: s.id,
    admissionNo: s.admission_no,
    name: s.name,
    rollNum: s.roll_num,
    dateOfBirth: s.date_of_birth,
    gender: s.gender,
    guardianName: s.guardian_name,
    guardianPhone: s.guardian_phone,
    guardianEmail: s.guardian_email,
    specialNeeds: s.special_needs,
    specialNeedsNote: s.special_needs_note,
    isActive: s.is_active,
    classId: s.class_id,
    class: s.class ? { id: s.class.id, name: s.class.name } : null,
});

/** GET /api/students?classId=&specialNeeds=&search= */
const listStudents = asyncHandler(async (req, res) => {
    const { classId, specialNeeds, search, includeInactive } = req.query;

    let query = supabase
        .from('students')
        .select(SELECT)
        .eq('school_id', req.user.school_id)
        .order('name');

    if (classId) query = query.eq('class_id', classId);
    if (specialNeeds === 'true') query = query.eq('special_needs', true);
    if (includeInactive !== 'true') query = query.eq('is_active', true);
    if (search) {
        const safe = search.replace(/[%_\\]/g, '\\$&');
        query = query.or(`name.ilike.%${safe}%,admission_no.ilike.%${safe}%`);
    }

    const { data, error } = await query;
    if (error) throw error;

    res.json({ students: data.map(shape) });
});

/**
 * GET /api/students/unassigned
 * Active students with no class — the queue an admin needs to clear.
 */
const listUnassigned = asyncHandler(async (req, res) => {
    const { data, error } = await supabase
        .from('students')
        .select(SELECT)
        .eq('school_id', req.user.school_id)
        .eq('is_active', true)
        .is('class_id', null)
        .order('name');

    if (error) throw error;
    res.json({ students: data.map(shape) });
});

/**
 * POST /api/students/assign
 *
 * Places several students into a class at once. Capacity is checked and any
 * student moved out of another class gets a transfer record — all inside one
 * DB transaction so a partial placement cannot happen.
 */
const assignStudents = asyncHandler(async (req, res) => {
    const { studentIds, classId, reason } = req.body;

    const { data, error } = await supabase.rpc('assign_students_to_class', {
        p_student_ids: studentIds,
        p_class_id: classId,
        p_actor_id: req.user.id,
        p_school_id: req.user.school_id,
        p_reason: reason ?? null,
    });

    if (error) {
        if (error.message?.includes('CLASS_NOT_FOUND')) throw new NotFoundError('Class not found');
        if (error.message?.includes('OVER_CAPACITY')) {
            throw new ConflictError(
                error.message.replace(/^.*OVER_CAPACITY:\s*/, 'Class is over capacity — ')
            );
        }
        throw error;
    }

    const parts = [];
    if (data.placed) parts.push(`${data.placed} placed`);
    if (data.moved) parts.push(`${data.moved} moved from another class`);

    res.json({
        message: parts.length ? parts.join(', ') : 'No changes were needed',
        result: data,
    });
});

/** GET /api/students/:id */
const getStudent = asyncHandler(async (req, res) => {
    const { data, error } = await supabase
        .from('students')
        .select(SELECT)
        .eq('id', req.params.id)
        .eq('school_id', req.user.school_id)
        .maybeSingle();

    if (error) throw error;
    if (!data) throw new NotFoundError('Student not found');

    res.json({ student: shape(data) });
});

/** POST /api/students */
const createStudent = asyncHandler(async (req, res) => {
    const {
        admissionNo, name, rollNum, classId, dateOfBirth, gender,
        guardianName, guardianPhone, guardianEmail, specialNeeds, specialNeedsNote,
    } = req.body;

    const { data, error } = await supabase
        .from('students')
        .insert({
            admission_no: admissionNo,
            name,
            roll_num: rollNum ?? null,
            class_id: classId ?? null,
            date_of_birth: dateOfBirth ?? null,
            gender: gender ?? null,
            guardian_name: guardianName ?? null,
            guardian_phone: guardianPhone ?? null,
            guardian_email: guardianEmail ?? null,
            special_needs: specialNeeds ?? false,
            special_needs_note: specialNeedsNote ?? null,
            school_id: req.user.school_id,
        })
        .select(SELECT)
        .single();

    if (error?.code === '23505') {
        throw new ConflictError(`Admission number "${admissionNo}" is already in use`);
    }
    if (error) throw error;

    res.status(201).json({ student: shape(data) });
});

/** PATCH /api/students/:id */
const updateStudent = asyncHandler(async (req, res) => {
    const map = {
        admissionNo: 'admission_no',
        name: 'name',
        rollNum: 'roll_num',
        classId: 'class_id',
        dateOfBirth: 'date_of_birth',
        gender: 'gender',
        guardianName: 'guardian_name',
        guardianPhone: 'guardian_phone',
        guardianEmail: 'guardian_email',
        specialNeeds: 'special_needs',
        specialNeedsNote: 'special_needs_note',
        isActive: 'is_active',
    };

    const patch = {};
    for (const [key, column] of Object.entries(map)) {
        if (req.body[key] !== undefined) patch[column] = req.body[key];
    }

    const { data, error } = await supabase
        .from('students')
        .update(patch)
        .eq('id', req.params.id)
        .eq('school_id', req.user.school_id)
        .select(SELECT)
        .maybeSingle();

    if (error?.code === '23505') throw new ConflictError('Admission number is already in use');
    if (error) throw error;
    if (!data) throw new NotFoundError('Student not found');

    res.json({ student: shape(data) });
});

/**
 * POST /api/students/:id/transfer
 *
 * Moves a student to another class and records the move. Runs through a
 * single Postgres function so the class change and the audit row either
 * both commit or both roll back — the previous version issued five
 * sequential unguarded writes.
 *
 * Attendance, marksheet, library and clinic rows intentionally keep their
 * original class_id: they are historical facts about where the student was
 * at the time, and rewriting them corrupts past reports.
 */
const transferStudent = asyncHandler(async (req, res) => {
    const { toClassId, reason } = req.body;

    const { data, error } = await supabase.rpc('transfer_student', {
        p_student_id: req.params.id,
        p_to_class_id: toClassId,
        p_reason: reason ?? null,
        p_actor_id: req.user.id,
        p_school_id: req.user.school_id,
    });

    if (error) {
        if (error.message?.includes('STUDENT_NOT_FOUND')) throw new NotFoundError('Student not found');
        if (error.message?.includes('CLASS_NOT_FOUND')) throw new NotFoundError('Target class not found');
        if (error.message?.includes('SAME_CLASS')) throw new ConflictError('Student is already in that class');
        throw error;
    }

    res.json({ message: 'Student transferred', student: shape(data) });
});

/** GET /api/students/:id/transfers */
const getTransferHistory = asyncHandler(async (req, res) => {
    const { data, error } = await supabase
        .from('student_transfers')
        .select('id, reason, created_at, from_class:classes!from_class_id(id, name), to_class:classes!to_class_id(id, name), actor:users(id, name)')
        .eq('student_id', req.params.id)
        .order('created_at', { ascending: false });

    if (error) throw error;

    res.json({
        transfers: data.map((t) => ({
            id: t.id,
            reason: t.reason,
            at: t.created_at,
            from: t.from_class,
            to: t.to_class,
            by: t.actor,
        })),
    });
});

/**
 * POST /api/students/import
 *
 * Accepts an Excel file with columns: admissionNo, name, rollNum, dateOfBirth,
 * gender, guardianName, guardianPhone, guardianEmail, specialNeeds, specialNeedsNote
 * Optional: classId (UUID) — students without a class go to unassigned pool.
 */
const importStudents = asyncHandler(async (req, res) => {
    if (!req.file) {
        throw new BadRequestError('No file uploaded');
    }

    const workbook = XLSX.read(req.file.buffer, { type: 'buffer' });
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    const rows = XLSX.utils.sheet_to_json(worksheet);

    if (!rows || rows.length === 0) {
        throw new BadRequestError('Excel file contains no data');
    }

    // Required columns
    const requiredCols = ['admissionNo', 'name'];
    const firstRow = rows[0];
    const missingCols = requiredCols.filter((c) => !(c in firstRow));
    if (missingCols.length > 0) {
        throw new BadRequestError(`Missing required columns: ${missingCols.join(', ')}`);
    }

    const studentsToInsert = rows.map((row) => ({
        admission_no: String(row.admissionNo || '').trim(),
        name: String(row.name || '').trim(),
        roll_num: row.rollNum ? Number(row.rollNum) : null,
        date_of_birth: row.dateOfBirth ? new Date(row.dateOfBirth).toISOString().split('T')[0] : null,
        gender: row.gender ? String(row.gender).toLowerCase() : null,
        guardian_name: row.guardianName ? String(row.guardianName).trim() : null,
        guardian_phone: row.guardianPhone ? String(row.guardianPhone).trim() : null,
        guardian_email: row.guardianEmail ? String(row.guardianEmail).trim() : null,
        special_needs: row.specialNeeds === true || String(row.specialNeeds).toLowerCase() === 'yes' || row.specialNeeds === 'TRUE',
        special_needs_note: row.specialNeedsNote ? String(row.specialNeedsNote).trim() : null,
        class_id: row.classId ? (typeof row.classId === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(row.classId) ? row.classId : null) : null,
        school_id: req.user.school_id,
    })).filter((s) => s.admission_no && s.name);

    if (studentsToInsert.length === 0) {
        throw new BadRequestError('No valid student rows found');
    }

    const { data, error } = await supabase
        .from('students')
        .insert(studentsToInsert)
        .select(SELECT);

    if (error) {
        if (error.code === '23505') {
            throw new ConflictError('One or more admission numbers already exist');
        }
        throw error;
    }

    res.status(201).json({
        message: `${data.length} students imported successfully`,
        imported: data.length,
        students: data.map(shape),
    });
});

module.exports = {
    listStudents, listUnassigned, assignStudents, getStudent, createStudent,
    updateStudent, transferStudent, getTransferHistory, importStudents,
};
