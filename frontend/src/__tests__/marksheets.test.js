import '@testing-library/jest-dom';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { ThemeProvider } from '../theme';
import Marksheets from '../pages/Marksheets';
import {
    academicYearApi, assignmentApi, classApi, marksheetApi, studentApi, studentRequestApi, termApi,
} from '../api/endpoints';
import { useAuth } from '../auth/AuthContext';

jest.mock('../auth/AuthContext', () => ({ useAuth: jest.fn() }));

jest.mock('../api/endpoints', () => ({
    academicYearApi: { list: jest.fn() },
    assignmentApi: { subjects: jest.fn() },
    classApi: { list: jest.fn() },
    marksheetApi: {
        list: jest.fn(), bulkSave: jest.fn(), remove: jest.fn(), exportCurrentTerm: jest.fn(),
    },
    studentApi: { list: jest.fn() },
    studentRequestApi: { list: jest.fn() },
    termApi: { list: jest.fn() },
}));

jest.mock('../utils/marksheetExport', () => ({
    marksheetExportFilename: jest.fn(() => 'Teacher-Marksheets.xlsx'),
    downloadMarksheetWorkbook: jest.fn(),
    createMarksheetZip: jest.fn().mockResolvedValue('excel-zip'),
    downloadMarksheetBlob: jest.fn(),
}));

const exportTools = jest.requireMock('../utils/marksheetExport');
const USER_ID = 'teacher-bethelhem';
const CLASS_ID = 'year-4-magenta';
const SUBJECT_ID = 'subject-mat';
const TERM_1 = 'term-1';
const TERM_2 = 'term-2';

const classAssignment = {
    id: 'seat-mat',
    classId: CLASS_ID,
    subjectId: SUBJECT_ID,
    // Handover left this assignment pointing at the previous main teacher.
    teacherId: 'previous-main-teacher',
    sessionsPerWeek: 6,
    class: { id: CLASS_ID, name: 'Year 4 - Magenta' },
    subject: { id: SUBJECT_ID, code: 'MAT', name: 'Mathematics' },
    teacher: { id: 'previous-main-teacher', name: 'Previous main teacher' },
};

const classAssignments = [
    classAssignment,
    {
        id: 'seat-sci', classId: CLASS_ID, subjectId: 'subject-sci', teacherId: 'previous-main-teacher',
        class: { id: CLASS_ID, name: 'Year 4 - Magenta' },
        subject: { id: 'subject-sci', code: 'SCI', name: 'Science' },
    },
    {
        id: 'seat-gls', classId: CLASS_ID, subjectId: 'subject-gls', teacherId: 'previous-main-teacher',
        class: { id: CLASS_ID, name: 'Year 4 - Magenta' },
        subject: { id: 'subject-gls', code: 'GLS', name: 'Global Citizenship' },
    },
];

const renderPage = () => render(
    <ThemeProvider>
        <BrowserRouter>
            <Marksheets />
        </BrowserRouter>
    </ThemeProvider>,
);

beforeEach(() => {
    jest.clearAllMocks();
    exportTools.marksheetExportFilename.mockReturnValue('Teacher-Marksheets.xlsx');
    exportTools.createMarksheetZip.mockResolvedValue('excel-zip');
    useAuth.mockReturnValue({
        user: { id: USER_ID, name: 'Bethelhem Girma', role: 'main_teacher' },
        isAdmin: false,
    });
    assignmentApi.subjects.mockResolvedValue({ assignments: classAssignments });
    classApi.list.mockResolvedValue([{
        id: CLASS_ID,
        name: 'Year 4 - Magenta',
        mainTeacher: { id: USER_ID, name: 'Bethelhem Girma' },
    }]);
    academicYearApi.list.mockResolvedValue([
        { id: 'year-1', name: '2025/2026', isCurrent: false },
        { id: 'year-2', name: '2026/2027', isCurrent: true },
    ]);
    termApi.list.mockResolvedValue([
        { id: TERM_1, name: 'Term 1', termIndex: 1, academicYearId: 'year-1', isCurrent: false },
        { id: TERM_2, name: 'Term 2', termIndex: 2, academicYearId: 'year-2', isCurrent: true },
    ]);
    studentApi.list.mockResolvedValue([{
        id: 'student-1', name: 'Test Pupil', admissionNo: 'MAG-001', rollNum: 1,
    }]);
    studentRequestApi.list.mockResolvedValue([]);
    marksheetApi.exportCurrentTerm.mockResolvedValue({
        classes: [{ id: CLASS_ID, name: 'Year 4 - Magenta' }],
        academicYear: { id: 'year-2', name: '2026/2027' },
        term: { id: TERM_2, name: 'Term 2' },
    });
    marksheetApi.list.mockResolvedValue([{
        id: 'saved-term-1',
        termId: TERM_1,
        term: { id: TERM_1, name: 'Term 1', termIndex: 1 },
        marks: 84,
        maxMarks: 100,
        percentage: 84,
        grade: 'A',
        student: { id: 'student-1', name: 'Test Pupil' },
        subject: { id: SUBJECT_ID, code: 'MAT', name: 'Mathematics' },
    }]);
});

