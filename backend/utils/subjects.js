/**
 * Registration ('REG') is a daily 08:10–08:30 timetable fixture pinned to the
 * main teacher — created so the roll-call slot has something to attach to.
 * It is not a teaching assignment: it must never appear in workload sums,
 * "subjects taught" lists, planning obligations, or assignment pickers.
 *
 * Timetable *slots* for REG stay untouched — the grid still shows the daily
 * registration row.
 */
const isFixtureSubject = (subject) => subject?.code === 'REG';

module.exports = { isFixtureSubject };
