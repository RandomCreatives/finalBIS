/** Current class-based ID shown on student cards. */
export const classIdFor = (student, academicYear = '2026/27') => {
    const year = String(student?.className || '').match(/year\s*(\d+)/i)?.[1];
    const color = String(student?.className || '').match(/-\s*([a-z]+)/i)?.[1];
    const roll = Number(student?.rollNum);
    if (!year || !color || !Number.isInteger(roll) || roll < 1) return null;
    return `Y${year}-${color.toUpperCase()}-${String(roll).padStart(2, '0')}-${academicYear}`;
};
