/*
 * Approved Academic Calendar 2026/27 — BIS NOC Gerji.
 *
 * Seeded from "Academic Calendar Approved.pdf". Events are editable by
 * everyone on the public calendar page (demo-stage persistence in the
 * browser); "Reset to approved calendar" restores this seed.
 */

export const CATEGORIES = {
    holiday:    { label: 'Holiday',      color: '#16a34a' },
    assessment: { label: 'Assessment',   color: '#d97706' },
    break:      { label: 'Break',        color: '#0891b2' },
    meeting:    { label: 'Meeting',      color: '#2563eb' },
    payment:    { label: 'Payment due',  color: '#7c3aed' },
    milestone:  { label: 'School event', color: '#0A1F6B' },
};

// Term spans as printed on the approved calendar.
export const TERM_SPANS = [
    { name: 'Staff preparation', startsOn: '2026-08-24', endsOn: '2026-09-18', color: '#64748b' },
    { name: 'Term 1', startsOn: '2026-09-21', endsOn: '2026-12-21', color: '#2563eb' },
    { name: 'Term 2', startsOn: '2027-01-11', endsOn: '2027-04-30', color: '#7c3aed' },
    { name: 'Term 3', startsOn: '2027-05-06', endsOn: '2027-07-12', color: '#16a34a' },
];

