const supabase = require('../config/supabase');

const normalizeStudentName = (value) =>
    String(value || '').trim().replace(/\s+/g, ' ');

const rollOf = (row) => {
    const raw = row?.roll_num ?? row?.rollNum ?? null;
    const n = raw === null || raw === undefined || raw === '' ? NaN : Number(raw);
    return Number.isFinite(n) && n > 0 ? n : null;
};

const classIdOf = (row) =>
    row?.class_id ?? row?.classId ?? row?.class?.id ?? null;

const compareStudents = (a, b) => {
    const classA = classIdOf(a);
    const classB = classIdOf(b);
    if (classA && classB && String(classA) === String(classB)) {
        const rA = rollOf(a);
        const rB = rollOf(b);
        if (rA !== null && rB !== null && rA !== rB) return rA - rB;
        if (rA !== null && rB === null) return -1;
        if (rA === null && rB !== null) return 1;
    }

    const nameA = normalizeStudentName(a?.name);
    const nameB = normalizeStudentName(b?.name);
    return (
        nameA.localeCompare(nameB, 'en', { sensitivity: 'base' })
        || nameA.localeCompare(nameB)
        || String(a?.id || '').localeCompare(String(b?.id || ''))
    );
};

const sortStudentsCanonically = (rows) => [...(rows || [])].sort(compareStudents);

/**
 * Keep one class's active roster at rolls 1..N in alphabetical order.
 * Production uses the transactional Postgres function from migration 027.
 * The query fallback keeps the offline test stub useful.
 */
const renumberClass = async (schoolId, classId) => {
    if (!classId) return 0;

    if (process.env.NODE_ENV !== 'test') {
        const { data, error } = await supabase.rpc('renumber_student_class', {
            p_school_id: schoolId,
            p_class_id: classId,
        });
        if (error) throw error;
        return Number(data || 0);
    }

    const { data, error } = await supabase
        .from('students')
        .select('id, name')
        .eq('school_id', schoolId)
        .eq('class_id', classId)
        .eq('is_active', true);
    if (error) throw error;

    const rows = [...(data || [])].sort((a, b) => {
        const nameA = normalizeStudentName(a.name);
        const nameB = normalizeStudentName(b.name);
        return (
            nameA.localeCompare(nameB, 'en', { sensitivity: 'base' })
            || nameA.localeCompare(nameB)
            || String(a.id || '').localeCompare(String(b.id || ''))
        );
    });
    for (const row of rows) {
        const { error: clearError } = await supabase
            .from('students')
            .update({ roll_num: null })
            .eq('id', row.id)
            .eq('school_id', schoolId);
        if (clearError) throw clearError;
    }
    for (const [index, row] of rows.entries()) {
        const { error: updateError } = await supabase
            .from('students')
            .update({ roll_num: index + 1 })
            .eq('id', row.id)
            .eq('school_id', schoolId);
        if (updateError) throw updateError;
    }
    return rows.length;
};

const renumberClasses = async (schoolId, classIds) => {
    const unique = [...new Set((classIds || []).filter(Boolean))];
    for (const classId of unique) await renumberClass(schoolId, classId);
};

module.exports = {
    normalizeStudentName,
    compareStudents,
    sortStudentsCanonically,
    renumberClass,
    renumberClasses,
};
