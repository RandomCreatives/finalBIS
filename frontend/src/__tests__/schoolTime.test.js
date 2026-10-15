import {
    addDays, formatDate, formatDateTime, formatDay, formatTime, isoDate,
    schoolHour, schoolMonth, schoolToday, schoolWeekday, schoolWeekStart, weekdayOf,
} from '../utils/schoolTime';

describe('school time — Addis Ababa, GMT+3', () => {
    test('the test suite itself runs on the school clock (src/testTimezone.js)', () => {
        expect(new Date('2026-10-15T05:12:00Z').getHours()).toBe(8);
    });

    test('today, the hour and the weekday flip at midnight in Addis, not UTC', () => {
        const lateUtc = new Date('2026-10-14T21:30:00Z'); // 00:30 Thursday at school
        expect(lateUtc.toISOString().slice(0, 10)).toBe('2026-10-14');
        expect(schoolToday(lateUtc)).toBe('2026-10-15');
        expect(schoolHour(lateUtc)).toBe(0);
        expect(schoolWeekday(lateUtc)).toBe(4);
        expect(schoolMonth(new Date('2026-10-31T21:15:00Z'))).toBe('2026-11');
    });

    test('moments are shown on the school clock', () => {
        expect(formatTime('2026-10-15T05:12:00Z')).toBe('08:12');
        expect(formatDate('2026-10-14T22:30:00Z')).toBe('15 Oct 2026');
        expect(formatDateTime('2026-10-14T22:30:00Z')).toBe('15 Oct, 01:30');
        expect(formatTime(new Date('2026-10-15T12:00:00Z'), { hour: '2-digit', minute: '2-digit', second: '2-digit' }))
            .toBe('15:00:00');
    });

    test('calendar dates are shown exactly as stored', () => {
        expect(formatDate('2026-10-15')).toBe('15 Oct 2026');
        expect(formatDay('2026-10-15', { weekday: 'long', day: 'numeric', month: 'long' })).toBe('Thursday 15 October');
        expect(isoDate(2026, 9, 1)).toBe('2026-10-01');
        expect(addDays('2026-12-30', 3)).toBe('2027-01-02');
        expect(addDays('2028-03-01', -1)).toBe('2028-02-29');
        expect(weekdayOf('2026-10-18')).toBe(7);
    });

    test('a school week starts on Monday; the weekend belongs to the week just ending (as on the server)', () => {
        expect(schoolWeekStart('2026-10-12')).toBe('2026-10-12'); // Monday
        expect(schoolWeekStart('2026-10-15')).toBe('2026-10-12'); // Thursday
        expect(schoolWeekStart('2026-10-17')).toBe('2026-10-12'); // Saturday
        expect(schoolWeekStart('2026-10-18')).toBe('2026-10-12'); // Sunday looks back
        expect(schoolWeekStart('2027-01-01')).toBe('2026-12-28'); // across the new year
    });

    test('empty values format as empty text', () => {
        expect(formatDate(null)).toBe('');
        expect(formatTime(undefined)).toBe('');
        expect(formatDay('')).toBe('');
    });
});
