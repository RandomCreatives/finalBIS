import * as XLSX from 'xlsx';
import JSZip from 'jszip';
import {
    createMarksheetWorkbook,
    createMarksheetZip,
    markSheetRowsForClass,
    marksheetExportFilename,
} from '../marksheetExport';

const klass = {
    id: 'class-magenta',
    name: 'Year 4 - Magenta',
    mainTeacher: { id: 'main-1', name: 'Bethelhem Girma' },
};

const exportData = {
    academicYear: { id: 'year-1', name: '2026/2027' },
    term: { id: 'term-1', name: 'Term 1' },
    classes: [klass],
    assignments: [
        {
            classId: klass.id,
            subjectId: 'subject-mat',
            subject: { id: 'subject-mat', code: 'MAT', name: 'Mathematics', taughtBy: 'main_teacher' },
            teacher: { id: 'previous-main', name: 'Previous main teacher' },
        },
        {
            classId: klass.id,
            subjectId: 'subject-eng',
            subject: { id: 'subject-eng', code: 'ENG', name: 'English', taughtBy: 'subject_teacher' },
            teacher: { id: 'english-1', name: 'Michael Okwara' },
        },
    ],
    students: [
        { id: 'student-1', classId: klass.id, rollNum: 1, admissionNo: 'MAG-001', name: 'Pupil One' },
        { id: 'student-2', classId: klass.id, rollNum: 2, admissionNo: 'MAG-002', name: 'Pupil Two' },
    ],
    assessments: [
        {
            id: 'quiz-1', classId: klass.id, subjectId: 'subject-mat', label: 'Quiz 1',
            maxMarks: 10, sortOrder: 1, subject: { id: 'subject-mat', code: 'MAT', name: 'Mathematics', taughtBy: 'main_teacher' },
            marks: [
                { studentId: 'student-1', marks: 8 },
                { studentId: 'student-2', marks: 0 },
            ],
        },
        {
            id: 'classwork-1', classId: klass.id, subjectId: 'subject-mat', label: 'Classwork',
            maxMarks: 20, sortOrder: 2, subject: { id: 'subject-mat', code: 'MAT', name: 'Mathematics', taughtBy: 'main_teacher' },
            marks: [{ studentId: 'student-1', marks: 15 }],
        },
    ],
    finals: [
        {
            id: 'final-1', classId: klass.id, subjectId: 'subject-mat', studentId: 'student-1',
            marks: 23, maxMarks: 30, percentage: 76.67, grade: 'B+',
            subject: { id: 'subject-mat', code: 'MAT', name: 'Mathematics', taughtBy: 'main_teacher' },
        },
    ],
};

describe('teacher marksheet Excel export', () => {
    test('includes teacher summary, coverage, raw assessment columns and saved final marks', () => {
        const rows = markSheetRowsForClass(exportData, klass);
        expect(rows[0]).toEqual(['Teacher marksheet summary — Year 4 - Magenta']);
        expect(rows).toContainEqual([
            'Mathematics', 'MAT', 'Bethelhem Girma', 2, 2, 1, 3, 4, '3/4 (75%)',
        ]);
        expect(rows).toContainEqual([
            'English', 'ENG', 'Michael Okwara', 0, 0, 0, 0, 0, '—',
        ]);
        expect(rows).toContainEqual([
            'Subject', 'Code', 'Teacher', 'Assessment columns', 'Students with any marks',
            'Final marks saved', 'Assessment entries', 'Expected entries', 'Assessment mark-entry coverage',
        ]);
        expect(rows).toContainEqual([
            'Roll', 'Admission No.', 'Student', 'Quiz 1 (/10)', 'Classwork (/20)',
            'Final marks', 'Final max', 'Final %', 'Grade',
        ]);
        expect(rows).toContainEqual([
            'Mark-entry coverage', '', '', '2/2 (100%)', '1/2 (50%)',
            'Finals: 1/2 (50%)', '', '', '',
        ]);
        expect(rows).toContainEqual([
            1, 'MAG-001', 'Pupil One', 8, 15, 23, 30, 76.67, 'B+',
        ]);
        // A saved zero is still a mark; its single entered assessment yields 0/10.
        expect(rows).toContainEqual([
            2, 'MAG-002', 'Pupil Two', 0, '', 0, 10, 0, 'F',
        ]);
    });

    test('creates one worksheet per class and uniquely names sheets', () => {
        const secondClass = { ...klass, id: 'class-blue', name: 'Year 4 - Blue' };
        const workbook = createMarksheetWorkbook({
            ...exportData,
            classes: [klass, secondClass],
        });
        expect(workbook.SheetNames).toEqual(['Year 4 - Magenta', 'Year 4 - Blue']);

        const parsed = XLSX.utils.sheet_to_json(workbook.Sheets['Year 4 - Magenta'], { header: 1 });
        expect(parsed[0]).toEqual(['Teacher marksheet summary — Year 4 - Magenta']);
        expect(workbook.Sheets['Year 4 - Magenta']['!merges']).toHaveLength(1);
    });

    test('offers per-class Excel files in a ZIP and uses readable names', async () => {
        const blob = await createMarksheetZip(exportData);
        const zip = await JSZip.loadAsync(blob);
        const filename = 'Teacher-Marksheets_Term-1_2026-2027_Year-4-Magenta.xlsx';
        expect(Object.keys(zip.files)).toEqual([filename]);
        const bytes = await zip.file(filename).async('arraybuffer');
        const workbook = XLSX.read(bytes, { type: 'array' });
        expect(workbook.SheetNames).toEqual(['Year 4 - Magenta']);
        expect(marksheetExportFilename(exportData, null, 'zip'))
            .toBe('Teacher-Marksheets_Term-1_2026-2027_All-Classes.zip');
        expect(marksheetExportFilename(exportData, klass, 'xlsx', { name: 'Mathematics' }))
            .toBe('Teacher-Marksheets_Term-1_2026-2027_Year-4-Magenta_Mathematics.xlsx');
    });
});
