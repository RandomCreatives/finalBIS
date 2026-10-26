export const DEV_PREVIEW_TOKEN = '__dev_preview__';

export const DEV_PREVIEW_USER = {
    id: 'preview-teacher-y4m',
    name: 'Ms. Bethelhem G',
    email: 'bethelhem.g@bisnoc.local',
    role: 'main_teacher',
};

const PREVIEW_STUDENTS = [
    {
        id: 'stu-1',
        rollNum: 1,
        admissionNo: 'BIS-2401',
        name: 'Amanuel Dawit',
        specialNeeds: false,
        guardianName: 'Dawit Bekele',
        guardianPhone: '+251911223344',
        class: { id: 'cls-y4m', name: 'Year 4 - Magenta' },
    },
    {
        id: 'stu-2',
        rollNum: 2,
        admissionNo: 'BIS-2402',
        name: 'Bethania Samuel',
        specialNeeds: false,
        guardianName: 'Samuel Tadesse',
        guardianPhone: '+251911445566',
        class: { id: 'cls-y4m', name: 'Year 4 - Magenta' },
    },
    {
        id: 'stu-3',
        rollNum: 3,
        admissionNo: 'BIS-2403',
        name: 'Christian Mekonnen',
        specialNeeds: true,
        guardianName: 'Mekonnen Hailu',
        guardianPhone: '+251912334455',
        class: { id: 'cls-y4m', name: 'Year 4 - Magenta' },
    },
    {
        id: 'stu-4',
        rollNum: 4,
        admissionNo: 'BIS-2404',
        name: 'Eliana Girma',
        specialNeeds: false,
        guardianName: 'Hanna Girma',
        guardianPhone: '+251913667788',
        class: { id: 'cls-y4m', name: 'Year 4 - Magenta' },
    },
    {
        id: 'stu-5',
        rollNum: 5,
        admissionNo: 'BIS-2405',
        name: 'Nathaniel Yohannes',
        specialNeeds: false,
        guardianName: 'Yohannes Kebede',
        guardianPhone: '+251911889900',
        class: { id: 'cls-y4m', name: 'Year 4 - Magenta' },
    },
    {
        id: 'stu-6',
        rollNum: 6,
        admissionNo: 'BIS-2406',
        name: 'Soliyana Tesfaye',
        specialNeeds: true,
        guardianName: 'Meron Tesfaye',
        guardianPhone: '+251922112233',
        class: { id: 'cls-y4m', name: 'Year 4 - Magenta' },
    },
];

let savedAttendance: Record<string, string> = {
    'stu-1': 'present',
    'stu-2': 'present',
    'stu-3': 'late',
};

