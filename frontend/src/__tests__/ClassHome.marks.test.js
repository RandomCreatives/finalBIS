import '@testing-library/jest-dom';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { CssBaseline } from '@mui/material';
import ClassHome from '../pages/ClassHome';
import { ThemeProvider } from '../theme';
import { CLASS_LOGIN_KEY } from '../data/classes';

jest.mock('../auth/AuthContext', () => ({ useAuth: jest.fn() }));
jest.mock('../components/NotificationBell', () => () => null);
jest.mock('../components/PwaInstallButton', () => () => null);
jest.mock('../pages/ReportCards', () => ({ __esModule: true, default: () => null }));
jest.mock('../api/endpoints', () => ({
    assignmentApi: { subjects: jest.fn() },
    assessmentApi: { list: jest.fn(), create: jest.fn(), saveMarks: jest.fn(), remove: jest.fn() },
    attendanceApi: { monthlyGrid: jest.fn() },
    classApi: { list: jest.fn() },
    marksheetApi: { list: jest.fn() },
    studentApi: { list: jest.fn() },
    studentRequestApi: { list: jest.fn() },
    termApi: { current: jest.fn() },
    timetableApi: {},
    paymentApi: {},
}));

const { useAuth } = jest.requireMock('../auth/AuthContext');
const api = jest.requireMock('../api/endpoints');
const CLASS_ID = 'year-4-magenta-id';
const USER_ID = 'bethelhem-id';
const STUDENT_ID = 'magenta-student-1';
const SUBJECTS = [
    { id: 'subject-mat', code: 'MAT', name: 'Mathematics' },
    { id: 'subject-sci', code: 'SCI', name: 'Science' },
    { id: 'subject-gls', code: 'GLS', name: 'Global Citizenship' },
];

const assignments = SUBJECTS.map((subject) => ({
    id: `assignment-${subject.id}`,
    classId: CLASS_ID,
    subjectId: subject.id,
    // The subjects remained assigned to the outgoing main teacher at handover.
    teacherId: 'previous-main-teacher-id',
    class: { id: CLASS_ID, name: 'Year 4 - Magenta' },
    subject,
}));

const renderClassHome = () => {
    useAuth.mockReturnValue({
        user: { id: USER_ID, name: 'Bethelhem Girma', role: 'main_teacher' },
        logout: jest.fn(),
    });
    localStorage.setItem(CLASS_LOGIN_KEY, JSON.stringify({
        slug: 'year-4-magenta',
        className: 'Year 4 - Magenta',
        teacher: 'Bethelhem Girma',
        classId: CLASS_ID,
        userId: USER_ID,
        at: Date.now(),
    }));

    return render(
        <ThemeProvider>
            <CssBaseline />
            <MemoryRouter initialEntries={['/class-home/year-4-magenta']}>
                <Routes>
                    <Route path="/class-home/:slug" element={<ClassHome />} />
                </Routes>
            </MemoryRouter>
        </ThemeProvider>,
    );
};

beforeEach(() => {
    jest.clearAllMocks();
    api.assignmentApi.subjects.mockResolvedValue({ assignments });
    api.assessmentApi.list.mockImplementation(({ subjectId }) => Promise.resolve([{
        id: `assessment-${subjectId}`,
        label: 'Term 1 exam',
        maxMarks: 100,
        sortOrder: 0,
        marks: { [STUDENT_ID]: 84 },
    }]));
    api.attendanceApi.monthlyGrid.mockResolvedValue({ days: [], students: [] });
    api.classApi.list.mockResolvedValue([{
        id: CLASS_ID,
        name: 'Year 4 - Magenta',
        mainTeacher: { id: USER_ID, name: 'Bethelhem Girma' },
    }]);
    api.marksheetApi.list.mockResolvedValue([]);
    api.studentApi.list.mockResolvedValue([{
        id: STUDENT_ID,
        name: 'Test Pupil',
        rollNum: 1,
    }]);
    api.studentRequestApi.list.mockResolvedValue([]);
    api.termApi.current.mockResolvedValue({ term: { id: 'term-1', name: 'Term 1' } });
});

afterEach(() => localStorage.removeItem(CLASS_LOGIN_KEY));

test('the Year 4 Magenta main-teacher dropdown lists its subjects and loads existing marks after handover', async () => {
    renderClassHome();
    fireEvent.click(screen.getByRole('button', { name: 'Marksheets' }));

    const subjectSelect = await screen.findByRole('combobox');
    fireEvent.mouseDown(subjectSelect);
    expect((await screen.findAllByRole('option')).map((option) => option.textContent))
        .toEqual(['Global Citizenship', 'Mathematics', 'Science']);

    fireEvent.click(screen.getByRole('option', { name: 'Mathematics' }));

    await waitFor(() => expect(api.assessmentApi.list).toHaveBeenCalledWith({
        classId: CLASS_ID,
        subjectId: 'subject-mat',
        termId: 'term-1',
    }));
    expect(await screen.findByDisplayValue('84')).toBeInTheDocument();
    expect(await screen.findByTestId('marks-class-average-assessment-subject-mat'))
        .toHaveTextContent('84.0 / 100');
    expect(screen.getByTestId('marks-class-average-final')).toHaveTextContent('84.0%');
    expect(screen.getByTestId('marks-class-average-grade')).toHaveTextContent('A');
    expect(api.assessmentApi.saveMarks).not.toHaveBeenCalled();
});

test('shows class averages for each assessment and the final grade across the roster', async () => {
    const secondStudentId = 'magenta-student-2';
    api.studentApi.list.mockResolvedValue([
        { id: STUDENT_ID, name: 'Test Pupil', rollNum: 1 },
        { id: secondStudentId, name: 'Second Pupil', rollNum: 2 },
    ]);
    api.assessmentApi.list.mockImplementation(({ subjectId }) => Promise.resolve(subjectId === 'subject-mat' ? [
        {
            id: 'quiz-math', label: 'Quiz 1', maxMarks: 10, sortOrder: 1,
            marks: { [STUDENT_ID]: 8, [secondStudentId]: 6 },
        },
        {
            id: 'classwork-math', label: 'Classwork', maxMarks: 20, sortOrder: 2,
            marks: { [STUDENT_ID]: 15 },
        },
    ] : []));

    renderClassHome();
    fireEvent.click(screen.getByRole('button', { name: 'Marksheets' }));
    const subjectSelect = await screen.findByRole('combobox');
    fireEvent.mouseDown(subjectSelect);
    fireEvent.click(await screen.findByRole('option', { name: 'Mathematics' }));

    expect(await screen.findByTestId('marks-class-average-quiz-math'))
        .toHaveTextContent('7.0 / 10');
    expect(screen.getByTestId('marks-class-average-quiz-math')).toHaveTextContent('2/2 marked');
    expect(screen.getByTestId('marks-class-average-classwork-math'))
        .toHaveTextContent('15.0 / 20');
    expect(screen.getByTestId('marks-class-average-classwork-math')).toHaveTextContent('1/2 marked');
    expect(screen.getByTestId('marks-class-average-final')).toHaveTextContent('68.3%');
    expect(screen.getByTestId('marks-class-average-final')).toHaveTextContent('2/2 graded');
    expect(screen.getByTestId('marks-class-average-grade')).toHaveTextContent('B');
});
