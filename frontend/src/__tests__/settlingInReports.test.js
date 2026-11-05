import '@testing-library/jest-dom';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { ThemeProvider } from '../theme';
import SettlingInReports from '../pages/SettlingInReports';
import { academicYearApi, classApi, settlingInApi, termApi } from '../api/endpoints';

jest.mock('../api/endpoints', () => ({
    academicYearApi: { list: jest.fn() },
    classApi: { list: jest.fn() },
    settlingInApi: { classReport: jest.fn(), saveSection: jest.fn() },
    termApi: { list: jest.fn(), current: jest.fn() },
}));

const CLASS_Y3 = 'class-year-3';
const CLASS_Y4 = 'class-year-4';
const TERM_1 = 'term-1';
const TERM_2 = 'term-2';
const TERM_PREVIOUS = 'term-previous-year';
const YEAR_CURRENT = 'year-id';
const YEAR_PREVIOUS = 'year-previous-id';
const STUDENT_1 = 'student-1';

const YEAR_3_TEMPLATE = {
    yearLevel: 3,
    label: 'Year 3',
    version: 'settling-in-year-3-2026-27-v1',
    ratingOrder: ['WT', 'WW', 'WA'],
    subjects: [
        { key: 'english', label: 'English', criteria: [
            { id: 'y3-english-01', text: 'To make predictions using clues from the text.' },
            { id: 'y3-english-02', text: 'To identify adjectives.' },
        ] },
        { key: 'mathematics', label: 'Maths', criteria: [{ id: 'y3-mathematics-01', text: 'Three-digit place value.' }] },
        { key: 'science', label: 'Science', criteria: [{ id: 'y3-science-01', text: 'Animal habitats.' }] },
        { key: 'global_citizenship', label: 'Global Citizenship', criteria: [{ id: 'y3-global_citizenship-01', text: 'Justice and fairness.' }] },
        { key: 'amharic', label: 'Amharic', criteria: [{ id: 'y3-amharic-01', text: 'Letter families.' }] },
    ],
};
const YEAR_4_TEMPLATE = {
    ...YEAR_3_TEMPLATE,
    yearLevel: 4,
    label: 'Year 4',
    version: 'settling-in-year-4-2026-27-v1',
    ratingOrder: ['WA', 'WW', 'WT'],
    subjects: YEAR_3_TEMPLATE.subjects.map((subject) => ({
        ...subject,
        criteria: subject.criteria.map((criterion) => ({
            id: criterion.id.replace('y3-', 'y4-'),
            text: `Year 4: ${criterion.text}`,
        })),
    })),
};

const makeReport = (classId = CLASS_Y3, template = YEAR_3_TEMPLATE, termId = TERM_1, academicYearId = YEAR_CURRENT) => ({
    class: { id: classId, name: template.yearLevel === 3 ? 'Year 3 - Blue' : 'Year 4 - Green', yearLevel: template.yearLevel },
    term: {
        id: termId,
        name: ({ [TERM_1]: 'Term 1', [TERM_2]: 'Term 2', [TERM_PREVIOUS]: 'Term 3' })[termId] || 'Term',
        academicYearId,
    },

    template,
    students: [{
        id: STUDENT_1,
        name: 'Abel Tesfaye',
        admissionNo: 'BIS-301',
        rollNum: 1,
        gender: 'male',
        sections: {},
    }],
});

const renderPage = () => render(
    <ThemeProvider>
        <BrowserRouter>
            <SettlingInReports />
        </BrowserRouter>
    </ThemeProvider>,
);

beforeEach(() => {
    jest.clearAllMocks();
    classApi.list.mockResolvedValue([
        { id: CLASS_Y3, name: 'Year 3 - Blue', yearLevel: 3, mainTeacher: { name: 'Kalkidan Z.' } },
        { id: CLASS_Y4, name: 'Year 4 - Green', yearLevel: 4, mainTeacher: { name: 'Samrawit E.' } },
        { id: 'class-year-5', name: 'Year 5 - Blue', yearLevel: 5 },
    ]);
    termApi.list.mockResolvedValue([
        { id: TERM_1, name: 'Term 1', academicYearId: YEAR_CURRENT, isCurrent: true },
        { id: TERM_2, name: 'Term 2', academicYearId: YEAR_CURRENT, isCurrent: false },
        { id: TERM_PREVIOUS, name: 'Term 3', academicYearId: YEAR_PREVIOUS, isCurrent: false },
    ]);
    termApi.current.mockResolvedValue({
        term: { id: TERM_1, name: 'Term 1', academicYearId: YEAR_CURRENT },
        currentWeek: 1,
    });
    academicYearApi.list.mockResolvedValue([
        { id: YEAR_CURRENT, name: '2026/2027', isCurrent: true },
        { id: YEAR_PREVIOUS, name: '2025/2026', isCurrent: false },
    ]);
    settlingInApi.classReport.mockImplementation(async (classId, termId) => {
        const selectedTerm = [
            { id: TERM_1, academicYearId: YEAR_CURRENT },
            { id: TERM_2, academicYearId: YEAR_CURRENT },
            { id: TERM_PREVIOUS, academicYearId: YEAR_PREVIOUS },
        ].find((item) => item.id === termId);
        const template = classId === CLASS_Y4 ? YEAR_4_TEMPLATE : YEAR_3_TEMPLATE;
        return makeReport(classId, template, termId, selectedTerm?.academicYearId || YEAR_CURRENT);
    });
    settlingInApi.saveSection.mockResolvedValue({
        subjectKey: 'english',
        ratings: { 'y3-english-01': 'WT', 'y3-english-02': null },
    });
});

