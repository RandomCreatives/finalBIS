import { timetableSheetRows } from '../pages/ClassHome';

const slot = (dayOfWeek, startsAt, endsAt, subject, teacher) => ({
    id: `${dayOfWeek}-${startsAt}`, dayOfWeek, startsAt, endsAt,
    subject: { name: subject }, teacher: { name: teacher },
});

describe('timetableSheetRows', () => {
    const slots = [
        slot(1, '08:10:00', '08:30:00', 'Registration', 'Ms. Main'),
        slot(1, '08:30:00', '09:20:00', 'Mathematics', 'Ms. Main'),
        slot(2, '08:30:00', '09:20:00', 'English', 'Teacher 1'),
        slot(5, '14:10:00', '15:00:00', 'Spelling', 'Teacher 2'),
    ];

    test('emits title, header row and one row per period', () => {
        const rows = timetableSheetRows(slots, 'Year 4 Green');
        expect(rows[0][0]).toBe('Year 4 Green — Weekly Timetable 2026/2027 (Tentative)');
        expect(rows[2]).toEqual(['Time', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday']);
        // 3 distinct bell periods -> 3 grid rows after title + blank + header
        expect(rows.length).toBe(3 + 3);
    });

    test('places sessions in the right day column with teacher', () => {
        const rows = timetableSheetRows(slots, 'Year 4 Green');
        // First column speaks school language: period names + 12-hour times.
        const reg = rows.find((r) => r[0] === '8:10–8:30 AM'); // registration: no period name
        expect(reg[1]).toBe('Registration (Ms. Main)');        // Monday
        const l1 = rows.find((r) => r[0] === '1st period · 8:30–9:20 AM');
        expect(l1[1]).toBe('Mathematics (Ms. Main)');   // Monday
        expect(l1[2]).toBe('English (Teacher 1)');       // Tuesday
        expect(l1[3]).toBe('');                          // empty Wednesday
        const l6 = rows.find((r) => r[0] === '6th period · 2:10–3:00 PM');
        expect(l6[5]).toBe('Spelling (Teacher 2)');      // Friday
    });
});
