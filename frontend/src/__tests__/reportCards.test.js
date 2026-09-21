import '@testing-library/jest-dom';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { ThemeProvider } from '../theme';
import ReportCards from '../pages/ReportCards';
import {
    academicYearApi, classApi, marksheetApi, studentApi, subjectApi, termApi,
} from '../api/endpoints';
import { useAuth } from '../auth/AuthContext';
import { buildReportCards, gradeFor } from '../utils/reportCards';

jest.mock('../auth/AuthContext', () => ({
    useAuth: jest.fn(),
}));

jest.mock('../api/endpoints', () => ({
    academicYearApi: { list: jest.fn() },
    classApi: { list: jest.fn() },
    marksheetApi: { list: jest.fn() },
    studentApi: { list: jest.fn() },
    subjectApi: { list: jest.fn() },
    termApi: { list: jest.fn(), current: jest.fn() },
}));

const CLASS_A = 'class-a';
const TERM_1 = 'term-1';

const STUDENTS = [
    { id: 'st-1', name: 'Abel Tesfaye', admissionNo: 'BIS-101', rollNum: 2 },
    { id: 'st-2', name: 'Bethlehem Adera', admissionNo: 'BIS-102', rollNum: 1 },
];

const SUBJECTS = [
    { id: 'sub-eng', name: 'English', code: 'ENG' },
    { id: 'sub-amh', name: 'Amharic', code: 'AMH' },
];

const MARKSHEETS = [
    {
        id: 'm1', marks: 85, maxMarks: 100, percentage: 85, grade: 'A',
        student: { id: 'st-1' }, subject: { id: 'sub-eng' },
    },
    {
        id: 'm2', marks: 70, maxMarks: 100, percentage: 70, grade: 'B+',
        student: { id: 'st-1' }, subject: { id: 'sub-amh' },
    },
    {
        id: 'm3', marks: 40, maxMarks: 100, percentage: 40, grade: 'D',
        student: { id: 'st-2' }, subject: { id: 'sub-eng' },
    },
];

const renderPage = () => {
    useAuth.mockReturnValue({ user: { id: 'u-admin', name: 'Mr. Mike', role: 'admin' } });
    return render(
        <ThemeProvider>
            <BrowserRouter>
                <ReportCards />
            </BrowserRouter>
        </ThemeProvider>,
    );
};

beforeEach(() => {
    jest.clearAllMocks();
    classApi.list.mockResolvedValue([{ id: CLASS_A, name: 'Year 3 - Blue' }]);
    subjectApi.list.mockResolvedValue(SUBJECTS);
    studentApi.list.mockResolvedValue(STUDENTS);
    marksheetApi.list.mockResolvedValue(MARKSHEETS);
    termApi.list.mockResolvedValue([{ id: TERM_1, name: 'Term 1', isCurrent: true }]);
    termApi.current.mockResolvedValue({ term: { id: TERM_1, name: 'Term 1' }, currentWeek: 1 });
    academicYearApi.list.mockResolvedValue([{ id: 'yr', name: '2026/2027', isCurrent: true }]);
});

describe('buildReportCards', () => {
    test('groups finals per student, averages on the school scale, roll order wins', () => {
        const cards = buildReportCards(STUDENTS, SUBJECTS, MARKSHEETS);

        // Roll 1 (Bethlehem) first even though she came second in the array.
        expect(cards.map((c) => c.student.id)).toEqual(['st-2', 'st-1']);

        const abel = cards.find((c) => c.student.id === 'st-1');
        expect(abel.subjectsScored).toBe(2);
        expect(abel.average).toBe(77.5);
        expect(abel.overallGrade).toBe('B+');

        // Bethlehem: only English saved — average counts just that one.
        const bethlehem = cards.find((c) => c.student.id === 'st-2');
        expect(bethlehem.subjectsScored).toBe(1);
        expect(bethlehem.average).toBe(40);
        expect(bethlehem.overallGrade).toBe('D');
        // Amharic cell stays blank.
        expect(bethlehem.rows.find((r) => r.subject.id === 'sub-amh').percentage).toBeNull();

        // A student with nothing saved gets no average — never a made-up zero.
        const blank = buildReportCards([{ id: 'st-9', name: 'New pupil' }], SUBJECTS, []);
        expect(blank[0].average).toBeNull();
        expect(blank[0].overallGrade).toBeNull();
    });

    test('the grade scale matches the server', () => {
        expect(gradeFor(95)).toBe('A+');
        expect(gradeFor(84)).toBe('A');
        expect(gradeFor(72)).toBe('B+');
        expect(gradeFor(61)).toBe('B');
        expect(gradeFor(51)).toBe('C');
        expect(gradeFor(42)).toBe('D');
        expect(gradeFor(10)).toBe('F');
    });
});

describe('Report cards page', () => {
    test('asks for a class, then shows the summary grid', async () => {
        renderPage();
        expect(screen.getByText(/Choose a class to build/)).toBeInTheDocument();

        fireEvent.mouseDown(within(screen.getByTestId('report-class-select')).getByRole('combobox'));
        fireEvent.click(await screen.findByRole('option', { name: 'Year 3 - Blue' }));

        const grid = await screen.findByTestId('report-summary-grid');
        expect(within(grid).getByText('Abel Tesfaye')).toBeInTheDocument();
        expect(within(grid).getByText('85% · A')).toBeInTheDocument();
        expect(within(grid).getByText('77.5%')).toBeInTheDocument();
        // marksheets scoped to class + current term
        expect(marksheetApi.list).toHaveBeenCalledWith({ classId: CLASS_A, termId: TERM_1 });
    });

    test('print view renders one sheet per student and the button calls print', async () => {
        const printSpy = jest.spyOn(window, 'print').mockImplementation(() => {});
        renderPage();

        fireEvent.mouseDown(within(screen.getByTestId('report-class-select')).getByRole('combobox'));
        fireEvent.click(await screen.findByRole('option', { name: 'Year 3 - Blue' }));
        await screen.findByTestId('report-summary-grid');

        fireEvent.click(within(screen.getByTestId('report-view-toggle')).getByText('Print cards'));

        const area = await screen.findByTestId('report-print-area');
        expect(within(area).getByTestId('report-card-st-1')).toBeInTheDocument();
        expect(within(area).getByTestId('report-card-st-2')).toBeInTheDocument();

        const abelCard = within(area).getByTestId('report-card-st-1');
        expect(within(abelCard).getByText(/TERM 1 REPORT CARD/)).toBeInTheDocument();
        expect(within(abelCard).getByText(/BIS-101/)).toBeInTheDocument();
        expect(within(abelCard).getByText(/Class teacher's comment/)).toBeInTheDocument();

        fireEvent.click(screen.getByTestId('print-cards-button'));
        expect(printSpy).toHaveBeenCalled();
        printSpy.mockRestore();
    });
});
