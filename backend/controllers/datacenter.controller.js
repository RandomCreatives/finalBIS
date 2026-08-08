const supabase = require('../config/supabase');
const { asyncHandler } = require('../utils/errors');
const ExcelJS = require('exceljs');

/** Percentage → letter grade. Mirrors marksheet.controller for the public page. */
const gradeFor = (percentage) => {
    if (percentage >= 90) return 'A+';
    if (percentage >= 80) return 'A';
    if (percentage >= 70) return 'B+';
    if (percentage >= 60) return 'B';
    if (percentage >= 50) return 'C';
    if (percentage >= 40) return 'D';
    return 'F';
};

const getStats = asyncHandler(async (req, res) => {
    const [
        studentsRes,
        maleStudentsRes,
        femaleStudentsRes,
        otherGenderStudentsRes,
        classesRes,
        staffRes,
        subjectsRes,
        classRollsRes,
        attendanceRes,
    ] = await Promise.all([
        supabase
            .from('students')
            .select('id', { count: 'exact', head: true })
            .eq('is_active', true),
        supabase
            .from('students')
            .select('id', { count: 'exact', head: true })
            .eq('is_active', true)
            .eq('gender', 'male'),
        supabase
            .from('students')
            .select('id', { count: 'exact', head: true })
            .eq('is_active', true)
            .eq('gender', 'female'),
        supabase
            .from('students')
            .select('id', { count: 'exact', head: true })
            .eq('is_active', true)
            .eq('gender', 'other'),
        supabase
            .from('classes')
            .select('id', { count: 'exact', head: true }),
        supabase
            .from('users')
            .select('id, role', { count: 'exact' })
            .eq('is_active', true)
            .neq('role', 'admin'),
        supabase
            .from('subjects')
            .select('id', { count: 'exact', head: true }),
        supabase
            .from('students')
            .select('class_id, class:classes(name)')
            .eq('is_active', true)
            .not('class_id', 'is', null),
        supabase
            .from('attendance')
            .select('status'),
    ]);

    for (const r of [studentsRes, maleStudentsRes, femaleStudentsRes, otherGenderStudentsRes, classesRes, staffRes, subjectsRes, classRollsRes, attendanceRes]) {
        if (r.error) throw r.error;
    }

    // Count staff by role
    const staffList = staffRes.data || [];
    const roleCounts = {};
    staffList.forEach(s => {
        roleCounts[s.role] = (roleCounts[s.role] || 0) + 1;
    });

    // Students per class (only classes that have students on roll)
    const classMap = new Map();
    (classRollsRes.data || []).forEach((row) => {
        const name = row.class?.name || 'Unassigned';
        classMap.set(name, (classMap.get(name) || 0) + 1);
    });
    const studentsByClass = [...classMap.entries()]
        .map(([name, count]) => ({ className: name, count }))
        .sort((a, b) => a.className.localeCompare(b.className));

    // Attendance rate: present and late count as attended.
    const attendanceRows = attendanceRes.data || [];
    const attended = attendanceRows.filter((a) => a.status === 'present' || a.status === 'late').length;
    const attendanceRate = attendanceRows.length
        ? Math.round((attended / attendanceRows.length) * 100)
        : null;

    const stats = {
        totalStudents: studentsRes.count ?? 0,
        maleStudents: maleStudentsRes.count ?? 0,
        femaleStudents: femaleStudentsRes.count ?? 0,
        otherGenderStudents: otherGenderStudentsRes.count ?? 0,
        totalClasses: classesRes.count ?? 0,
        totalTeachers: staffRes.count ?? 0,
        teachersByRole: roleCounts,
        totalSubjects: subjectsRes.count ?? 0,
        studentsByClass,
        attendanceRate,
    };

    const download = req.query.download === 'excel';

    if (download) {
        const workbook = new ExcelJS.Workbook();
        const sheet = workbook.addWorksheet('School Statistics');

        sheet.columns = [
            { header: 'Metric', key: 'metric', width: 30 },
            { header: 'Value', key: 'value', width: 20 },
        ];

        sheet.addRow({ metric: 'Total Students', value: stats.totalStudents });
        sheet.addRow({ metric: 'Male Students', value: stats.maleStudents });
        sheet.addRow({ metric: 'Female Students', value: stats.femaleStudents });
        sheet.addRow({ metric: 'Other Gender Students', value: stats.otherGenderStudents });
        sheet.addRow({ metric: 'Total Classes', value: stats.totalClasses });
        sheet.addRow({ metric: 'Total Teachers', value: stats.totalTeachers });
        sheet.addRow({ metric: 'Total Subjects', value: stats.totalSubjects });

        Object.entries(roleCounts).forEach(([role, count]) => {
            sheet.addRow({ metric: `Teachers (${role})`, value: count });
        });

        res.setHeader(
            'Content-Type',
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        );
        res.setHeader(
            'Content-Disposition',
            'attachment; filename="school_statistics.xlsx"'
        );

        await workbook.xlsx.writeBuffer().then((buffer) => {
            res.send(buffer);
        });
    } else {
        res.json(stats);
    }
});

