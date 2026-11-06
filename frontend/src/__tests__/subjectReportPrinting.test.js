import '@testing-library/jest-dom';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { ThemeProvider } from '../theme';
import SubjectReportPrinting from '../pages/SubjectReportPrinting';
import { settlingInApi, studentApi, termApi } from '../api/endpoints';

jest.mock('../api/endpoints', () => ({
    settlingInApi: { subjectReport: jest.fn() },
    studentApi: { list: jest.fn() },
    termApi: { list: jest.fn(), current: jest.fn() },
}));

const CLASS_ID = 'class-year-3-blue';
const TERM_ID = 'term-1';
const STUDENTS = [
    { id: 'student-1', name: 'Amina Bekele', classId: CLASS_ID, rollNum: 1, admissionNo: 'BIS-301' },
    { id: 'student-2', name: 'Biruk Tadesse', classId: CLASS_ID, rollNum: 2, admissionNo: 'BIS-302' },
];
const ENGLISH_SUBJECT = {
    key: 'english', label: 'English', criteria: [{ id: 'eng-1', text: 'Reads a short passage with understanding.' }],
};
const AMHARIC_SUBJECT = {
    key: 'amharic', label: 'Amharic', criteria: [{ id: 'amh-1', text: 'Recognises Amharic letter forms.' }],
};
const ASSIGNMENTS = [
    {
        class: { id: CLASS_ID, name: 'Year 3 - Blue' },
        subject: { id: 'subject-english', name: 'English', code: 'ENG' },
    },
    {
        class: { id: CLASS_ID, name: 'Year 3 - Blue' },
        subject: { id: 'subject-amharic', name: 'Amharic', code: 'AMH' },
    },
    {
        class: { id: CLASS_ID, name: 'Year 3 - Blue' },
        subject: { id: 'subject-music', name: 'Music', code: 'MUS' },
    },
    {
        class: { id: 'class-year-5-yellow', name: 'Year 5 - Yellow', year_level: 5 },
        subject: { id: 'year-5-english', name: 'English', code: 'ENG' },
    },
];

const makeReport = (subjectKey, studentId) => {
    const subject = subjectKey === 'english' ? ENGLISH_SUBJECT : AMHARIC_SUBJECT;
    const student = STUDENTS.find((entry) => entry.id === studentId);
    return {
        class: { id: CLASS_ID, name: 'Year 3 - Blue', yearLevel: 3 },
        term: { id: TERM_ID, name: 'Term 1', academicYearId: 'academic-year-1' },
        subject: { key: subjectKey, label: subject.label },
        template: {
            yearLevel: 3,
            label: 'Year 3',
            ratingOrder: ['WT', 'WW', 'WA'],
            subjects: [subject],
        },
        student: {
            ...student,
            sections: {
                [subjectKey]: {
                    ratings: { [subject.criteria[0].id]: 'WW' },
                    ratedCount: 1,
                    totalCount: 1,
                },
            },
        },
    };
};

const renderPrinting = () => render(
    <ThemeProvider>
        <SubjectReportPrinting assignments={ASSIGNMENTS} teacherName="English and Amharic Teacher" />
    </ThemeProvider>,
);

beforeEach(() => {
    jest.clearAllMocks();
    window.print = jest.fn();
    studentApi.list.mockResolvedValue(STUDENTS);
    termApi.list.mockResolvedValue([
        { id: TERM_ID, name: 'Term 1', academicYearId: 'academic-year-1' },
        { id: 'term-2', name: 'Term 2', academicYearId: 'academic-year-1' },
        { id: 'old-term', name: 'Term 3', academicYearId: 'academic-year-old' },
    ]);
    termApi.current.mockResolvedValue({
        term: { id: TERM_ID, name: 'Term 1', academicYearId: 'academic-year-1' },
    });
    settlingInApi.subjectReport.mockImplementation((classId, termId, subjectKey, studentId) =>
        Promise.resolve(makeReport(subjectKey, studentId)),
    );
});

describe('Subject teacher individual Settling In printing', () => {
    test('offers only assigned English and Amharic class-subject pairs', async () => {
        renderPrinting();

        await waitFor(() => expect(settlingInApi.subjectReport).toHaveBeenCalled());
        fireEvent.mouseDown(screen.getByRole('combobox', { name: /Assigned class and subject/i }));

        const listbox = screen.getByRole('listbox');
        expect(within(listbox).getByRole('option', { name: 'Year 3 - Blue — English' })).toBeInTheDocument();
        expect(within(listbox).getByRole('option', { name: 'Year 3 - Blue — Amharic' })).toBeInTheDocument();
        expect(within(listbox).queryByRole('option', { name: /Music/ })).not.toBeInTheDocument();
        expect(within(listbox).queryByRole('option', { name: /Year 5/ })).not.toBeInTheDocument();
    });

    test('loads and prints one selected student’s saved English section only', async () => {
        renderPrinting();

        await waitFor(() => expect(settlingInApi.subjectReport).toHaveBeenCalled());
        fireEvent.mouseDown(screen.getByRole('combobox', { name: /Assigned class and subject/i }));
        fireEvent.click(screen.getByRole('option', { name: 'Year 3 - Blue — English' }));

        await waitFor(() => expect(settlingInApi.subjectReport).toHaveBeenCalledWith(
            CLASS_ID, TERM_ID, 'english', 'student-1',
        ));
        const printArea = screen.getByTestId('subject-report-print-area');
        expect(within(printArea).getByText('Settling In — English')).toBeInTheDocument();
        expect(within(printArea).getByText('Amina Bekele')).toBeInTheDocument();
        expect(within(printArea).queryByText('Amharic')).not.toBeInTheDocument();
        expect(within(printArea).queryByText('Conduct')).not.toBeInTheDocument();

        fireEvent.click(screen.getByRole('button', { name: 'Print saved section' }));
        expect(window.print).toHaveBeenCalledTimes(1);
    });

    test('selecting another student requests and prints only that student’s Amharic section', async () => {
        renderPrinting();

        await waitFor(() => expect(settlingInApi.subjectReport).toHaveBeenCalled());
        fireEvent.mouseDown(screen.getByRole('combobox', { name: /Assigned class and subject/i }));
        fireEvent.click(screen.getByRole('option', { name: 'Year 3 - Blue — Amharic' }));
        await waitFor(() => expect(settlingInApi.subjectReport).toHaveBeenCalledWith(
            CLASS_ID, TERM_ID, 'amharic', 'student-1',
        ));

        fireEvent.mouseDown(screen.getByRole('combobox', { name: 'Student' }));
        fireEvent.click(screen.getByRole('option', { name: /Biruk Tadesse/ }));
        await waitFor(() => expect(settlingInApi.subjectReport).toHaveBeenCalledWith(
            CLASS_ID, TERM_ID, 'amharic', 'student-2',
        ));

        const printArea = screen.getByTestId('subject-report-print-area');
        expect(within(printArea).getByText('Settling In — Amharic')).toBeInTheDocument();
        expect(within(printArea).getByText('Biruk Tadesse')).toBeInTheDocument();
        expect(within(printArea).queryByText('Amina Bekele')).not.toBeInTheDocument();
        expect(within(printArea).queryByText('Reads a short passage with understanding.')).not.toBeInTheDocument();
    });
});
