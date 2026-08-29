/*
 * Canonical class roster for the public showcase pages.
 *
 * Names and main teachers mirror Year_3_and_Year_4_Class_Teachers.csv.
 * Shared by the public Classes page and the per-class teacher home so the
 * login gate and the class view never disagree about the roster.
 *
 * NOTE: the per-class "password = class name" login is a demo-stage gate
 * while the real sign-in system is being redesigned. It is NOT security —
 * see ClassHome for the session handling.
 */
export const CLASSES = [
    // Year 3 — 4 homerooms
    { id: 1,  name: 'Year 3 - Blue',    yearLevel: 3, mainTeacher: 'Ms. Yeabsira A.', assistantTeacher: null, studentCount: 26 },
    { id: 2,  name: 'Year 3 - Yellow',  yearLevel: 3, mainTeacher: 'Ms. Meron A.',    assistantTeacher: null, studentCount: 24 },
    { id: 3,  name: 'Year 3 - Red',     yearLevel: 3, mainTeacher: null,              assistantTeacher: null, studentCount: 25 },
    { id: 4,  name: 'Year 3 - Green',   yearLevel: 3, mainTeacher: 'Mr. Deginet',     assistantTeacher: null, studentCount: 23 },
    // Year 4 — 10 homerooms
    { id: 5,  name: 'Year 4 - Blue',    yearLevel: 4, mainTeacher: 'Mr. Mulugeta J.', assistantTeacher: null, studentCount: 29 },
    { id: 6,  name: 'Year 4 - Purple',  yearLevel: 4, mainTeacher: 'Ms. Mekdelawit A.',assistantTeacher: null, studentCount: 28 },
    { id: 7,  name: 'Year 4 - Lavender',yearLevel: 4, mainTeacher: 'Ms. Selam G.',    assistantTeacher: null, studentCount: 30 },
    { id: 8,  name: 'Year 4 - Crimson', yearLevel: 4, mainTeacher: 'Ms. Simegn Y.',   assistantTeacher: null, studentCount: 27 },
    { id: 9,  name: 'Year 4 - Green',   yearLevel: 4, mainTeacher: null,              assistantTeacher: null, studentCount: 28 },
    { id: 10, name: 'Year 4 - Yellow',  yearLevel: 4, mainTeacher: 'Ms. Mariamawait B.',assistantTeacher: null, studentCount: 26 },
    { id: 11, name: 'Year 4 - Magenta', yearLevel: 4, mainTeacher: 'Ms. Abigail A.',  assistantTeacher: null, studentCount: 29 },
    { id: 12, name: 'Year 4 - Red',     yearLevel: 4, mainTeacher: 'Ms. Denebe A.',   assistantTeacher: null, studentCount: 25 },
    { id: 13, name: 'Year 4 - Violet',  yearLevel: 4, mainTeacher: 'Ms. Abigiya T.',  assistantTeacher: null, studentCount: 30 },
    { id: 14, name: 'Year 4 - Orange',  yearLevel: 4, mainTeacher: 'Ms. Mekdelawit N.',assistantTeacher: null, studentCount: 27 },
];

/** 'Year 3 - Blue' -> 'year-3-blue' (URL-safe). */
export const slugFor = (className) =>
    className.toLowerCase().replace(/\s*-\s*/g, '-').replace(/\s+/g, '-');

/**
 * The demo-stage class password: the class name itself, lowercased and
 * de-hyphenated — 'Year 3 - Blue' -> 'year 3 blue'.
 */
export const passwordFor = (className) =>
    className.toLowerCase().replace(/\s*-\s*/g, ' ').replace(/\s+/g, ' ').trim();

export const classBySlug = (slug) =>
    CLASSES.find((c) => slugFor(c.name) === slug) ?? null;

export const CLASS_LOGIN_KEY = 'bisnoc.classLogin';

export const saveClassLogin = (klass) => {
    localStorage.setItem(CLASS_LOGIN_KEY, JSON.stringify({
        slug: slugFor(klass.name),
        className: klass.name,
        teacher: klass.mainTeacher,
        at: Date.now(),
    }));
};

export const readClassLogin = () => {
    try {
        return JSON.parse(localStorage.getItem(CLASS_LOGIN_KEY)) ?? null;
    } catch {
        return null;
    }
};

export const clearClassLogin = () => localStorage.removeItem(CLASS_LOGIN_KEY);

// Sample students shown when the live directory is empty, so the page is
// demonstrable. Real records carry the same fields server-side.
export const SAMPLE_STUDENTS = [
    {
        name: 'Yonas Bekele',
        className: 'Year 3 - Blue',
        gender: 'Male',
        admissionNumber: 'BIS2026-001',
        dateOfBirth: '2018-04-12',
        guardianName: 'Mrs. Meseret Bekele',
        guardianRelation: 'Mother',
        guardianPhone: '+251 91 123 4567',
        address: 'Gerji, Addis Ababa',
        previousSchool: 'Gerji Neighborhood School',
        medicalNotes: 'No known allergies',
        enrolmentDate: '2026-09-01',
        status: 'Active',
    },
    {
        name: 'Hana Getachew',
        className: 'Year 4 - Red',
        gender: 'Female',
        admissionNumber: 'BIS2026-002',
        dateOfBirth: '2017-09-03',
        guardianName: 'Mr. Getachew Tesfaye',
        guardianRelation: 'Father',
        guardianPhone: '+251 92 234 5678',
        address: 'Gerji, Addis Ababa',
        previousSchool: 'BIS NOC Gerji (Year 3)',
        medicalNotes: 'Mild asthma — inhaler kept in the clinic',
        enrolmentDate: '2026-09-01',
        status: 'Active',
    },
];

/* ── demo teaching data ─────────────────────────────────────
 * Subjects a main teacher's class takes. Maths & Science are delivered by
 * the class's own main teacher; the rest by subject teachers. Mirrors the
 * real subjects catalogue.
 */
export const CLASS_SUBJECTS = [
    'Mathematics', 'Science', 'English', 'Amharic', 'French',
    'Arts', 'Music', 'Physical Education',
];

/** Demo roster generator — deterministic per class, for the demo stage only. */
const FIRST = ['Abel', 'Sara', 'Daniel', 'Hanna', 'Yosef', 'Liya', 'Meron', 'Bereket',
    'Tsion', 'Nahom', 'Ruth', 'Elias', 'Martha', 'Samuel', 'Bethelhem', 'Dawit',
    'Selam', 'Henok', 'Kidist', 'Yared', 'Fikir', 'Robel', 'Amanuel', 'Mahi'];
const LAST = ['Tesfaye', 'Alemu', 'Bekele', 'Girma', 'Tadesse', 'Haile', 'Worku',
    'Mekonnen', 'Abebe', 'Fikru', 'Negash', 'Kassa', 'Demissie', 'Assefa', 'Baye'];

export const demoRoster = (klass) => {
    const count = Math.min(klass?.studentCount ?? 25, 30);
    const seed = klass?.id ?? 1;
    const roster = [];
    for (let i = 0; i < count; i += 1) {
        const first = FIRST[(seed * 7 + i * 3) % FIRST.length];
        const last = LAST[(seed * 5 + i * 2) % LAST.length];
        roster.push({
            name: `${first} ${last}`,
            className: klass.name,
            gender: i % 2 === 0 ? 'Female' : 'Male',
            admissionNumber: `BIS2026-${String(seed * 100 + i + 1).padStart(3, '0')}`,
            rollNum: i + 1,
        });
    }
    return roster.sort((a, b) => a.rollNum - b.rollNum);
};