describe('Settling In Report admin workspace', () => {
    test('loads the Year 3 template from the selected class and excludes unsupported years', async () => {
        renderPage();

        expect(await screen.findByTestId('settling-in-grade-badge')).toHaveTextContent('Year 3 criteria');
        expect(screen.getByTestId('settling-in-class-select')).toHaveTextContent('Year 3 - Blue');
        expect(settlingInApi.classReport).toHaveBeenCalledWith(CLASS_Y3, TERM_1);
        expect(screen.getByText('To make predictions using clues from the text.')).toBeInTheDocument();

        fireEvent.mouseDown(within(screen.getByTestId('settling-in-class-select')).getByRole('combobox'));
        expect(await screen.findByRole('option', { name: /Year 4 - Green/ })).toBeInTheDocument();
        expect(screen.queryByRole('option', { name: /Year 5/ })).not.toBeInTheDocument();
    });

    test('places selectors and the criteria editor above class progress', async () => {
        renderPage();
        await screen.findByTestId('settling-in-progress-table');

        const workspaceOrder = Array.from(document.querySelectorAll(
            '[data-testid="settling-in-year-select"], [data-testid="settling-in-term-select"], '
            + '[data-testid="settling-in-class-select"], [data-testid="settling-in-assessment-editor"], '
            + '[data-testid="settling-in-progress-table"]',
        )).map((element) => element.getAttribute('data-testid'));

        expect(workspaceOrder).toEqual([
            'settling-in-year-select',
            'settling-in-term-select',
            'settling-in-class-select',
            'settling-in-assessment-editor',
            'settling-in-progress-table',
        ]);
    });

    test('academic year is selected separately and filters the available terms', async () => {
        renderPage();
        await screen.findByTestId('settling-in-grade-badge');

        const yearPicker = within(screen.getByTestId('settling-in-year-select')).getByRole('combobox');
        const termPicker = within(screen.getByTestId('settling-in-term-select')).getByRole('combobox');
        expect(yearPicker).toHaveTextContent('2026/2027');
        expect(termPicker).toHaveTextContent('Term 1');

        fireEvent.mouseDown(yearPicker);
        fireEvent.click(await screen.findByRole('option', { name: '2025/2026' }));

        await waitFor(() => {
            expect(yearPicker).toHaveTextContent('2025/2026');
            expect(termPicker).toHaveTextContent('Term 3');
            expect(settlingInApi.classReport).toHaveBeenLastCalledWith(CLASS_Y3, TERM_PREVIOUS);
        });

        fireEvent.mouseDown(termPicker);
        expect(await screen.findByRole('option', { name: 'Term 3' })).toBeInTheDocument();
        expect(screen.queryByRole('option', { name: 'Term 1' })).not.toBeInTheDocument();
        expect(screen.queryByRole('option', { name: 'Term 2' })).not.toBeInTheDocument();
    });

    test('uses distinct Year 4 criteria after switching classes', async () => {
        renderPage();
        await screen.findByTestId('settling-in-grade-badge');

        fireEvent.mouseDown(within(screen.getByTestId('settling-in-class-select')).getByRole('combobox'));
        fireEvent.click(await screen.findByRole('option', { name: /Year 4 - Green/ }));

        expect(await screen.findByTestId('settling-in-grade-badge')).toHaveTextContent('Year 4 criteria');
        expect((await screen.findAllByText(/Year 4: To make predictions/)).length).toBeGreaterThanOrEqual(1);
        expect(settlingInApi.classReport).toHaveBeenCalledWith(CLASS_Y4, TERM_1);
    });

    test('one rating can be selected per criterion, toggled off, and saved per student and subject', async () => {
        renderPage();
        await screen.findByTestId('settling-in-grade-badge');

        const firstCriterion = 'y3-english-01';
        const workingTowards = screen.getByTestId(`settling-in-rating-${firstCriterion}-WT`);
        const workingWithin = screen.getByTestId(`settling-in-rating-${firstCriterion}-WW`);

        fireEvent.click(workingTowards);
        expect(workingTowards).toHaveAttribute('aria-pressed', 'true');
        expect(workingWithin).toHaveAttribute('aria-pressed', 'false');

        fireEvent.click(workingWithin);
        expect(workingTowards).toHaveAttribute('aria-pressed', 'false');
        expect(workingWithin).toHaveAttribute('aria-pressed', 'true');

        fireEvent.click(workingWithin);
        expect(workingWithin).toHaveAttribute('aria-pressed', 'false');

        fireEvent.click(workingTowards);
        fireEvent.click(screen.getByTestId('settling-in-save-section'));

        await waitFor(() => expect(settlingInApi.saveSection).toHaveBeenCalledWith({
            classId: CLASS_Y3,
            studentId: STUDENT_1,
            termId: TERM_1,
            subjectKey: 'english',
            ratings: { 'y3-english-01': 'WT', 'y3-english-02': null },
        }));
        expect(await screen.findByText(/English saved for Abel Tesfaye/)).toBeInTheDocument();
    });

    test('allows previewing two landscape pages and printing all students in the class', async () => {
        const printSpy = jest.spyOn(window, 'print').mockImplementation(() => {});
        renderPage();
        await screen.findByTestId('settling-in-grade-badge');

        fireEvent.click(screen.getByText('Preview / print'));
        const preview = screen.getByTestId('settling-in-selected-preview');
        expect(await within(preview).findByTestId(`settling-in-page-${STUDENT_1}-1`)).toBeInTheDocument();
        expect(within(preview).getByTestId(`settling-in-page-${STUDENT_1}-2`)).toBeInTheDocument();
        expect(within(preview).getAllByText(/Form tutor:/)).toHaveLength(2);

        fireEvent.click(screen.getByTestId('settling-in-print-button'));
        expect(printSpy).toHaveBeenCalled();
        printSpy.mockRestore();
    });
});
