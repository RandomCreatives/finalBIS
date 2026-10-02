const supabase = require('../config/supabase');
const { NotFoundError, ConflictError, BadRequestError, ForbiddenError, asyncHandler } = require('../utils/errors');
const { resolveYearId } = require('./academicYear.controller');

const XLSX = require('xlsx');

const PHOTO_BUCKET = 'student-photos';

const SELECT = `
    id, admission_no, name, roll_num, date_of_birth, gender,
    guardian_name, guardian_phone, guardian_email,
    special_needs, special_needs_note, sen_teacher_name, is_active, class_id, photo_file_id,
    photo_storage_path, class:classes(id, name)
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
    senTeacherName: s.sen_teacher_name || null,
    isActive: s.is_active,
    classId: s.class_id,
    photoFileId: s.photo_file_id || null,
    photoStoragePath: s.photo_storage_path || null,
    class: s.class ? { id: s.class.id, name: s.class.name } : null,
});


const { teacherClassIds, assertClassAccess } = require('../utils/classAccess');
const { renumberClass, renumberClasses } = require('../utils/studentRolls');

const senTeacherNameFor = (specialNeeds, value) => {
    if (!specialNeeds) return null;
    const name = String(value || '').trim();
    if (!name) throw new BadRequestError('Assigned SEN Teacher is required when special needs is on');
    return name;
};

/** POST /api/students/:id/photo — compressed JPG to private Supabase Storage. */
const uploadStudentPhoto = asyncHandler(async (req, res) => {
    if (!req.file) throw new BadRequestError('No photo uploaded');
    if (req.file.mimetype !== 'image/jpeg') {
        throw new BadRequestError('Student photos must be compressed JPG images');
    }
    if (req.file.size > 512 * 1024) {
        throw new BadRequestError('Compressed student photo must be 512 KB or smaller');
    }

    const { data: student, error: studentError } = await supabase
        .from('students')
        .select('id, class_id')
        .eq('id', req.params.id)
        .eq('school_id', req.user.school_id)
        .maybeSingle();
    if (studentError) throw studentError;
    if (!student) throw new NotFoundError('Student not found');
    await assertClassAccess(req, student.class_id);

    const path = `${req.user.school_id}/${student.id}.jpg`;
    const { error: uploadError } = await supabase.storage
        .from(PHOTO_BUCKET)
        .upload(path, req.file.buffer, {
            contentType: 'image/jpeg',
            upsert: true,
            cacheControl: '3600',
        });
    if (uploadError) throw new BadRequestError(`Photo storage failed: ${uploadError.message}`);

    const { data: updated, error: updateError } = await supabase
        .from('students')
        .update({ photo_storage_path: path })
        .eq('id', student.id)
        .eq('school_id', req.user.school_id)
        .select(SELECT)
        .single();
    if (updateError) throw updateError;

    const { data: signed, error: signedError } = await supabase.storage
        .from(PHOTO_BUCKET)
        .createSignedUrl(path, 3600);
    if (signedError) throw signedError;

    res.json({ student: shape(updated), url: signed.signedUrl });
});

/** GET /api/students/:id/photo — short-lived private photo URL. */
const getStudentPhoto = asyncHandler(async (req, res) => {
    const { data: student, error } = await supabase
        .from('students')
        .select('id, class_id, photo_storage_path')
        .eq('id', req.params.id)
        .eq('school_id', req.user.school_id)
        .maybeSingle();
    if (error) throw error;
    if (!student) throw new NotFoundError('Student not found');
    await assertClassAccess(req, student.class_id);
    if (!student.photo_storage_path) return res.json({ url: null });

    const { data: signed, error: signedError } = await supabase.storage
        .from(PHOTO_BUCKET)
        .createSignedUrl(student.photo_storage_path, 3600);
    if (signedError) throw signedError;
    res.json({ url: signed.signedUrl });
});

/** GET /api/students?classId=&specialNeeds=&search= */
const listStudents = asyncHandler(async (req, res) => {
    const { classId, specialNeeds, search, includeInactive } = req.query;

    // Teachers only ever see students of classes they are attached to.
    if (req.user.role !== 'admin') {
        const myClasses = await teacherClassIds(req);
        if (classId) {
            if (!myClasses.includes(classId)) {
                throw new ForbiddenError('That class is not one of yours');
            }
        } else if (myClasses.length === 0) {
            return res.json({ students: [] });
        }
    }

    let query = supabase
        .from('students')
        .select(SELECT)
        .eq('school_id', req.user.school_id)
        .order('name');

    if (classId) {
        query = query.eq('class_id', classId);
    } else if (req.user.role !== 'admin') {
        const myClasses = await teacherClassIds(req);
        query = query.in('class_id', myClasses);
    }
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

    const { data: moving, error: movingError } = await supabase
        .from('students')
        .select('class_id')
        .eq('school_id', req.user.school_id)
        .in('id', studentIds);
    if (movingError) throw movingError;
    const oldClassIds = (moving || []).map((student) => student.class_id);

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

    await renumberClasses(req.user.school_id, [...oldClassIds, classId]);

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

    await assertClassAccess(req, data.class_id);

    res.json({ student: shape(data) });
});

/** POST /api/students */
const createStudent = asyncHandler(async (req, res) => {
    const {
        admissionNo, name, classId, dateOfBirth, gender,
        guardianName, guardianPhone, guardianEmail, specialNeeds, specialNeedsNote,
        senTeacherName,
    } = req.body;
    const normalizedSenTeacherName = senTeacherNameFor(Boolean(specialNeeds), senTeacherName);

    let { data, error } = await supabase
        .from('students')
        .insert({
            admission_no: admissionNo,
            name,
            roll_num: null,
            class_id: classId ?? null,
            date_of_birth: dateOfBirth ?? null,
            gender: gender ?? null,
            guardian_name: guardianName ?? null,
            guardian_phone: guardianPhone ?? null,
            guardian_email: guardianEmail ?? null,
            special_needs: Boolean(specialNeeds),
            special_needs_note: specialNeedsNote ?? null,
            sen_teacher_name: normalizedSenTeacherName,
            school_id: req.user.school_id,
        })
        .select(SELECT)
        .single();

    if (error?.code === '23505') {
        throw new ConflictError(`Admission number "${admissionNo}" is already in use`);
    }
    if (error) throw error;

    await renumberClass(req.user.school_id, classId);
    if (classId) {
        const refreshed = await supabase
            .from('students')
            .select(SELECT)
            .eq('id', data.id)
            .eq('school_id', req.user.school_id)
            .single();
        if (refreshed.error) throw refreshed.error;
        data = refreshed.data;
    }

    res.status(201).json({ student: shape(data) });
});

/** PATCH /api/students/:id */
const updateStudent = asyncHandler(async (req, res) => {
    const map = {
        admissionNo: 'admission_no',
        name: 'name',
        classId: 'class_id',
        dateOfBirth: 'date_of_birth',
        gender: 'gender',
        guardianName: 'guardian_name',
        guardianPhone: 'guardian_phone',
        guardianEmail: 'guardian_email',
        specialNeeds: 'special_needs',
        specialNeedsNote: 'special_needs_note',
        senTeacherName: 'sen_teacher_name',
        isActive: 'is_active',
        photoFileId: 'photo_file_id',
    };

    const patch = {};
    for (const [key, column] of Object.entries(map)) {
        if (req.body[key] !== undefined) patch[column] = req.body[key];
    }

    // Only admins move students between classes via patch — everyone else
    // uses the audited transfer endpoint.
    if (req.user.role !== 'admin') delete patch.class_id;
    if (patch.is_active === false && !['admin', 'main_teacher'].includes(req.user.role)) {
        throw new ForbiddenError('Only an admin or the class main teacher can deactivate a student');
    }

    if (patch.photo_file_id) {
        const { data: photo, error: photoError } = await supabase
            .from('file_records')
            .select('id')
            .eq('id', patch.photo_file_id)
            .eq('school_id', req.user.school_id)
            .eq('category', 'student')
            .maybeSingle();
        if (photoError) throw photoError;
        if (!photo) throw new BadRequestError('Student photo file not found in this school');
    }

    // Teachers may only edit students of their own classes.
    const { data: target, error: targetError } = await supabase
        .from('students')
        .select('id, class_id, roll_num, special_needs, sen_teacher_name')
        .eq('id', req.params.id)
        .eq('school_id', req.user.school_id)
        .maybeSingle();

    if (targetError) throw targetError;
    if (!target) throw new NotFoundError('Student not found');
    await assertClassAccess(req, target.class_id);

    const specialNeedsChanged = patch.special_needs !== undefined || patch.sen_teacher_name !== undefined;
    if (specialNeedsChanged) {
        const effectiveSpecialNeeds = patch.special_needs !== undefined
            ? Boolean(patch.special_needs)
            : Boolean(target.special_needs);
        if (patch.special_needs !== undefined) patch.special_needs = effectiveSpecialNeeds;
        patch.sen_teacher_name = effectiveSpecialNeeds
            ? senTeacherNameFor(true, patch.sen_teacher_name ?? target.sen_teacher_name)
            : null;
    }

    if ((patch.class_id !== undefined && patch.class_id !== target.class_id)
        || patch.is_active === false || patch.is_active === true) {
        patch.roll_num = null;
    }

    let { data, error } = await supabase
        .from('students')
        .update(patch)
        .eq('id', req.params.id)
        .eq('school_id', req.user.school_id)
        .select(SELECT)
        .maybeSingle();

    if (error?.code === '23505') throw new ConflictError('Admission number is already in use');
    if (error) throw error;
    if (!data) throw new NotFoundError('Student not found');

    await assertClassAccess(req, data.class_id);
    await renumberClasses(req.user.school_id, [target.class_id, data.class_id]);

    if (target.class_id || data.class_id) {
        const refreshed = await supabase
            .from('students')
            .select(SELECT)
            .eq('id', data.id)
            .eq('school_id', req.user.school_id)
            .single();
        if (refreshed.error) throw refreshed.error;
        data = refreshed.data;
    }

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

    // Teachers may only transfer students out of their own classes.
    const { data: source, error: sourceError } = await supabase
        .from('students')
        .select('id, class_id')
        .eq('id', req.params.id)
        .eq('school_id', req.user.school_id)
        .maybeSingle();

    if (sourceError) throw sourceError;
    if (!source) throw new NotFoundError('Student not found');
    await assertClassAccess(req, source.class_id);

    let { data, error } = await supabase.rpc('transfer_student', {
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

    await renumberClasses(req.user.school_id, [source.class_id, toClassId]);
    if (process.env.NODE_ENV !== 'test') {
        const refreshed = await supabase
            .from('students')
            .select(SELECT)
            .eq('id', req.params.id)
            .eq('school_id', req.user.school_id)
            .single();
        if (refreshed.error) throw refreshed.error;
        data = refreshed.data;
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
 * gender, guardianName, guardianPhone, guardianEmail, specialNeeds, specialNeedsNote,
 * senTeacherName. Optional: classId (UUID) — students without a class go to unassigned pool.
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
        roll_num: null,
        date_of_birth: row.dateOfBirth ? new Date(row.dateOfBirth).toISOString().split('T')[0] : null,
        gender: row.gender ? String(row.gender).toLowerCase() : null,
        guardian_name: row.guardianName ? String(row.guardianName).trim() : null,
        guardian_phone: row.guardianPhone ? String(row.guardianPhone).trim() : null,
        guardian_email: row.guardianEmail ? String(row.guardianEmail).trim() : null,
        special_needs: row.specialNeeds === true || String(row.specialNeeds).toLowerCase() === 'yes' || row.specialNeeds === 'TRUE',
        special_needs_note: row.specialNeedsNote ? String(row.specialNeedsNote).trim() : null,
        sen_teacher_name: row.senTeacherName ? String(row.senTeacherName).trim() : null,
        class_id: row.classId ? (typeof row.classId === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(row.classId) ? row.classId : null) : null,
        school_id: req.user.school_id,
    })).filter((s) => s.admission_no && s.name);

    if (studentsToInsert.length === 0) {
        throw new BadRequestError('No valid student rows found');
    }
    if (studentsToInsert.some((student) => student.special_needs && !student.sen_teacher_name)) {
        throw new BadRequestError('Every student with special needs must have a senTeacherName');
    }

    let { data, error } = await supabase
        .from('students')
        .insert(studentsToInsert)
        .select(SELECT);

    if (error) {
        if (error.code === '23505') {
            throw new ConflictError('One or more admission numbers already exist');
        }
        throw error;
    }

    await renumberClasses(req.user.school_id, studentsToInsert.map((student) => student.class_id));
    const importedIds = data.map((student) => student.id);
    if (importedIds.length > 0) {
        const refreshed = await supabase
            .from('students')
            .select(SELECT)
            .in('id', importedIds)
            .eq('school_id', req.user.school_id);
        if (refreshed.error) throw refreshed.error;
        data = refreshed.data;
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
    uploadStudentPhoto, getStudentPhoto,
};
