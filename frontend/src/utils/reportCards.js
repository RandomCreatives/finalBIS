/*
 * Report-card assembly — pure, so it is cheap to test.
 *
 * The server already returns one final row per (student, subject, term):
 * marks, maxMarks, percentage and grade. Here we only group those rows per
 * student, order subjects alphabetically, and derive the term average and
 * overall grade — with the same scale the server uses, so a card can never
 * disagree with the marksheet it was printed from.
 */

export const gradeFor = (percentage) => {
    if (percentage >= 90) return 'A+';
    if (percentage >= 80) return 'A';
    if (percentage >= 70) return 'B+';
    if (percentage >= 60) return 'B';
    if (percentage >= 50) return 'C';
    if (percentage >= 40) return 'D';
    return 'F';
};

/**
 * @param {Array} students  [{ id, name, admissionNo, rollNum }]
 * @param {Array} subjects  [{ id, name, code }]
 * @param {Array} marksheets finals rows [{ student: {id}, subject: {id}, marks, maxMarks, percentage, grade }]
 * @returns one card per student, ordered by roll number then name.
 */
export function buildReportCards(students, subjects, marksheets) {
    const subjectOrder = [...subjects].sort((a, b) => a.name.localeCompare(b.name));
    const byStudent = new Map();
    for (const m of marksheets || []) {
        if (!m.student?.id) continue;
        if (!byStudent.has(m.student.id)) byStudent.set(m.student.id, new Map());
        byStudent.get(m.student.id).set(m.subject?.id || 'unknown', m);
    }

    return [...students]
        .sort((a, b) => (Number(a.rollNum) || 999) - (Number(b.rollNum) || 999)
            || (a.name || '').localeCompare(b.name || ''))
        .map((student) => {
            const marks = byStudent.get(student.id) || new Map();
            const rows = subjectOrder.map((subject) => {
                const m = marks.get(subject.id);
                return {
                    subject,
                    marks: m ? Number(m.marks) : null,
                    maxMarks: m ? Number(m.maxMarks) : null,
                    percentage: m?.percentage === null || m?.percentage === undefined ? null : Number(m.percentage),
                    grade: m ? m.grade : null,
                };
            });
            const scored = rows.filter((r) => r.percentage !== null);
            const average = scored.length === 0
                ? null
                : Number((scored.reduce((t, r) => t + r.percentage, 0) / scored.length).toFixed(1));
            return {
                student,
                rows,
                subjectsScored: scored.length,
                average,
                overallGrade: average === null ? null : gradeFor(average),
            };
        });
}
