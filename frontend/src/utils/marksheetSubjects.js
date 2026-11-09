// Subjects a main teacher may mark in the current Term 1 workflow.
// The timetable migration supports both GLS (current) and GCT (legacy) for
// Global Citizenship, so both codes must remain visible to the same teacher.
// Spelling remains a timetable/teaching seat, but is not a marksheet subject.
export const MAIN_TEACHER_MARKSHEET_CODES = new Set(['MAT', 'SCI', 'GLS', 'GCT']);

const uniqueSortedSubjects = (assignments) => {
    const bySubject = new Map();
    (assignments || []).forEach((assignment) => {
        if (assignment.subject?.id && !bySubject.has(assignment.subject.id)) {
            bySubject.set(assignment.subject.id, assignment.subject);
        }
    });
    return [...bySubject.values()].sort((a, b) => (a.name || '').localeCompare(b.name || ''));
};

/**
 * Admins see every subject. A main teacher sees MAT/SCI/GLS/GCT in their own
 * homeroom even if a handover left class_subjects.teacher_id on the previous
 * teacher; that seat identifies the current main teacher and the API permits
 * their marksheet access. On any other class, teachers only see their own
 * assigned subjects.
 */
export const marksheetSubjectsFor = (
    assignments,
    { user, isAdmin = false, isMainTeacherOfClass = false } = {},
) => {
    const list = assignments || [];
    const visible = isAdmin
        ? list
        : user?.role === 'main_teacher' && isMainTeacherOfClass
            ? list.filter((assignment) => MAIN_TEACHER_MARKSHEET_CODES.has(assignment.subject?.code))
            : list.filter((assignment) => assignment.teacherId === user?.id)
                .filter((assignment) => user?.role !== 'main_teacher'
                    || MAIN_TEACHER_MARKSHEET_CODES.has(assignment.subject?.code));

    return uniqueSortedSubjects(visible);
};

/**
 * Subjects for the class-home main-teacher screen. The class-card login is
 * already scoped to the main teacher's own class, so the subject assignment
 * owner is not used to gate these options (it can lag behind a teacher handover).
 */
export const mainTeacherMarksheetSubjectsFor = (assignments) => {
    const list = (assignments || []).filter((assignment) =>
        assignment.subject?.id
        && MAIN_TEACHER_MARKSHEET_CODES.has(assignment.subject.code));
    return uniqueSortedSubjects(list);
};
