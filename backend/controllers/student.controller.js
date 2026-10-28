const crypto = require('crypto');
const supabase = require('../config/supabase');
const { NotFoundError, ConflictError, BadRequestError, ForbiddenError, asyncHandler } = require('../utils/errors');
const { notifyClassTeachers } = require('../utils/nudges');
const { teacherClassIds, assertClassAccess } = require('../utils/classAccess');
const {
    normalizeStudentName,
    sortStudentsCanonically,
    renumberClass,
    renumberClasses,
} = require('../utils/studentRolls');

const XLSX = require('xlsx');

const PAGE_SIZE = 1000;

const SELECT = `
    id, admission_no, name, roll_num, date_of_birth, gender,
    guardian_name, guardian_phone, guardian_email,
    special_needs, special_needs_note, sen_teacher_name, is_active, class_id,
    class:classes(id, name)
`;

const shape = (s) => ({
    id: s.id,
    admissionNo: normalizeStudentName(s.admission_no) || s.admission_no,
    name: normalizeStudentName(s.name),
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
    class: s.class ? { id: s.class.id, name: s.class.name } : null,
});

const senTeacherNameFor = (specialNeeds, value) => {
    if (!specialNeeds) return null;
    const name = String(value || '').trim();
    if (!name) throw new BadRequestError('Assigned SEN Teacher is required when special needs is on');
    return name;
};