describe('Marksheets term visibility', () => {
    test('explains when marks are saved in another term and displays them when that term is selected', async () => {
        renderPage();

        const subjectSelect = await screen.findByTestId('marksheet-subject-select');
        fireEvent.mouseDown(within(subjectSelect).getByRole('combobox'));
        expect((await screen.findAllByRole('option')).map((option) => option.textContent))
            .toEqual(['Global Citizenship', 'Mathematics', 'Science']);
        fireEvent.click(screen.getByRole('option', { name: 'Mathematics' }));

        expect(await screen.findByTestId('marksheet-other-term-notice'))
            .toHaveTextContent('No marks are saved for Mathematics in Term 2 (2026/2027)');
        expect(screen.getByTestId('marksheet-other-term-notice'))
            .toHaveTextContent('Term 1 (2025/2026) (1 result)');
        expect(marksheetApi.list).toHaveBeenCalledWith({ classId: CLASS_ID, subjectId: SUBJECT_ID });

        const termSelect = screen.getByTestId('marksheet-term-select');
        fireEvent.mouseDown(within(termSelect).getByRole('combobox'));
        fireEvent.click(await screen.findByRole('option', { name: 'Term 1 · 2025/2026' }));

        await waitFor(() => expect(screen.queryByTestId('marksheet-other-term-notice')).not.toBeInTheDocument());
        await waitFor(() => expect(screen.getAllByRole('spinbutton')[0]).toHaveValue(84));
    });
});

describe('admin marksheet exports', () => {
    test('places the download control with the filters and exports the selected subject plus both bulk formats', async () => {
        useAuth.mockReturnValue({
            user: { id: 'admin-user', name: 'Admin', role: 'admin' },
            isAdmin: true,
        });
        renderPage();

        const filters = await screen.findByTestId('marksheets-filter-card');
        const downloadButton = within(filters).getByTestId('marksheets-download-button');
        expect(downloadButton).toBeVisible();

        const subjectSelect = within(filters).getByTestId('marksheet-subject-select');
        fireEvent.mouseDown(within(subjectSelect).getByRole('combobox'));
        fireEvent.click(await screen.findByRole('option', { name: 'Mathematics' }));

        fireEvent.click(downloadButton);
        expect(await screen.findByTestId('marksheets-export-current-term'))
            .toHaveTextContent('Current term · Term 2 · 2026/2027');
        await waitFor(() => expect(screen.getByTestId('marksheets-export-selected-subject')).toBeEnabled());
        expect(screen.getByTestId('marksheets-export-all-workbook')).toBeEnabled();
        expect(screen.getByTestId('marksheets-export-all-zip')).toBeEnabled();

        fireEvent.click(screen.getByTestId('marksheets-export-selected-subject'));

        await waitFor(() => expect(marksheetApi.exportCurrentTerm).toHaveBeenCalledWith({
            termId: TERM_2,
            classId: CLASS_ID,
            subjectId: SUBJECT_ID,
        }));
        expect(exportTools.marksheetExportFilename).toHaveBeenCalledWith(
            expect.objectContaining({ classes: [{ id: CLASS_ID, name: 'Year 4 - Magenta' }] }),
            { id: CLASS_ID, name: 'Year 4 - Magenta' },
            'xlsx',
            expect.objectContaining({ id: SUBJECT_ID, name: 'Mathematics' }),
        );
        expect(exportTools.downloadMarksheetWorkbook).toHaveBeenCalledWith(
            expect.objectContaining({ classes: [{ id: CLASS_ID, name: 'Year 4 - Magenta' }] }),
            'Teacher-Marksheets.xlsx',
        );
    });

    test('does not expose exports to teachers', () => {
        renderPage();
        expect(screen.queryByTestId('marksheets-download-button')).not.toBeInTheDocument();
    });
});