export const SEED_EVENTS = [
    // ── August 2026 ──
    { id: 'seed-01', date: '2026-08-24', title: 'All staff members report to school', category: 'milestone' },

    // ── September 2026 ──
    { id: 'seed-02', date: '2026-09-11', title: 'Ethiopian New Year', category: 'holiday', closed: true },
    { id: 'seed-03', date: '2026-09-14', endDate: '2026-09-18', title: 'Staff Development Week', category: 'milestone' },
    { id: 'seed-04', date: '2026-09-21', title: 'First day of the Term — Academic Year begins', category: 'milestone' },
    { id: 'seed-05', date: '2026-09-25', title: 'Prophet Mohammed\u2019s Birthday', category: 'holiday' },
    { id: 'seed-06', date: '2026-09-25', title: 'Eve of Meskel — classes end at 12:00', category: 'holiday' },
    { id: 'seed-07', date: '2026-09-28', title: 'First cycle of ECA classes begins', category: 'milestone' },

    // ── October 2026 ──
    { id: 'seed-08', date: '2026-10-05', title: 'First cycle of IEP sessions begins', category: 'milestone' },
    { id: 'seed-09', date: '2026-10-26', title: 'Half-term assessment begins', category: 'assessment' },
    { id: 'seed-10', date: '2026-10-29', endDate: '2026-10-30', title: 'Half-term break', category: 'break', closed: true },
    { id: 'seed-11', date: '2026-10-29', title: 'Half-termly SMT review meeting', category: 'meeting' },

    // ── November 2026 ──
    {
        id: 'seed-12', date: '2026-11-09',
        title: 'First Parent\u2013Teacher Conference Day', category: 'meeting', closed: true,
        note: 'Settling-in report issued — school closed.',
    },
    { id: 'seed-13', date: '2026-11-11', title: 'Second Term payment due', category: 'payment' },

    // ── December 2026 ──
    { id: 'seed-14', date: '2026-12-14', title: 'End of Term 1 assessment begins', category: 'assessment' },
    { id: 'seed-15', date: '2026-12-21', title: 'End of Term 1 break begins', category: 'break' },
    { id: 'seed-16', date: '2026-12-22', title: 'Termly Review Meeting — SMT & SIP Management Team', category: 'meeting' },

    // ── January 2027 ──
    { id: 'seed-17', date: '2027-01-09', title: 'Termly Review Meeting — Parents & PTSA', category: 'meeting' },
    { id: 'seed-18', date: '2027-01-11', title: 'Term 2 begins', category: 'milestone' },
    { id: 'seed-19', date: '2027-01-19', title: 'Ethiopian Epiphany / Timket', category: 'holiday', closed: true },
    {
        id: 'seed-20', date: '2027-01-22',
        title: 'Second Parent\u2013Teacher Conference Day', category: 'meeting', closed: true,
        note: 'Term one report issued — school closed.',
    },
    { id: 'seed-21', date: '2027-01-25', title: 'Second cycle of ECA classes begins', category: 'milestone' },
    { id: 'seed-22', date: '2027-01-25', title: 'Second cycle of IEP sessions begins', category: 'milestone' },

    // ── February 2027 ──
    { id: 'seed-23', date: '2027-02-22', title: 'Half-term assessment week begins', category: 'assessment' },
    { id: 'seed-24', date: '2027-02-23', title: 'Half-termly SMT review meeting', category: 'meeting' },

    // ── March 2027 ──
    { id: 'seed-25', date: '2027-03-01', endDate: '2027-03-03', title: 'Half-term break', category: 'break', closed: true },
    { id: 'seed-26', date: '2027-03-02', title: 'Victory of Adwa', category: 'holiday', closed: true },
    { id: 'seed-27', date: '2027-03-09', title: 'Third Term payment due', category: 'payment' },
    { id: 'seed-28', date: '2027-03-10', title: 'Eid al-Fitr \u2014 Ramadan', category: 'holiday', tentative: true },

    // ── April 2027 ──
    { id: 'seed-29', date: '2027-04-22', endDate: '2027-04-26', title: 'End of Term 2 assessment begins', category: 'assessment' },
    { id: 'seed-30', date: '2027-04-27', title: 'Termly Review Meeting — SMT & SIP Management Team', category: 'meeting' },
    { id: 'seed-31', date: '2027-04-29', title: 'Termly Review Meeting — Parents & PTSA', category: 'meeting' },
    { id: 'seed-32', date: '2027-04-30', title: 'End of Term 2 break begins', category: 'break' },

    // ── May 2027 ──
    { id: 'seed-33', date: '2027-05-06', title: 'Term 3 begins', category: 'milestone' },
    { id: 'seed-34', date: '2027-05-17', title: 'Eid al-Adha / Arafa', category: 'holiday', tentative: true },
    {
        id: 'seed-35', date: '2027-05-21',
        title: 'Third Parent\u2013Teacher Conference Day', category: 'meeting', closed: true,
        note: 'Second term report issued — school closed.',
    },

    // ── June 2027 ──
    { id: 'seed-36', date: '2027-06-30', title: 'End of Term 3 assessment begins', category: 'assessment' },

    // ── July 2027 ──
    { id: 'seed-37', date: '2027-07-03', title: 'Termly Review Meeting — Parents & PTSA', category: 'meeting' },
    { id: 'seed-38', date: '2027-07-09', title: 'Report card issuance day', category: 'milestone' },
    { id: 'seed-39', date: '2027-07-12', title: 'End of Year break begins', category: 'break' },
    {
        id: 'seed-40', date: '2027-07-13', endDate: '2027-07-17',
        title: 'Readmission for 2027/28 \u2014 admission of new students', category: 'milestone',
    },
    { id: 'seed-41', date: '2027-07-23', endDate: '2027-07-24', title: 'Termly Review Meeting — SMT & SIP Management Team', category: 'meeting' },
];

export const CALENDAR_MONTHS = [
    { year: 2026, month: 7 },  // August 2026
    { year: 2026, month: 8 },  // September
    { year: 2026, month: 9 },  // October
    { year: 2026, month: 10 }, // November
    { year: 2026, month: 11 }, // December
    { year: 2027, month: 0 },  // January 2027
    { year: 2027, month: 1 },  // February
    { year: 2027, month: 2 },  // March
    { year: 2027, month: 3 },  // April
    { year: 2027, month: 4 },  // May
    { year: 2027, month: 5 },  // June
    { year: 2027, month: 6 },  // July
];

export const CALENDAR_STORE_KEY = 'bisnoc.demo.calendar.v1';
