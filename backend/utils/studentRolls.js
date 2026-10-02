const supabase = require('../config/supabase');

const compareStudents = (a, b) =>
    String(a.name || '').localeCompare(String(b.name || ''), 'en', { sensitivity: 'base' })
    || String(a.name || '').localeCompare(String(b.name || ''))
    || String(a.id || '').localeCompare(String(b.id || ''));

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

    const rows = [...(data || [])].sort(compareStudents);
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

module.exports = { renumberClass, renumberClasses };
