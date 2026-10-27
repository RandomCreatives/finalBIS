export const DEV_PREVIEW_MAIN_TOKEN = '__dev_preview_main__';
export const DEV_PREVIEW_SUBJECT_TOKEN = '__dev_preview_subject__';

export const DEV_PREVIEW_MAIN_USER = {
    id: 'preview-teacher-y4m',
    name: 'Ms. Bethelhem G',
    email: 'bethelhem.g@bisnoc.local',
    role: 'main_teacher',
};

export const DEV_PREVIEW_SUBJECT_USER = {
    id: 'preview-teacher-fra',
    name: 'Mr. Michael',
    email: 'mr.michael@bisnoc.local',
    role: 'subject_teacher',
};

const CLASSES: Record<string, { id: string; name: string; yearLevel: number }> = {
    'cls-y3b': { id: 'cls-y3b', name: 'Year 3 - Blue', yearLevel: 3 },
    'cls-y4m': { id: 'cls-y4m', name: 'Year 4 - Magenta', yearLevel: 4 },
    'cls-y5b': { id: 'cls-y5b', name: 'Year 5 - Blue', yearLevel: 5 },
};

const STUDENTS_BY_CLASS: Record<string, any[]> = {
    'cls-y3b': [
        { id: 's-31', rollNum: 1, admissionNo: 'BIS-2301', name: 'Abigail Yohannes', specialNeeds: false, guardianName: 'Yohannes T.', guardianPhone: '+251911101010', class: CLASSES['cls-y3b'] },
        { id: 's-32', rollNum: 2, admissionNo: 'BIS-2302', name: 'Daniel Kassahun', specialNeeds: false, guardianName: 'Kassahun M.', guardianPhone: '+251911202020', class: CLASSES['cls-y3b'] },
        { id: 's-33', rollNum: 3, admissionNo: 'BIS-2303', name: 'Lydia Solomon', specialNeeds: true, guardianName: 'Solomon A.', guardianPhone: '+251911303030', class: CLASSES['cls-y3b'] },
    ],
    'cls-y4m': [
        { id: 'stu-1', rollNum: 1, admissionNo: 'BIS-2401', name: 'Amanuel Dawit', specialNeeds: false, guardianName: 'Dawit Bekele', guardianPhone: '+251911223344', class: CLASSES['cls-y4m'] },
        { id: 'stu-2', rollNum: 2, admissionNo: 'BIS-2402', name: 'Bethania Samuel', specialNeeds: false, guardianName: 'Samuel Tadesse', guardianPhone: '+251911445566', class: CLASSES['cls-y4m'] },
        { id: 'stu-3', rollNum: 3, admissionNo: 'BIS-2403', name: 'Christian Mekonnen', specialNeeds: true, guardianName: 'Mekonnen Hailu', guardianPhone: '+251912334455', class: CLASSES['cls-y4m'] },
        { id: 'stu-4', rollNum: 4, admissionNo: 'BIS-2404', name: 'Eliana Girma', specialNeeds: false, guardianName: 'Hanna Girma', guardianPhone: '+251913667788', class: CLASSES['cls-y4m'] },
    ],
    'cls-y5b': [
        { id: 's-51', rollNum: 1, admissionNo: 'BIS-2501', name: 'Kaleb Dereje', specialNeeds: false, guardianName: 'Dereje W.', guardianPhone: '+251911505050', class: CLASSES['cls-y5b'] },
        { id: 's-52', rollNum: 2, admissionNo: 'BIS-2502', name: 'Naomi Fikru', specialNeeds: false, guardianName: 'Fikru G.', guardianPhone: '+251911606060', class: CLASSES['cls-y5b'] },
        { id: 's-53', rollNum: 3, admissionNo: 'BIS-2503', name: 'Samuel Birhanu', specialNeeds: false, guardianName: 'Birhanu K.', guardianPhone: '+251911707070', class: CLASSES['cls-y5b'] },
    ],
};

let savedAttendance: Record<string, string> = {
    'stu-1': 'present',
    'stu-2': 'present',
    'stu-3': 'late',
};

const assessmentsStore: Record<string, { id: string; label: string; maxMarks: number; marks: Record<string, number> }[]> = {
    'cls-y4m|subj-fra': [
        { id: 'as-fra-1', label: 'Quiz 1', maxMarks: 10, marks: { 'stu-1': 9, 'stu-2': 8, 'stu-3': 7 } },
        { id: 'as-fra-2', label: 'Oral', maxMarks: 20, marks: { 'stu-1': 18, 'stu-2': 19 } },
    ],
    'cls-y3b|subj-fra': [
        { id: 'as-fra-3', label: 'Vocab Quiz', maxMarks: 10, marks: { 's-31': 10, 's-32': 8 } },
    ],
    'cls-y4m|subj-mat': [
        { id: 'as-mat-1', label: 'Quiz 1', maxMarks: 20, marks: { 'stu-1': 19, 'stu-2': 17, 'stu-3': 16 } },
    ],
};

