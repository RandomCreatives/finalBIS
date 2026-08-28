const supabase = require('../config/supabase');
const { asyncHandler } = require('../utils/errors');

/**
 * GET /api/public/teachers — login-free staff directory.
 *
 * Part of the public showcase pages (with the classes directory). Lists
 * main teachers and subject teachers only — assistants, admins and store
 * staff are deliberately excluded. The payload is intentionally minimal:
 * names, role, and current-year class/subject associations. No emails,
 * phone numbers, or account identifiers.
 *
 * Like every /api route it sits behind the global rate limiter.
 */
const listPublicTeachers = asyncHandler(async (req, res) => {
    // Single-school deployment: the directory belongs to the one school.
    const { data: school, error: schoolError } = await supabase
        .from('schools')
        .select('id')
        .maybeSingle();

    if (schoolError) throw schoolError;
    if (!school) return res.json({ teachers: [] });

    const { data: teachers, error } = await supabase
        .from('users')
        .select('id, name, role')
        .eq('school_id', school.id)
        .eq('is_active', true)
        .in('role', ['main_teacher', 'subject_teacher'])
        .order('name');

    if (error) throw error;

    // Class and subject associations hang off the current academic year.
    const { data: year } = await supabase
        .from('academic_years')
        .select('id')
        .eq('school_id', school.id)
        .eq('is_current', true)
        .maybeSingle();

    let staffRows = [];
    let assignmentRows = [];

    if (year && teachers.length > 0) {
        const [staffRes, assignmentRes] = await Promise.all([
            supabase
                .from('class_staff')
                .select('user_id, class:classes(name)')
                .eq('academic_year_id', year.id)
                .eq('position', 'main'),
            supabase
                .from('class_subjects')
                .select('teacher_id, subject:subjects(name), class:classes(name)')
                .eq('academic_year_id', year.id),
        ]);

        if (staffRes.error) throw staffRes.error;
        if (assignmentRes.error) throw assignmentRes.error;

        staffRows = staffRes.data || [];
        assignmentRows = assignmentRes.data || [];
    }

    // Homeroom classes per main teacher.
    const classesByUser = new Map();
    for (const row of staffRows) {
        if (!classesByUser.has(row.user_id)) classesByUser.set(row.user_id, []);
        if (row.class?.name) classesByUser.get(row.user_id).push(row.class.name);
    }

    // Subjects per teacher, with how many classes each one spans.
    const subjectsByUser = new Map();
    for (const row of assignmentRows) {
        if (!row.subject?.name) continue;
        if (!subjectsByUser.has(row.teacher_id)) subjectsByUser.set(row.teacher_id, new Map());

        const bySubject = subjectsByUser.get(row.teacher_id);
        if (!bySubject.has(row.subject.name)) bySubject.set(row.subject.name, new Set());
        if (row.class?.name) bySubject.get(row.subject.name).add(row.class.name);
    }

    res.json({
        teachers: teachers.map((t) => ({
            name: t.name,
            role: t.role,
            classes: [...new Set(classesByUser.get(t.id) || [])].sort(),
            subjects: [...(subjectsByUser.get(t.id) || new Map())]
                .map(([name, classes]) => ({ name, classCount: classes.size }))
                .sort((a, b) => a.name.localeCompare(b.name)),
        })),
    });
});

/**
 * GET /api/public/students — login-free student directory.
 *
 * Shows every active, placed student grouped by class, with names only.
 * Deliberately the minimum a public roster needs: no admission numbers,
 * roll numbers, dates of birth, or guardian details ever leave the backend.
 */
const listPublicStudents = asyncHandler(async (req, res) => {
    const { data: school, error: schoolError } = await supabase
        .from('schools')
        .select('id')
        .maybeSingle();

    if (schoolError) throw schoolError;
    if (!school) return res.json({ students: [] });

    const { data: students, error } = await supabase
        .from('students')
        .select('name, class:classes(name, year_level)')
        .eq('school_id', school.id)
        .eq('is_active', true)
        .order('name');

    if (error) throw error;

    res.json({
        students: (students || [])
            .filter((s) => s.class) // unplaced students never appear publicly
            .map((s) => ({
                name: s.name,
                className: s.class.name,
                yearLevel: s.class.year_level,
            })),
    });
});

module.exports = { listPublicTeachers, listPublicStudents };