export function handleDevPreviewRequest(path: string, method: string, body?: any): any {
    if (path === '/auth/me') {
        return { user: DEV_PREVIEW_USER };
    }
    if (path === '/dashboard/me') {
        return {
            role: 'main_teacher',
            date: 'Mon, 26 Oct 2026',
            term: { name: 'Term 1', currentWeek: 8 },
            healthScore: 92,
            openItems: 1,
            flows: [
                {
                    id: 'attendance',
                    title: 'Morning Register · Year 4 - Magenta',
                    metric: `${Object.keys(savedAttendance).length}/${PREVIEW_STUDENTS.length} marked`,
                    progress: Math.round((Object.keys(savedAttendance).length / PREVIEW_STUDENTS.length) * 100),
                    nextAction: 'Tap to finish marking today’s homeroom attendance.',
                },
                {
                    id: 'timetable',
                    title: 'Today’s Lessons',
                    metric: '5 periods',
                    progress: 100,
                    nextAction: 'Next: Mathematics · 09:00 in Room B-204',
                },
                {
                    id: 'marks',
                    title: 'Term 1 Continuous Assessment',
                    metric: '86% entered',
                    progress: 86,
                    nextAction: 'Review recorded English & Maths scores.',
                },
            ],
        };
    }
    if (path.startsWith('/timetable/my-week')) {
        return {
            slots: [
                { id: 'sl-1', dayOfWeek: 1, startsAt: '08:15:00', endsAt: '09:00:00', subject: { name: 'English Literacy' }, class: { name: 'Year 4 - Magenta' }, room: 'B-204' },
                { id: 'sl-2', dayOfWeek: 1, startsAt: '09:05:00', endsAt: '09:50:00', subject: { name: 'Mathematics' }, class: { name: 'Year 4 - Magenta' }, room: 'B-204' },
                { id: 'sl-3', dayOfWeek: 1, startsAt: '10:20:00', endsAt: '11:05:00', subject: { name: 'Science Lab' }, class: { name: 'Year 4 - Magenta' }, room: 'Lab 1' },
                { id: 'sl-4', dayOfWeek: 2, startsAt: '08:15:00', endsAt: '09:00:00', subject: { name: 'Mathematics' }, class: { name: 'Year 4 - Magenta' }, room: 'B-204' },
                { id: 'sl-5', dayOfWeek: 3, startsAt: '11:10:00', endsAt: '11:55:00', subject: { name: 'Global Perspectives' }, class: { name: 'Year 4 - Magenta' }, room: 'B-204' },
                { id: 'sl-6', dayOfWeek: 4, startsAt: '09:05:00', endsAt: '09:50:00', subject: { name: 'English Literacy' }, class: { name: 'Year 4 - Magenta' }, room: 'B-204' },
                { id: 'sl-7', dayOfWeek: 5, startsAt: '08:15:00', endsAt: '09:00:00', subject: { name: 'Homeroom & Assembly' }, class: { name: 'Year 4 - Magenta' }, room: 'Main Hall' },
            ],
        };
    }
    if (path.startsWith('/classes')) {
        return {
            academicYearId: 'yr-2026',
            classes: [
                {
                    id: 'cls-y4m',
                    name: 'Year 4 - Magenta',
                    yearLevel: 4,
                    capacity: 30,
                    studentCount: PREVIEW_STUDENTS.length,
                    mainTeacher: DEV_PREVIEW_USER,
                    assistantTeacher: null,
                },
            ],
        };
    }
    if (path.startsWith('/students')) {
        return { students: PREVIEW_STUDENTS };
    }
    if (path.startsWith('/attendance') && method === 'GET') {
        return {
            attendance: Object.entries(savedAttendance).map(([studentId, status], i) => ({
                id: `att-${i}`,
                status,
                student: { id: studentId },
            })),
        };
    }
    if (path === '/attendance' && method === 'POST') {
        const next: Record<string, string> = { ...savedAttendance };
        for (const r of body?.records || []) {
            next[r.studentId] = r.status;
        }
        savedAttendance = next;
        return { message: 'Saved', count: (body?.records || []).length };
    }
    if (path.startsWith('/marksheets')) {
        return {
            marksheets: [
                { id: 'mk-1', student: { name: 'Amanuel Dawit' }, subject: { name: 'Mathematics' }, term: { name: 'Term 1' }, marks: 94, maxMarks: 100, percentage: 94, grade: 'A+' },
                { id: 'mk-2', student: { name: 'Bethania Samuel' }, subject: { name: 'English Literacy' }, term: { name: 'Term 1' }, marks: 88, maxMarks: 100, percentage: 88, grade: 'A' },
                { id: 'mk-3', student: { name: 'Christian Mekonnen' }, subject: { name: 'Science' }, term: { name: 'Term 1' }, marks: 79, maxMarks: 100, percentage: 79, grade: 'B+' },
                { id: 'mk-4', student: { name: 'Eliana Girma' }, subject: { name: 'Mathematics' }, term: { name: 'Term 1' }, marks: 91, maxMarks: 100, percentage: 91, grade: 'A' },
                { id: 'mk-5', student: { name: 'Soliyana Tesfaye' }, subject: { name: 'English Literacy' }, term: { name: 'Term 1' }, marks: 68, maxMarks: 100, percentage: 68, grade: 'C+' },
            ],
        };
    }
    return {};
}
