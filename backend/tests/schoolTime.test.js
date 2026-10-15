const { test, describe } = require('node:test');
const assert = require('node:assert/strict');

const schoolTime = require('../utils/schoolTime');

// 21:30 UTC on Wednesday 14 Oct is already 00:30 on Thursday 15 Oct in Addis.
const JUST_AFTER_MIDNIGHT = new Date('2026-10-14T21:30:00Z');
const REGISTRATION = new Date('2026-10-15T05:12:00Z'); // 08:12 at school

describe('school time is Addis Ababa (GMT+3), never the server clock', () => {
    test("today's date flips at midnight in Addis, not at midnight UTC", () => {
        assert.equal(JUST_AFTER_MIDNIGHT.toISOString().slice(0, 10), '2026-10-14', 'UTC still says Wednesday');
        assert.equal(schoolTime.todayIso(JUST_AFTER_MIDNIGHT), '2026-10-15');
        assert.equal(schoolTime.timeNow(JUST_AFTER_MIDNIGHT), '00:30');
        assert.equal(schoolTime.weekdayToday(JUST_AFTER_MIDNIGHT), 4, 'Thursday');
        assert.equal(schoolTime.todayIso(new Date('2026-10-14T20:59:00Z')), '2026-10-14', '23:59 at school');
    });

    test('clock times read on the school clock', () => {
        assert.equal(schoolTime.timeNow(REGISTRATION), '08:12');
        assert.equal(schoolTime.formatTime(REGISTRATION), '08:12');
        assert.equal(schoolTime.formatTime('2026-10-15T12:00:00Z'), '15:00');
    });

    test('the month flips at midnight in Addis too', () => {
        assert.equal(schoolTime.currentMonth(new Date('2026-10-31T21:15:00Z')), '2026-11');
        assert.equal(schoolTime.currentMonth(new Date('2026-10-31T20:45:00Z')), '2026-10');
    });

    test('calendar dates are plain dates: no shifting, any server time zone', () => {
        assert.equal(schoolTime.formatDay('2026-10-15'), 'Thursday 15 October');
        assert.equal(schoolTime.addDays('2026-12-30', 3), '2027-01-02');
        assert.equal(schoolTime.addDays('2028-03-01', -1), '2028-02-29');
        assert.equal(schoolTime.daysBetween('2026-09-07', '2026-10-15'), 38);
        assert.deepEqual(schoolTime.monthBounds('2028-02'), { from: '2028-02-01', to: '2028-02-29' });
        assert.equal(schoolTime.isoWeekday('2026-10-18'), 7, 'Sunday');
    });

    test('the school week runs Monday to Friday; Sunday looks back', () => {
        const week = ['2026-10-12', '2026-10-13', '2026-10-14', '2026-10-15', '2026-10-16'];
        assert.deepEqual(schoolTime.schoolWeek('2026-10-15'), week);
        assert.deepEqual(schoolTime.schoolWeek('2026-10-17'), week, 'Saturday');
        assert.deepEqual(schoolTime.schoolWeek('2026-10-18'), week, 'Sunday');
        assert.deepEqual(schoolTime.schoolWeek('2026-10-12'), week, 'Monday');
    });

    test('the clock can be pinned (tests) and defaults to now', () => {
        const real = schoolTime.clock.now;
        try {
            schoolTime.clock.now = () => JUST_AFTER_MIDNIGHT;
            assert.equal(schoolTime.todayIso(), '2026-10-15');
            assert.equal(schoolTime.timeNow(), '00:30');
        } finally {
            schoolTime.clock.now = real;
        }
        assert.equal(schoolTime.todayIso(), schoolTime.todayIso(new Date()));
    });
});
