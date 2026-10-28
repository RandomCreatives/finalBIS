/**
 * Canonical student name normalization and roster ordering shared across
 * ClassHome, SubjectHome, Marksheets, Attendance, ReportCards, and Students.
 *
 * Mirrors `backend/utils/studentRolls.js` and `renumber_student_class`
 * (migration 027) so Main Teachers, Subject Teachers, and Admins always see
 * the exact same list, spelling, and Roll # order.
 */

export const normalizeStudentName = (value) =>
    String(value || '').trim().replace(/\s+/g, ' ');

const rollNumberOf = (student) => {
    const raw = student?.rollNum ?? student?.roll_num ?? null;
    const n = raw === null || raw === undefined || raw === '' ? NaN : Number(raw);
    return Number.isFinite(n) && n > 0 ? n : null;
};

const classIdOf = (student) =>
    student?.classId ?? student?.class_id ?? student?.class?.id ?? null;

export const compareClassStudents = (a, b) => {
    const classA = classIdOf(a);
    const classB = classIdOf(b);
    if (!classA || !classB || String(classA) === String(classB)) {
        const rA = rollNumberOf(a);
        const rB = rollNumberOf(b);
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

export const sortClassRoster = (input) => {
    const list = Array.isArray(input)
        ? input
        : Array.isArray(input?.students)
            ? input.students
            : [];
    return list
        .map((s) => (s && typeof s === 'object' ? { ...s, name: normalizeStudentName(s.name) } : s))
        .filter(Boolean)
        .sort(compareClassStudents);
};