/** GET /api/students?classId=&specialNeeds=&search= */
const listStudents = asyncHandler(async (req, res) => {
    const { classId, specialNeeds, search, includeInactive } = req.query;

    let myClasses = null;
    // Teachers only ever see students of classes they are attached to.
    if (req.user.role !== 'admin') {
        myClasses = await teacherClassIds(req);
        if (classId) {
            if (!myClasses.includes(classId)) {
                throw new ForbiddenError('That class is not one of yours');
            }
        } else if (myClasses.length === 0) {
            return res.json({ students: [] });
        }
    }

    const allRows = [];
    for (let from = 0; ; from += PAGE_SIZE) {
        let query = supabase
            .from('students')
            .select(SELECT)
            .eq('school_id', req.user.school_id)
            .order('name')
            .range(from, from + PAGE_SIZE - 1);

        if (classId) {
            query = query.eq('class_id', classId);
        } else if (req.user.role !== 'admin') {
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
        const batch = data || [];
        allRows.push(...batch);
        if (batch.length < PAGE_SIZE) break;
    }

    const sorted = sortStudentsCanonically(allRows).map(shape);
    res.json({ students: sorted });
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
    res.json({ students: sortStudentsCanonically(data || []).map(shape) });
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
        .select('id, name, class_id')
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

    const totalChanged = (Number(data?.placed) || 0) + (Number(data?.moved) || 0);
    if (totalChanged > 0 && classId) {
        const namesPreview = (moving || [])
            .map((s) => normalizeStudentName(s.name))
            .filter(Boolean)
            .slice(0, 3)
            .join(', ');
        const eventKey = `roster_assign:${classId}:${crypto.randomUUID()}`;
        await notifyClassTeachers({
            schoolId: req.user.school_id,
            classId,
            excludeUserIds: [req.user.id],
            kind: 'roster_update',
            title: 'Class list updated',
            body: namesPreview
                ? `${totalChanged} student(s) placed in your class (${namesPreview}${moving.length > 3 ? ', …' : ''}).`
                : `${totalChanged} student(s) placed in your class.`,
            dedupeKey: eventKey,
        });

        const uniqueOldClasses = [...new Set(oldClassIds.filter((cid) => cid && cid !== classId))];
        for (const oldClassId of uniqueOldClasses) {
            await notifyClassTeachers({
                schoolId: req.user.school_id,
                classId: oldClassId,
                excludeUserIds: [req.user.id],
                kind: 'roster_update',
                title: 'Class list updated',
                body: 'One or more students moved to another class.',
                dedupeKey: `roster_assign_out:${oldClassId}:${crypto.randomUUID()}`,
            });
        }
    }

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
    const normalizedName = normalizeStudentName(name);
    const normalizedAdmissionNo = String(admissionNo || '').trim();
    const normalizedSenTeacherName = senTeacherNameFor(Boolean(specialNeeds), senTeacherName);

    if (classId) {
        await assertClassAccess(req, classId);
    } else if (req.user.role !== 'admin') {
        throw new ForbiddenError('Only an admin can create an unassigned student');
    }

    let { data, error } = await supabase
        .from('students')
        .insert({
            admission_no: normalizedAdmissionNo,
            name: normalizedName,
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
        throw new ConflictError(`Admission number "${normalizedAdmissionNo}" is already in use`);
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

        const className = data.class?.name || 'your class';
        await notifyClassTeachers({
            schoolId: req.user.school_id,
            classId,
            className: data.class?.name || null,
            excludeUserIds: [req.user.id],
            kind: 'roster_update',
            title: 'New student added',
            body: `${normalizedName} joined ${className}${data.roll_num ? ` — roll ${data.roll_num}` : ''}${normalizedAdmissionNo ? `, ${normalizedAdmissionNo}` : ''}.`,
            dedupeKey: `student_created:${data.id}`,
        });
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
    };

    const patch = {};
    for (const [key, column] of Object.entries(map)) {
        if (req.body[key] !== undefined) patch[column] = req.body[key];
    }
    if (patch.name !== undefined) {
        patch.name = normalizeStudentName(patch.name);
        if (!patch.name) throw new BadRequestError('Student name cannot be empty');
    }
    if (patch.admission_no !== undefined) {
        patch.admission_no = String(patch.admission_no || '').trim();
    }

    // Only admins move students between classes via patch — everyone else
    // uses the audited transfer endpoint.
    if (req.user.role !== 'admin') delete patch.class_id;
    if (patch.is_active === false && !['admin', 'main_teacher'].includes(req.user.role)) {
        throw new ForbiddenError('Only an admin or the class main teacher can deactivate a student');
    }

    // Teachers may only edit students of their own classes.
    const { data: target, error: targetError } = await supabase
        .from('students')
        .select('id, name, is_active, class_id, roll_num, special_needs, sen_teacher_name')
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

    const oldNormalizedName = normalizeStudentName(target.name);
    const nameChanged = patch.name !== undefined && patch.name !== oldNormalizedName;
    const classChanged = patch.class_id !== undefined && patch.class_id !== target.class_id;
    const activeChanged = patch.is_active !== undefined && Boolean(patch.is_active) !== Boolean(target.is_active);

    if (classChanged || activeChanged) {
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

    // Notify affected class teachers when a student's name, active status, or class changes.
    const updatedName = normalizeStudentName(data.name);
    const className = data.class?.name || 'the class';
    if (activeChanged && data.is_active === false && target.class_id) {
        await notifyClassTeachers({
            schoolId: req.user.school_id,
            classId: target.class_id,
            excludeUserIds: [req.user.id],
            kind: 'roster_update',
            title: 'Student removed from active list',
            body: `${updatedName} was deactivated in ${className}.`,
            dedupeKey: `student_deactivated:${data.id}:${crypto.randomUUID()}`,
        });
    } else if (activeChanged && data.is_active === true && data.class_id) {
        await notifyClassTeachers({
            schoolId: req.user.school_id,
            classId: data.class_id,
            className: data.class?.name || null,
            excludeUserIds: [req.user.id],
            kind: 'roster_update',
            title: 'Student restored to class list',
            body: `${updatedName} is active again in ${className}${data.roll_num ? ` (roll ${data.roll_num})` : ''}.`,
            dedupeKey: `student_reactivated:${data.id}:${crypto.randomUUID()}`,
        });
    } else if (classChanged) {
        if (target.class_id) {
            await notifyClassTeachers({
                schoolId: req.user.school_id,
                classId: target.class_id,
                excludeUserIds: [req.user.id],
                kind: 'roster_update',
                title: 'Student moved class',
                body: `${updatedName} moved to ${className}.`,
                dedupeKey: `student_moved_out:${data.id}:${crypto.randomUUID()}`,
            });
        }
        if (data.class_id) {
            await notifyClassTeachers({
                schoolId: req.user.school_id,
                classId: data.class_id,
                className: data.class?.name || null,
                excludeUserIds: [req.user.id],
                kind: 'roster_update',
                title: 'New student in class',
                body: `${updatedName} joined ${className}${data.roll_num ? ` (roll ${data.roll_num})` : ''}.`,
                dedupeKey: `student_moved_in:${data.id}:${crypto.randomUUID()}`,
            });
        }
    } else if (nameChanged && data.class_id) {
        await notifyClassTeachers({
            schoolId: req.user.school_id,
            classId: data.class_id,
            className: data.class?.name || null,
            excludeUserIds: [req.user.id],
            kind: 'roster_update',
            title: 'Student name updated',
            body: `"${oldNormalizedName}" was updated to "${updatedName}" in ${className}.`,
            dedupeKey: `student_renamed:${data.id}:${crypto.randomUUID()}`,
        });
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
        .select('id, name, class_id, class:classes(id, name)')
        .eq('id', req.params.id)
        .eq('school_id', req.user.school_id)
        .maybeSingle();

    if (sourceError) throw sourceError;
    if (!source) throw new NotFoundError('Student not found');
    await assertClassAccess(req, source.class_id);

    // An idempotent retry should not create another transfer row or duplicate
    // the student in the destination class.
    if (source.class_id === toClassId) {
        const current = await supabase
            .from('students')
            .select(SELECT)
            .eq('id', source.id)
            .eq('school_id', req.user.school_id)
            .single();
        if (current.error) throw current.error;
        return res.json({ message: 'Student is already in that class', student: shape(current.data) });
    }

    const sourceName = normalizeStudentName(source.name);

    // A same-name student may be a different child. Do not merge or create a
    // second-looking roster entry automatically; warn the user instead.
    const { data: sameName, error: sameNameError } = await supabase
        .from('students')
        .select('id, name, admission_no')
        .eq('school_id', req.user.school_id)
        .eq('class_id', toClassId)
        .eq('is_active', true)
        .ilike('name', sourceName)
        .limit(1)
        .maybeSingle();
    if (sameNameError) throw sameNameError;
    if (sameName && sameName.id !== source.id) {
        throw new ConflictError(
            `${sameName.name} is already in the destination class (${sameName.admission_no}). Check the Student ID before transferring.`
        );
    }

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

    const toClassName = data?.class?.name || 'another class';
    const fromClassName = source.class?.name || 'their previous class';
    const transferKey = crypto.randomUUID();
    if (source.class_id) {
        await notifyClassTeachers({
            schoolId: req.user.school_id,
            classId: source.class_id,
            className: source.class?.name || null,
            excludeUserIds: [req.user.id],
            kind: 'roster_update',
            title: 'Student transferred out',
            body: `${sourceName} transferred from ${fromClassName} to ${toClassName}.`,
            dedupeKey: `student_transfer_out:${source.id}:${transferKey}`,
        });
    }
    if (toClassId) {
        await notifyClassTeachers({
            schoolId: req.user.school_id,
            classId: toClassId,
            className: data?.class?.name || null,
            excludeUserIds: [req.user.id],
            kind: 'roster_update',
            title: 'Student transferred in',
            body: `${sourceName} transferred into ${toClassName}${data?.roll_num ? ` — roll ${data.roll_num}` : ''}.`,
            dedupeKey: `student_transfer_in:${source.id}:${transferKey}`,
        });
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
        name: normalizeStudentName(row.name),
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

    const affectedClassIds = [...new Set(studentsToInsert.map((student) => student.class_id).filter(Boolean))];
    await renumberClasses(req.user.school_id, affectedClassIds);
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

    for (const cid of affectedClassIds) {
        const inClass = (data || []).filter((s) => s.class_id === cid);
        if (inClass.length > 0) {
            await notifyClassTeachers({
                schoolId: req.user.school_id,
                classId: cid,
                className: inClass[0]?.class?.name || null,
                excludeUserIds: [req.user.id],
                kind: 'roster_update',
                title: 'Class list updated',
                body: `${inClass.length} new student(s) imported into ${inClass[0]?.class?.name || 'your class'}.`,
                dedupeKey: `students_imported:${cid}:${crypto.randomUUID()}`,
            });
        }
    }

    res.status(201).json({
        message: `${data.length} students imported successfully`,
        imported: data.length,
        students: sortStudentsCanonically(data).map(shape),
    });
});

module.exports = {
    listStudents, listUnassigned, assignStudents, getStudent, createStudent,
    updateStudent, transferStudent, getTransferHistory, importStudents,
};