export function isDevPreviewToken(token: string | null): boolean {
    return token === DEV_PREVIEW_MAIN_TOKEN || token === DEV_PREVIEW_SUBJECT_TOKEN;
}

export function handleDevPreviewRequest(token: string, path: string, method: string, body?: any): any {
    const isSubj = token === DEV_PREVIEW_SUBJECT_TOKEN;
    const currentUser = isSubj ? DEV_PREVIEW_SUBJECT_USER : DEV_PREVIEW_MAIN_USER;

    if (path === '/auth/me') {
        return { user: currentUser };
    }
    if (path === '/terms/current') {
        return { term: { id: 'term-1', name: 'Term 1', isCurrent: true } };
    }
    if (path === '/dashboard/me') {
        if (isSubj) {
            return {
                term: { id: 'term-1', name: 'Term 1', currentWeek: 8 },
                homerooms: [],
                teachingSubjects: [
                    { id: 'a-1', sessionsPerWeek: 2, class: CLASSES['cls-y3b'], subject: { id: 'subj-fra', name: 'French', code: 'FRA' } },
                    { id: 'a-2', sessionsPerWeek: 2, class: CLASSES['cls-y4m'], subject: { id: 'subj-fra', name: 'French', code: 'FRA' } },
                    { id: 'a-3', sessionsPerWeek: 2, class: CLASSES['cls-y5b'], subject: { id: 'subj-fra', name: 'French', code: 'FRA' } },
                ],
                todaySlots: [
                    { id: 'ts-1', startsAt: '09:05:00', endsAt: '09:50:00', room: 'B-204', class: CLASSES['cls-y4m'], subject: { id: 'subj-fra', name: 'French', code: 'FRA' } },
                    { id: 'ts-2', startsAt: '11:10:00', endsAt: '11:55:00', room: 'B-301', class: CLASSES['cls-y5b'], subject: { id: 'subj-fra', name: 'French', code: 'FRA' } },
                ],
                openTasks: [],
                attendanceOutstanding: [],
            };
        }
        return {
            term: { id: 'term-1', name: 'Term 1', currentWeek: 8 },
            homerooms: [{ position: 'main', class: CLASSES['cls-y4m'] }],
            teachingSubjects: [
                { id: 'm-1', sessionsPerWeek: 5, class: CLASSES['cls-y4m'], subject: { id: 'subj-mat', name: 'Mathematics', code: 'MAT' } },
                { id: 'm-2', sessionsPerWeek: 4, class: CLASSES['cls-y4m'], subject: { id: 'subj-sci', name: 'Science', code: 'SCI' } },
                { id: 'm-3', sessionsPerWeek: 2, class: CLASSES['cls-y4m'], subject: { id: 'subj-gls', name: 'Global Citizenship', code: 'GLS' } },
            ],
            todaySlots: [
                { id: 'sl-1', startsAt: '08:15:00', endsAt: '09:00:00', room: 'B-204', class: CLASSES['cls-y4m'], subject: { id: 'subj-mat', name: 'Mathematics', code: 'MAT' } },
                { id: 'sl-2', startsAt: '10:20:00', endsAt: '11:05:00', room: 'Lab 1', class: CLASSES['cls-y4m'], subject: { id: 'subj-sci', name: 'Science', code: 'SCI' } },
            ],
            openTasks: [{ id: 'tk-1', title: 'Submit Week 8 lesson plan', dueOn: '2026-10-30', isOverdue: false }],
            attendanceOutstanding: [],
        };
    }
    if (path.startsWith('/assignments/subjects')) {
        if (isSubj) {
            return {
                assignments: [
                    { id: 'a-1', classId: 'cls-y3b', subjectId: 'subj-fra', teacherId: currentUser.id, sessionsPerWeek: 2, class: CLASSES['cls-y3b'], subject: { id: 'subj-fra', name: 'French', code: 'FRA' } },
                    { id: 'a-2', classId: 'cls-y4m', subjectId: 'subj-fra', teacherId: currentUser.id, sessionsPerWeek: 2, class: CLASSES['cls-y4m'], subject: { id: 'subj-fra', name: 'French', code: 'FRA' } },
                    { id: 'a-3', classId: 'cls-y5b', subjectId: 'subj-fra', teacherId: currentUser.id, sessionsPerWeek: 2, class: CLASSES['cls-y5b'], subject: { id: 'subj-fra', name: 'French', code: 'FRA' } },
                ],
            };
        }
        return {
            assignments: [
                { id: 'm-1', classId: 'cls-y4m', subjectId: 'subj-mat', teacherId: currentUser.id, sessionsPerWeek: 5, class: CLASSES['cls-y4m'], subject: { id: 'subj-mat', name: 'Mathematics', code: 'MAT' } },
                { id: 'm-2', classId: 'cls-y4m', subjectId: 'subj-sci', teacherId: currentUser.id, sessionsPerWeek: 4, class: CLASSES['cls-y4m'], subject: { id: 'subj-sci', name: 'Science', code: 'SCI' } },
                { id: 'm-3', classId: 'cls-y4m', subjectId: 'subj-gls', teacherId: currentUser.id, sessionsPerWeek: 2, class: CLASSES['cls-y4m'], subject: { id: 'subj-gls', name: 'Global Citizenship', code: 'GLS' } },
            ],
        };
    }
    if (path.startsWith('/timetable/my-week')) {
        return {
            slots: isSubj
                ? [
                      { id: 'f-1', dayOfWeek: 1, startsAt: '09:05:00', endsAt: '09:50:00', subject: { name: 'French' }, class: CLASSES['cls-y4m'], room: 'B-204' },
                      { id: 'f-2', dayOfWeek: 2, startsAt: '10:20:00', endsAt: '11:05:00', subject: { name: 'French' }, class: CLASSES['cls-y3b'], room: 'B-102' },
                      { id: 'f-3', dayOfWeek: 3, startsAt: '11:10:00', endsAt: '11:55:00', subject: { name: 'French' }, class: CLASSES['cls-y5b'], room: 'B-301' },
                      { id: 'f-4', dayOfWeek: 4, startsAt: '09:05:00', endsAt: '09:50:00', subject: { name: 'French' }, class: CLASSES['cls-y4m'], room: 'B-204' },
                  ]
                : [
                      { id: 'sl-1', dayOfWeek: 1, startsAt: '08:15:00', endsAt: '09:00:00', subject: { name: 'Mathematics' }, class: CLASSES['cls-y4m'], room: 'B-204' },
                      { id: 'sl-2', dayOfWeek: 2, startsAt: '10:20:00', endsAt: '11:05:00', subject: { name: 'Science' }, class: CLASSES['cls-y4m'], room: 'Lab 1' },
                      { id: 'sl-3', dayOfWeek: 3, startsAt: '11:10:00', endsAt: '11:55:00', subject: { name: 'Global Citizenship' }, class: CLASSES['cls-y4m'], room: 'B-204' },
                  ],
        };
    }
    if (path.startsWith('/classes')) {
        return {
            academicYearId: 'yr-2026',
            classes: isSubj
                ? [CLASSES['cls-y3b'], CLASSES['cls-y4m'], CLASSES['cls-y5b']]
                : [{ ...CLASSES['cls-y4m'], capacity: 30, studentCount: 4, mainTeacher: currentUser }],
        };
    }
    if (path.startsWith('/students')) {
        const u = new URL(`http://x${path}`);
        const cid = u.searchParams.get('classId');
        if (cid && STUDENTS_BY_CLASS[cid]) return { students: STUDENTS_BY_CLASS[cid] };
        return {
            students: isSubj
                ? [...STUDENTS_BY_CLASS['cls-y3b'], ...STUDENTS_BY_CLASS['cls-y4m'], ...STUDENTS_BY_CLASS['cls-y5b']]
                : STUDENTS_BY_CLASS['cls-y4m'],
        };
    }
    if (path.startsWith('/assessments') && method === 'GET') {
        const u = new URL(`http://x${path}`);
        const key = `${u.searchParams.get('classId')}|${u.searchParams.get('subjectId')}`;
        return { assessments: assessmentsStore[key] || [] };
    }
    if (path === '/assessments' && method === 'POST') {
        const key = `${body.classId}|${body.subjectId}`;
        const created = {
            id: `as-${Date.now()}`,
            label: body.label,
            maxMarks: Number(body.maxMarks),
            marks: {},
        };
        assessmentsStore[key] = [...(assessmentsStore[key] || []), created];
        return { assessment: created };
    }
    if (path === '/assessments/marks/bulk' && method === 'POST') {
        const key = `${body.classId}|${body.subjectId}`;
        const cols = assessmentsStore[key] || [];
        for (const entry of body.entries || []) {
            const col = cols.find((c) => c.id === entry.assessmentId);
            if (col) col.marks[entry.studentId] = Number(entry.marks);
        }
        return { saved: (body.entries || []).length };
    }
    if (path.startsWith('/assessments/') && method === 'DELETE') {
        const id = path.split('/').pop();
        for (const k of Object.keys(assessmentsStore)) {
            assessmentsStore[k] = assessmentsStore[k].filter((c) => c.id !== id);
        }
        return { message: 'Deleted' };
    }
    if (path.startsWith('/marksheets')) {
        return { marksheets: [] };
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
        const next = { ...savedAttendance };
        for (const r of body?.records || []) next[r.studentId] = r.status;
        savedAttendance = next;
        return { message: 'Saved', count: (body?.records || []).length };
    }
    return {};
}
