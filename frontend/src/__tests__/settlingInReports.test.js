import '@testing-library/jest-dom';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { ThemeProvider } from '../theme';
import SettlingInReports from '../pages/SettlingInReports';
import { academicYearApi, assignmentApi, classApi, settlingInApi, termApi } from '../api/endpoints';
import { useAuth } from '../auth/AuthContext';
import {
    createSettlingInPdf,
    createSettlingInPdfZip,
    downloadBlob,
    settlingInClassZipFilename,
    settlingInStudentPdfFilename,
} from '../utils/settlingInPdf';

jest.mock('../utils/settlingInPdf', () => ({
    createSettlingInPdf: jest.fn(),
    createSettlingInPdfZip: jest.fn(),
    downloadBlob: jest.fn(),
    settlingInClassZipFilename: jest.fn(),
    settlingInStudentPdfFilename: jest.fn(),
}));

jest.mock('../auth/AuthContext', () => ({ useAuth: jest.fn() }));

jest.mock('../api/endpoints', () => ({
    academicYearApi: { list: jest.fn() },
    assignmentApi: { subjects: jest.fn() },
    classApi: { list: jest.fn() },
    settlingInApi: {
        classReport: jest.fn(), subjectClassReport: jest.fn(), subjectReport: jest.fn(),
        saveSection: jest.fn(), saveMainTeacherSection: jest.fn(),
    },
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
const STUDENT_2 = 'student-2';

const YEAR_3_TEMPLATE = {
    yearLevel: 3,
    label: 'Year 3',
    version: 'settling-in-year-3-2026-27-v1',
    ratingOrder: ['WT', 'WW', 'WA'],
    mainTeacherSection: {
        version: 'settling-in-main-teacher-2026-27-v1',
        categories: [
            { key: 'conduct', label: 'Conduct' },
            { key: 'organisation', label: 'Organisation' },
            { key: 'attendance', label: 'Attendance' },
        ],
        ratingOrder: ['pleasing', 'satisfactory', 'cause_for_concern'],
        ratings: {
            pleasing: 'Pleasing',
            satisfactory: 'Satisfactory',
            cause_for_concern: 'Cause for Concern',
        },
    },
    subjects: [
        { key: 'english', label: 'English', assessorRole: 'subject_teacher', criteria: [
            { id: 'y3-english-01', text: 'To make predictions using clues from the text.' },
            { id: 'y3-english-02', text: 'To identify adjectives.' },
        ] },
        { key: 'mathematics', label: 'Maths', assessorRole: 'main_teacher', criteria: [{ id: 'y3-mathematics-01', text: 'Three-digit place value.' }] },
        { key: 'science', label: 'Science', assessorRole: 'main_teacher', criteria: [{ id: 'y3-science-01', text: 'Animal habitats.' }] },
        { key: 'global_citizenship', label: 'Global Citizenship', assessorRole: 'main_teacher', criteria: [{ id: 'y3-global_citizenship-01', text: 'Justice and fairness.' }] },
        { key: 'amharic', label: 'Amharic', assessorRole: 'subject_teacher', criteria: [{ id: 'y3-amharic-01', text: 'Letter families.' }] },
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
        mainTeacherSection: null,
    }],
});

const makeSubjectProgressReport = (classId, subjectKeys = ['english'], termId = TERM_1) => {
    const template = classId === CLASS_Y4 ? YEAR_4_TEMPLATE : YEAR_3_TEMPLATE;
    const fullReport = makeReport(classId, template, termId);
    return {
        ...fullReport,
        template: { ...template, subjects: template.subjects.filter((subject) => subjectKeys.includes(subject.key)) },
        students: fullReport.students.map(({ mainTeacherSection, ...student }) => ({ ...student, sections: {} })),
    };
};

const makeSubjectDetailReport = (classId, subjectKey, studentId = STUDENT_1, termId = TERM_1) => {
    const progress = makeSubjectProgressReport(classId, [subjectKey], termId);
    const subject = progress.template.subjects[0];
    return {
        class: progress.class,
        term: progress.term,
        template: progress.template,
        subject,
        student: {
            id: studentId,
            name: 'Abel Tesfaye',
            admissionNo: 'BIS-301',
            rollNum: 1,
            sections: {
                [subjectKey]: {
                    subjectKey,
                    ratings: {},
                    ratedCount: 0,
                    totalCount: subject.criteria.length,
                    complete: false,
                    updatedAt: null,
                },
            },
        },
    };
};

const subjectAssignment = (classId, className, yearLevel, subjectKey) => ({
    class: { id: classId, name: className, year_level: yearLevel },
    subject: subjectKey === 'english' ? { code: 'ENG', name: 'English' } : { code: 'AMH', name: 'Amharic' },
});

const renderPage = (props = {}) => render(
    <ThemeProvider>
        <BrowserRouter>
            <SettlingInReports {...props} />
        </BrowserRouter>
    </ThemeProvider>,
);

beforeEach(() => {
    jest.clearAllMocks();
    const individualPdf = new Blob(['student-pdf'], { type: 'application/pdf' });
    const classZip = new Blob(['student-pdfs-zip'], { type: 'application/zip' });
    createSettlingInPdf.mockResolvedValue(individualPdf);
    createSettlingInPdfZip.mockImplementation(async (entries, onProgress) => {
        onProgress?.(entries.length, entries.length, 'archive', 100);
        return classZip;
    });
    settlingInStudentPdfFilename.mockImplementation((student) => `${student.name}.pdf`);
    settlingInClassZipFilename.mockReturnValue('Year 3 - Blue Settling-In PDFs.zip');
    useAuth.mockReturnValue({ user: { id: 'admin-user', role: 'admin' } });
    assignmentApi.subjects.mockResolvedValue({ assignments: [] });
    settlingInApi.subjectClassReport.mockResolvedValue(makeSubjectProgressReport(CLASS_Y3, ['english']));
    settlingInApi.subjectReport.mockImplementation(async (classId, termId, subjectKey, studentId) =>
        makeSubjectDetailReport(classId, subjectKey, studentId, termId));
    classApi.list.mockResolvedValue([
        { id: CLASS_Y3, name: 'Year 3 - Blue', yearLevel: 3, mainTeacher: { id: 'main-teacher-3', name: 'Kalkidan Z.' } },
        { id: CLASS_Y4, name: 'Year 4 - Green', yearLevel: 4, mainTeacher: { id: 'main-teacher-4', name: 'Samrawit E.' } },
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
    settlingInApi.saveMainTeacherSection.mockResolvedValue({
        ratings: { conduct: 'pleasing', organisation: 'satisfactory', attendance: null },
    });
});

describe('Settling In Report workspace', () => {
    test('main-teacher pilot scopes the class and keeps subject-teacher sections read-only', async () => {
        useAuth.mockReturnValue({ user: { id: 'main-teacher-3', role: 'main_teacher' } });
        renderPage();

        expect(await screen.findByTestId('settling-in-grade-badge')).toHaveTextContent('Year 3 criteria');
        expect(classApi.list).toHaveBeenCalledWith({ mine: true });
        expect(screen.getByTestId('settling-in-class-select')).toHaveTextContent('Year 3 - Blue');
        expect(screen.getByTestId('settling-in-class-select')).not.toHaveTextContent('Year 4 - Green');

        const editor = screen.getByTestId('settling-in-assessment-editor');
        const subjectPicker = within(editor).getByTestId('settling-in-subject-select');
        expect(within(subjectPicker).getByRole('button', { name: 'Maths' })).toBeInTheDocument();
        expect(within(subjectPicker).getByRole('button', { name: 'Science' })).toBeInTheDocument();
        expect(within(subjectPicker).getByRole('button', { name: 'Global Citizenship' })).toBeInTheDocument();
        expect(within(subjectPicker).queryByRole('button', { name: 'English' })).not.toBeInTheDocument();
        expect(within(subjectPicker).queryByRole('button', { name: 'Amharic' })).not.toBeInTheDocument();
        expect(screen.getByText('Three-digit place value.')).toBeInTheDocument();
        expect(screen.getByTestId(`settling-in-open-${STUDENT_1}-mathematics`)).toBeEnabled();
        expect(screen.getByTestId(`settling-in-open-${STUDENT_1}-science`)).toBeEnabled();
        expect(screen.getByTestId(`settling-in-open-${STUDENT_1}-global_citizenship`)).toBeEnabled();
        expect(screen.getByTestId(`settling-in-open-${STUDENT_1}-english`)).toBeDisabled();
        expect(screen.getByTestId(`settling-in-open-${STUDENT_1}-amharic`)).toBeDisabled();
        expect(screen.getByTestId('settling-in-main-teacher-editor')).toBeInTheDocument();
    });

    test('subject teachers see assigned classes and only their English or Amharic workspace', async () => {
        useAuth.mockReturnValue({ user: { id: 'subject-user', name: 'Dawit', role: 'subject_teacher' } });
        assignmentApi.subjects.mockResolvedValue({ assignments: [
            subjectAssignment(CLASS_Y3, 'Year 3 - Blue', 3, 'english'),
            subjectAssignment(CLASS_Y4, 'Year 4 - Green', 4, 'amharic'),
        ] });
        settlingInApi.subjectClassReport.mockImplementation(async (classId, termId) =>
            makeSubjectProgressReport(classId, classId === CLASS_Y4 ? ['amharic'] : ['english'], termId));

        renderPage();
        expect(await screen.findByTestId('settling-in-grade-badge')).toHaveTextContent('Year 3 criteria');
        expect(await screen.findByTestId('settling-in-progress-table')).toBeInTheDocument();
        expect(assignmentApi.subjects).toHaveBeenLastCalledWith({ teacherId: 'subject-user', academicYearId: YEAR_CURRENT });
        expect(classApi.list).not.toHaveBeenCalled();
        expect(settlingInApi.classReport).not.toHaveBeenCalled();
        expect(settlingInApi.subjectClassReport).toHaveBeenCalledWith(CLASS_Y3, TERM_1);
        expect(screen.queryByTestId('settling-in-main-teacher-editor')).not.toBeInTheDocument();
        expect(screen.getByTestId('settling-in-progress-table')).not.toHaveTextContent('Main teacher');
        expect(screen.getByTestId(`settling-in-open-${STUDENT_1}-english`)).toBeEnabled();
        expect(screen.queryByTestId(`settling-in-open-${STUDENT_1}-mathematics`)).not.toBeInTheDocument();

        fireEvent.mouseDown(within(screen.getByTestId('settling-in-class-select')).getByRole('combobox'));
        expect(await screen.findByRole('option', { name: /Year 4 - Green/ })).toBeInTheDocument();
        expect(screen.queryByRole('option', { name: /Year 5/ })).not.toBeInTheDocument();
        fireEvent.click(screen.getByRole('option', { name: /Year 4 - Green/ }));

        expect(await screen.findByTestId('settling-in-grade-badge')).toHaveTextContent('Year 4 criteria');
        const picker = within(screen.getByTestId('settling-in-subject-select'));
        expect(picker.getByRole('button', { name: 'Amharic' })).toBeInTheDocument();
        expect(picker.queryByRole('button', { name: 'English' })).not.toBeInTheDocument();
        expect(within(await screen.findByTestId('settling-in-criteria-table')).getAllByRole('columnheader')
            .map((cell) => cell.textContent)).toEqual(['Teacher-provided criterion', 'WA', 'WW', 'WT']);
        expect(settlingInApi.subjectClassReport).toHaveBeenCalledWith(CLASS_Y4, TERM_1);
    });

    test('subject teachers can tick and save their assigned section without a main-teacher editor', async () => {
        useAuth.mockReturnValue({ user: { id: 'subject-user', name: 'Dawit', role: 'subject_teacher' } });
        assignmentApi.subjects.mockResolvedValue({ assignments: [
            subjectAssignment(CLASS_Y3, 'Year 3 - Blue', 3, 'english'),
        ] });
        settlingInApi.subjectClassReport.mockResolvedValue(makeSubjectProgressReport(CLASS_Y3, ['english']));
        renderPage();

        expect(await screen.findByTestId('settling-in-assessment-editor')).toBeInTheDocument();
        expect(screen.queryByTestId('settling-in-main-teacher-editor')).not.toBeInTheDocument();
        const workingTowards = await screen.findByTestId('settling-in-rating-y3-english-01-WT');
        await waitFor(() => expect(workingTowards).toBeEnabled());
        fireEvent.click(workingTowards);
        fireEvent.click(screen.getByTestId('settling-in-save-section'));

        await waitFor(() => expect(settlingInApi.saveSection).toHaveBeenCalledWith({
            classId: CLASS_Y3,
            studentId: STUDENT_1,
            termId: TERM_1,
            subjectKey: 'english',
            ratings: { 'y3-english-01': 'WT', 'y3-english-02': null },
        }));
        expect(settlingInApi.subjectReport).toHaveBeenCalledWith(CLASS_Y3, TERM_1, 'english', STUDENT_1);
        expect(await screen.findByText(/English saved for Abel Tesfaye/)).toBeInTheDocument();
    });

    test('lists only the class the main teacher logged into and keeps its selector active', async () => {
        useAuth.mockReturnValue({ user: { id: 'main-teacher-4', role: 'main_teacher' } });
        renderPage({
            initialClass: {
                id: CLASS_Y4,
                name: 'Year 4 - Green',
                yearLevel: 4,
                mainTeacher: { id: 'main-teacher-4', name: 'Samrawit E.' },
            },
        });

        expect(await screen.findByTestId('settling-in-grade-badge')).toHaveTextContent('Year 4 criteria');
        expect(settlingInApi.classReport).toHaveBeenCalledWith(CLASS_Y4, TERM_1);
        expect(classApi.list).not.toHaveBeenCalled();

        const selector = screen.getByTestId('settling-in-class-select');
        const combobox = within(selector).getByRole('combobox');
        expect(combobox).toBeEnabled();
        expect(selector).toHaveTextContent('Year 4 - Green');
        fireEvent.mouseDown(combobox);
        expect(await screen.findByRole('option', { name: 'Year 4 - Green' })).toBeInTheDocument();
        expect(screen.getAllByRole('option')).toHaveLength(1);
    });

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
            + '[data-testid="settling-in-main-teacher-editor"], [data-testid="settling-in-progress-table"]',
        )).map((element) => element.getAttribute('data-testid'));

        expect(workspaceOrder).toEqual([
            'settling-in-year-select',
            'settling-in-term-select',
            'settling-in-class-select',
            'settling-in-assessment-editor',
            'settling-in-main-teacher-editor',
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
        expect(within(screen.getByTestId('settling-in-criteria-table')).getAllByRole('columnheader')
            .map((cell) => cell.textContent)).toEqual(['Teacher-provided criterion', 'WT', 'WW', 'WA']);
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

    test('saves the main-teacher conduct, organisation and attendance ratings per student and term', async () => {
        renderPage();
        const editor = await screen.findByTestId('settling-in-main-teacher-editor');

        fireEvent.mouseDown(within(screen.getByTestId('settling-in-main-rating-conduct')).getByRole('combobox'));
        fireEvent.click(await screen.findByRole('option', { name: 'Pleasing' }));
        fireEvent.mouseDown(within(screen.getByTestId('settling-in-main-rating-organisation')).getByRole('combobox'));
        fireEvent.click(await screen.findByRole('option', { name: 'Satisfactory' }));
        fireEvent.click(screen.getByTestId('settling-in-save-main-teacher'));

        await waitFor(() => expect(settlingInApi.saveMainTeacherSection).toHaveBeenCalledWith({
            classId: CLASS_Y3,
            studentId: STUDENT_1,
            termId: TERM_1,
            ratings: { conduct: 'pleasing', organisation: 'satisfactory', attendance: null },
        }));
        expect(await within(editor).findByText(/Main teacher section saved for Abel Tesfaye/)).toBeInTheDocument();
    });

    test('subject-teacher preview and print contain only the selected assigned section', async () => {
        useAuth.mockReturnValue({ user: { id: 'subject-user', name: 'Dawit', role: 'subject_teacher' } });
        assignmentApi.subjects.mockResolvedValue({ assignments: [
            subjectAssignment(CLASS_Y3, 'Year 3 - Blue', 3, 'english'),
        ] });
        settlingInApi.subjectClassReport.mockResolvedValue(makeSubjectProgressReport(CLASS_Y3, ['english']));
        const printSpy = jest.spyOn(window, 'print').mockImplementation(() => {});
        renderPage();
        await screen.findByTestId('settling-in-assessment-editor');

        fireEvent.click(screen.getByText('Preview / print'));
        const preview = screen.getByTestId('settling-in-selected-preview');
        const subjectPage = await within(preview).findByRole('table', { name: 'English Settling In ratings' });
        expect(within(preview).getByText('Settling In — English')).toBeInTheDocument();
        expect(within(preview).queryByText('Maths')).not.toBeInTheDocument();
        expect(within(preview).queryByTestId(`settling-in-side-${STUDENT_1}-outside`)).not.toBeInTheDocument();
        expect(subjectPage).toBeInTheDocument();
        expect(screen.queryByTestId('settling-in-print-button')).not.toBeInTheDocument();
        expect(screen.queryByTestId('settling-in-download-student-pdf-button')).not.toBeInTheDocument();
        expect(screen.queryByTestId('settling-in-download-class-zip-button')).not.toBeInTheDocument();
        expect(screen.queryByTestId('settling-in-pdf-area')).not.toBeInTheDocument();

        const printSectionButton = screen.getByTestId('settling-in-print-subject-section-button');
        await waitFor(() => expect(printSectionButton).toBeEnabled());
        fireEvent.click(printSectionButton);
        await waitFor(() => expect(printSpy).toHaveBeenCalledTimes(1));
        const printArea = screen.getByTestId('settling-in-subject-print-area');
        expect(within(printArea).getByRole('table', { name: 'English Settling In ratings', hidden: true })).toBeInTheDocument();
        expect(screen.queryByTestId('settling-in-print-area')).not.toBeInTheDocument();
        printSpy.mockRestore();
    });

    test('previews the four A5 booklet panels on two A4 duplex sides and prints the class', async () => {
        const printSpy = jest.spyOn(window, 'print').mockImplementation(() => {});
        renderPage();
        await screen.findByTestId('settling-in-grade-badge');

        fireEvent.click(screen.getByText('Preview / print'));
        const preview = screen.getByTestId('settling-in-selected-preview');
        expect(await within(preview).findByTestId(`settling-in-side-${STUDENT_1}-outside`)).toBeInTheDocument();
        expect(within(preview).getByTestId(`settling-in-side-${STUDENT_1}-inside`)).toBeInTheDocument();
        [1, 2, 3, 4].forEach((pageNumber) => {
            expect(within(preview).getByTestId(`settling-in-page-${STUDENT_1}-${pageNumber}`)).toBeInTheDocument();
        });
        expect(within(preview).getByTestId(`settling-in-subject-panel-${STUDENT_1}-2`)).toHaveTextContent('English');
        expect(within(preview).getByTestId(`settling-in-subject-panel-${STUDENT_1}-2`)).toHaveTextContent('Science');
        expect(within(preview).getByTestId(`settling-in-subject-panel-${STUDENT_1}-3`)).toHaveTextContent('Global Citizenship');
        expect(within(preview).getByTestId(`settling-in-subject-panel-${STUDENT_1}-3`)).toHaveTextContent('Amharic');
        expect(within(preview).getByTestId(`settling-in-subject-panel-${STUDENT_1}-2`).querySelector('td'))
            .toHaveStyle({ fontSize: '14pt' });
        expect(within(preview).getByTestId(`settling-in-main-teacher-print-${STUDENT_1}`).querySelector('th'))
            .toHaveStyle({ fontSize: '14pt' });
        expect(within(preview).getAllByText(/Form Tutor:/i)).toHaveLength(1);
        expect(within(preview).getByText('2026-27')).toBeInTheDocument();
        expect(within(preview).getByText('P. O. Box 5583')).toBeInTheDocument();

        fireEvent.click(screen.getByTestId('settling-in-print-button'));
        expect(printSpy).toHaveBeenCalled();
        printSpy.mockRestore();
    });

    test('prints only the selected student from the class report preview', async () => {
        const report = makeReport();
        settlingInApi.classReport.mockResolvedValue({
            ...report,
            students: [
                ...report.students,
                { ...report.students[0], id: STUDENT_2, name: 'Bethlehem Adera', rollNum: 2 },
            ],
        });
        const printSpy = jest.spyOn(window, 'print').mockImplementation(() => {});
        renderPage();
        await screen.findByTestId('settling-in-grade-badge');

        fireEvent.click(screen.getByText('Preview / print'));
        const studentPicker = within(screen.getByTestId('settling-in-preview-student-select'))
            .getByRole('combobox');
        fireEvent.mouseDown(studentPicker);
        fireEvent.click(await screen.findByRole('option', { name: 'Bethlehem Adera' }));
        fireEvent.click(screen.getByTestId('settling-in-print-student-button'));

        await waitFor(() => expect(printSpy).toHaveBeenCalledTimes(1));
        const printArea = screen.getByTestId('settling-in-print-area');
        expect(within(printArea).getByTestId(`settling-in-side-${STUDENT_2}-outside`)).toBeInTheDocument();
        expect(within(printArea).getByTestId(`settling-in-side-${STUDENT_2}-inside`)).toBeInTheDocument();
        expect(within(printArea).queryByTestId(`settling-in-side-${STUDENT_1}-outside`)).not.toBeInTheDocument();
        expect(within(printArea).getAllByTestId(/^settling-in-side-/)).toHaveLength(2);
        printSpy.mockRestore();
    });

    test('admins can download a student booklet PDF and a class ZIP of separate student PDFs', async () => {
        const report = makeReport();
        settlingInApi.classReport.mockResolvedValue({
            ...report,
            students: [
                ...report.students,
                { ...report.students[0], id: STUDENT_2, name: 'Bethlehem Adera', rollNum: 2 },
            ],
        });
        renderPage();
        await screen.findByTestId('settling-in-grade-badge');

        fireEvent.click(screen.getByText('Preview / print'));
        expect(await screen.findByTestId('settling-in-pdf-area')).toBeInTheDocument();
        const downloadStudentButton = screen.getByTestId('settling-in-download-student-pdf-button');
        expect(downloadStudentButton).toBeEnabled();
        expect(downloadStudentButton).toHaveClass('MuiButton-sizeSmall');
        const downloadClassButton = screen.getByTestId('settling-in-download-class-zip-button');
        expect(downloadClassButton).toHaveTextContent('Download 2 PDFs (.zip)');
        expect(downloadClassButton).toHaveClass('MuiButton-sizeSmall');
        expect(screen.getByTestId('settling-in-print-button')).toHaveClass('MuiButton-sizeSmall');
        expect(screen.getByTestId('settling-in-print-student-button')).toHaveClass('MuiButton-sizeSmall');

        const studentPicker = within(screen.getByTestId('settling-in-preview-student-select'))
            .getByRole('combobox');
        fireEvent.mouseDown(studentPicker);
        fireEvent.click(await screen.findByRole('option', { name: 'Bethlehem Adera' }));
        fireEvent.click(screen.getByTestId('settling-in-download-student-pdf-button'));

        await waitFor(() => expect(downloadBlob).toHaveBeenCalledTimes(1));
        expect(createSettlingInPdf).toHaveBeenCalledWith(
            document.getElementById(`settling-in-pdf-student-${STUDENT_2}`),
        );
        expect(downloadBlob).toHaveBeenLastCalledWith(expect.any(Blob), 'Bethlehem Adera.pdf');

        fireEvent.click(screen.getByTestId('settling-in-download-class-zip-button'));
        await waitFor(() => expect(createSettlingInPdfZip).toHaveBeenCalledTimes(1));
        const entries = createSettlingInPdfZip.mock.calls[0][0];
        expect(entries.map(({ filename }) => filename)).toEqual(['Abel Tesfaye.pdf', 'Bethlehem Adera.pdf']);
        expect(entries.map(({ element }) => element.id)).toEqual([
            `settling-in-pdf-student-${STUDENT_1}`,
            `settling-in-pdf-student-${STUDENT_2}`,
        ]);
        await waitFor(() => expect(downloadBlob).toHaveBeenCalledTimes(2));
        expect(downloadBlob).toHaveBeenLastCalledWith(expect.any(Blob), 'Year 3 - Blue Settling-In PDFs.zip');
    });
});
