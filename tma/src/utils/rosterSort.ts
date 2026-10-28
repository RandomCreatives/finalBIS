export interface StudentRosterRow {
    id: string;
    name: string;
    rollNum?: number | string | null;
    roll_num?: number | string | null;
    classId?: string | null;
    class_id?: string | null;
    class?: { id?: string | null; name?: string | null } | null;
}

export const normalizeStudentName = (value: unknown): string =>
    String(value || '').trim().replace(/\s+/g, ' ');

const classIdOf = (student: StudentRosterRow) =>
    student.classId ?? student.class_id ?? student.class?.id ?? null;

const rollOf = (student: StudentRosterRow): number | null => {
    const raw = student.rollNum ?? student.roll_num ?? null;
    const value = raw === null || raw === undefined || raw === '' ? Number.NaN : Number(raw);
    return Number.isFinite(value) && value > 0 ? value : null;
};

export function sortClassRoster<T extends StudentRosterRow>(rows: T[] | null | undefined): T[] {
    return [...(rows || [])]
        .map((student) => ({ ...student, name: normalizeStudentName(student.name) }) as T)
        .sort((a, b) => {
            const classA = classIdOf(a);
            const classB = classIdOf(b);
            if (!classA || !classB || String(classA) === String(classB)) {
                const rollA = rollOf(a);
                const rollB = rollOf(b);
                if (rollA !== null && rollB !== null && rollA !== rollB) return rollA - rollB;
                if (rollA !== null && rollB === null) return -1;
                if (rollA === null && rollB !== null) return 1;
            }

            const nameA = normalizeStudentName(a.name);
            const nameB = normalizeStudentName(b.name);
            return nameA.localeCompare(nameB, 'en', { sensitivity: 'base' })
                || nameA.localeCompare(nameB)
                || String(a.id || '').localeCompare(String(b.id || ''));
        });
}
