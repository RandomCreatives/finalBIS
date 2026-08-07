const supabase = require('../config/supabase');
const { asyncHandler } = require('../utils/errors');
const ExcelJS = require('exceljs');

const getStats = asyncHandler(async (req, res) => {
    const [
        studentsRes,
        maleStudentsRes,
        femaleStudentsRes,
        otherGenderStudentsRes,
        classesRes,
        staffRes,
        subjectsRes,
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
    ]);

    for (const r of [studentsRes, maleStudentsRes, femaleStudentsRes, otherGenderStudentsRes, classesRes, staffRes, subjectsRes]) {
        if (r.error) throw r.error;
    }

    // Count staff by role
    const staffList = staffRes.data || [];
    const roleCounts = {};
    staffList.forEach(s => {
        roleCounts[s.role] = (roleCounts[s.role] || 0) + 1;
    });

    const stats = {
        totalStudents: studentsRes.count ?? 0,
        maleStudents: maleStudentsRes.count ?? 0,
        femaleStudents: femaleStudentsRes.count ?? 0,
        otherGenderStudents: otherGenderStudentsRes.count ?? 0,
        totalClasses: classesRes.count ?? 0,
        totalTeachers: staffRes.count ?? 0,
        teachersByRole: roleCounts,
        totalSubjects: subjectsRes.count ?? 0,
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

module.exports = { getStats };
