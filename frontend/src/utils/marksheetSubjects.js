// Subjects a main teacher may mark in the current Term 1 workflow.
// Spelling remains a timetable/teaching seat, but is not a marksheet subject.
export const MAIN_TEACHER_MARKSHEET_CODES = new Set(['MAT', 'SCI', 'GLS']);

/**
 * Keep a marksheet subject picker aligned with the caller's teaching
 * responsibility. Admins see every subject; teachers see their own seats.
 */
export const marksheetSubjectsFor = (assignments, { user, isAdmin = false } = {}) => {
    const list = assignments || [];
    const visible = isAdmin
        ? list
        : list.filter((assignment) => assignment.teacherId === user?.id)
            .filter((assignment) => user?.role !== 'main_teacher'
                || MAIN_TEACHER_MARKSHEET_CODES.has(assignment.subject?.code));

    const bySubject = new Map();
    visible.forEach((assignment) => {
        if (assignment.subject?.id && !bySubject.has(assignment.subject.id)) {
            bySubject.set(assignment.subject.id, assignment.subject);
        }
    });
    return [...bySubject.values()].sort((a, b) => (a.name || '').localeCompare(b.name || ''));
};


/** Subjects for the class-home main-teacher screen. */
export const mainTeacherMarksheetSubjectsFor = (assignments, teacherId) => {
    const list = (assignments || []).filter((assignment) =>
        (!teacherId || assignment.teacherId === teacherId)
        && assignment.subject?.id
        && MAIN_TEACHER_MARKSHEET_CODES.has(assignment.subject.code));
    const bySubject = new Map();
    list.forEach((assignment) => {
        if (!bySubject.has(assignment.subject.id)) bySubject.set(assignment.subject.id, assignment.subject);
    });
    return [...bySubject.values()].sort((a, b) => (a.name || '').localeCompare(b.name || ''));
};
