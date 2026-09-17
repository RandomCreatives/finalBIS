const supabase = require('../config/supabase');
const { ForbiddenError } = require('./errors');
const { resolveYearId } = require('../controllers/academicYear.controller');

/*
 * Shared class-access rules for teacher-scoped endpoints (students,
 * attendance, marksheets).
 *
 * Admins reach everything. Everyone else must be attached to the class in
 * the current academic year — either a seat in class_staff (main/assistant)
 * or a teaching assignment in class_subjects.
 */

/** Class ids the user is attached to this year (staff seat or assignment). */
const teacherClassIds = async (req) => {
    const yearId = await resolveYearId(req);
    const [staffRes, subjRes] = await Promise.all([
        supabase.from('class_staff')
            .select('class_id')
            .eq('academic_year_id', yearId)
            .eq('user_id', req.user.id),
        supabase.from('class_subjects')
            .select('class_id')
            .eq('academic_year_id', yearId)
            .eq('teacher_id', req.user.id),
    ]);
    if (staffRes.error) throw staffRes.error;
    if (subjRes.error) throw subjRes.error;

    return [...new Set([
        ...(staffRes.data || []).map((r) => r.class_id),
        ...(subjRes.data || []).map((r) => r.class_id),
    ])];
};

/** Throws unless the user may access the given class. */
const assertClassAccess = async (req, classId) => {
    if (req.user.role === 'admin') return;
    if (!classId) throw new ForbiddenError('Student has no class');

    const ids = await teacherClassIds(req);
    if (!ids.includes(classId)) {
        throw new ForbiddenError('That class is not one of yours');
    }
};

/**
 * Marks-level rule: a class's main teacher may record any subject of the
 * class; anyone else must hold the (class, subject) assignment.
 */
const assertCanRecordMarks = async (req, classId, subjectId) => {
    if (req.user.role === 'admin') return;

    const yearId = await resolveYearId(req);

    const seatRes = await supabase.from('class_staff')
        .select('id')
        .eq('academic_year_id', yearId)
        .eq('class_id', classId)
        .eq('user_id', req.user.id)
        .eq('position', 'main');

    if (seatRes.error) throw seatRes.error;
    if ((seatRes.data || []).length > 0) return; // main teacher: any subject

    const asgRes = await supabase.from('class_subjects')
        .select('id')
        .eq('academic_year_id', yearId)
        .eq('class_id', classId)
        .eq('subject_id', subjectId)
        .eq('teacher_id', req.user.id);

    if (asgRes.error) throw asgRes.error;
    if ((asgRes.data || []).length === 0) {
        throw new ForbiddenError('You are not assigned to teach this subject for this class');
    }
};

module.exports = { teacherClassIds, assertClassAccess, assertCanRecordMarks };
