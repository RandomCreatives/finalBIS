const supabase = require('../config/supabase');
const { asyncHandler } = require('../utils/errors');
const { isFixtureSubject } = require('../utils/subjects');

/*
 * Public showcase endpoints. Resilience contract: these pages are the
 * school's public face, so they must never 500. If the database is paused
 * or unreachable, each handler degrades to an empty list (flagged
 * `degraded`) and the UI falls back to its seeded content.
 *
 * Payloads are deliberately minimal: names, role, and current-year
 * class/subject associations. No emails, phone numbers, admission numbers,
 * dates of birth, guardian details, or account identifiers.
 *
 * Like every /api route they sit behind the global rate limiter.
 */

/** GET /api/public/teachers — login-free staff directory. */
const listPublicTeachers = asyncHandler(async (req, res) => {
    try {
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
                    .select('teacher_id, subject:subjects(name, code), class:classes(name)')
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
            if (isFixtureSubject(row.subject)) continue; // Registration is not taught
            if (!subjectsByUser.has(row.teacher_id)) subjectsByUser.set(row.teacher_id, new Map());

            const bySubject = subjectsByUser.get(row.teacher_id);
            if (!bySubject.has(row.subject.name)) bySubject.set(row.subject.name, new Set());
            if (row.class?.name) bySubject.get(row.subject.name).add(row.class.name);
        }

        return res.json({
            teachers: teachers.map((t) => ({
                name: t.name,
                role: t.role,
                classes: [...new Set(classesByUser.get(t.id) || [])].sort(),
                subjects: [...(subjectsByUser.get(t.id) || new Map())]
                    .map(([name, classes]) => ({ name, classCount: classes.size }))
                    .sort((a, b) => a.name.localeCompare(b.name)),
            })),
        });
    } catch (err) {
        console.error('[public/teachers] degraded:', err.message);
        return res.json({ teachers: [], degraded: true });
    }
});

/** GET /api/public/students — login-free student directory. */
const listPublicStudents = asyncHandler(async (req, res) => {
    try {
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

        return res.json({
            students: (students || [])
                .filter((s) => s.class) // unplaced students never appear publicly
                .map((s) => ({
                    name: s.name,
                    className: s.class.name,
                    yearLevel: s.class.year_level,
                })),
        });
    } catch (err) {
        console.error('[public/students] degraded:', err.message);
        return res.json({ students: [], degraded: true });
    }
});

module.exports = { listPublicTeachers, listPublicStudents };