/**
 * GET /api/datacenter/academic
 *
 * Academic reporting built from marksheets for the school's current term:
 *   - per-class top 3 students by average percentage
 *   - school-wide top 10 students
 *   - per-subject average percentage
 *
 * All ranking is computed from the derived percentage column, so stale or
 * partially-entered terms simply show fewer ranked students.
 */
const getAcademic = asyncHandler(async (req, res) => {
    const { data: term, error: termError } = await supabase
        .from('terms')
        .select('id, name, term_index')
        .eq('is_current', true)
        .limit(1)
        .maybeSingle();

    if (termError) throw termError;

    if (!term) {
        res.json({
            termName: null,
            perClassTop3: [],
            schoolTop10: [],
            subjectAverages: [],
        });
        return;
    }

    const { data: marks, error: marksError } = await supabase
        .from('marksheets')
        .select(`
            student_id, student:students(id, name, admission_no, class_id),
            class_id, class:classes(name),
            subject_id, subject:subjects(name),
            percentage, grade
        `)
        .eq('term_id', term.id);

    if (marksError) throw marksError;

    // Group marks by student and average their percentages.
    const studentAgg = new Map();
    for (const m of marks || []) {
        if (!m.student) continue;
        const entry = studentAgg.get(m.student_id) || {
            id: m.student_id,
            name: m.student.name,
            admissionNo: m.student.admission_no,
            classId: m.student.class_id,
            className: m.class?.name || null,
            total: 0,
            count: 0,
        };
        entry.total += m.percentage || 0;
        entry.count += 1;
        studentAgg.set(m.student_id, entry);
    }

    const rankedStudents = [...studentAgg.values()]
        .map((s) => ({
            ...s,
            average: s.count ? Math.round((s.total / s.count) * 100) / 100 : null,
        }))
        .filter((s) => s.average !== null)
        .sort((a, b) => b.average - a.average);

    // Per-class leaderboards.
    const byClass = new Map();
    for (const s of rankedStudents) {
        const key = s.className || 'Unassigned';
        if (!byClass.has(key)) byClass.set(key, []);
        byClass.get(key).push(s);
    }

    const perClassTop3 = [...byClass.entries()]
        .map(([className, students]) => ({
            className,
            top3: students.slice(0, 3).map((s, i) => ({
                rank: i + 1,
                name: s.name,
                admissionNo: s.admissionNo,
                average: s.average,
                grade: gradeFor(s.average),
            })),
        }))
        .sort((a, b) => a.className.localeCompare(b.className));

    // Subject averages.
    const subjectAgg = new Map();
    for (const m of marks || []) {
        if (!m.subject?.name) continue;
        const entry = subjectAgg.get(m.subject_id) || {
            name: m.subject.name,
            total: 0,
            count: 0,
        };
        entry.total += m.percentage || 0;
        entry.count += 1;
        subjectAgg.set(m.subject_id, entry);
    }

    const subjectAverages = [...subjectAgg.values()]
        .map((s) => ({
            name: s.name,
            average: s.count ? Math.round((s.total / s.count) * 100) / 100 : null,
        }))
        .filter((s) => s.average !== null)
        .sort((a, b) => b.average - a.average);

    res.json({
        termName: term.name,
        perClassTop3,
        schoolTop10: rankedStudents.slice(0, 10).map((s, i) => ({
            rank: i + 1,
            name: s.name,
            admissionNo: s.admissionNo,
            className: s.className,
            average: s.average,
            grade: gradeFor(s.average),
        })),
        subjectAverages,
    });
});

module.exports = { getStats, getAcademic };
