import '@testing-library/jest-dom';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { ThemeProvider } from '../theme';
import SubjectHome from '../pages/SubjectHome';
import {
    academicYearApi, assignmentApi, assessmentApi, authApi, classApi, planningApi, settlingInApi,
    studentApi, termApi, timetableApi,
} from '../api/endpoints';

jest.mock('../auth/AuthContext', () => ({
    useAuth: () => ({
        user: { id: 't1', name: 'English Teacher 1', role: 'subject_teacher' },
        logout: jest.fn(),
    }),
}));

jest.mock('../api/endpoints', () => ({
    academicYearApi: { list: jest.fn() },
    assignmentApi: { subjects: jest.fn() },
    classApi: { list: jest.fn() },
    assessmentApi: { list: jest.fn() },
    studentApi: { list: jest.fn() },
    settlingInApi: {
        classReport: jest.fn(), subjectClassReport: jest.fn(), subjectReport: jest.fn(),
        saveSection: jest.fn(), saveMainTeacherSection: jest.fn(),
    },
    termApi: { current: jest.fn(), list: jest.fn() },
    timetableApi: { myWeek: jest.fn(), forClass: jest.fn() },
    planningApi: {
        schemes: jest.fn(),
        lessonPlans: jest.fn(),
        overview: jest.fn(),
    },
    authApi: { me: jest.fn() },
}));

const renderHome = () =>
    render(
        <ThemeProvider>
            <MemoryRouter initialEntries={['/subject-home']}>
                <SubjectHome />
            </MemoryRouter>
        </ThemeProvider>,
    );

beforeEach(() => {
    jest.clearAllMocks();
    assignmentApi.subjects.mockResolvedValue({ assignments: [] });
    assessmentApi.list.mockResolvedValue({ assessments: [] });
    studentApi.list.mockResolvedValue({ students: [] });
    termApi.current.mockResolvedValue({ term: { id: 'term-1', name: 'Term 1' } });
    timetableApi.myWeek.mockResolvedValue([]);
    timetableApi.forClass.mockResolvedValue({ slots: [] });
    planningApi.schemes.mockResolvedValue([]);
    planningApi.lessonPlans.mockResolvedValue([]);
    planningApi.overview.mockResolvedValue(null);
    authApi.me.mockRejectedValue(new Error('no session'));
});

describe('SubjectHome — Planning & Calendar sections', () => {
    test('sidebar offers Planning and Calendar beside the existing sections', () => {
        renderHome();
        const nav = screen.getByTestId('side-nav');
        ['Overview', 'My week', 'Planning', 'Calendar', 'My classes', 'Marks', 'Settling In'].forEach((label) => {
            expect(within(nav).getByRole('button', { name: label })).toBeInTheDocument();
        });
        // Profile stays pinned to the bottom of the full-length sidebar
        const buttons = within(nav).getAllByRole('button');
        expect(buttons[buttons.length - 1]).toBe(within(nav).getByTestId('side-nav-profile'));
    });

    test('Settling In opens the shared tick-and-save assessment for assigned subjects only', async () => {
        const klass = { id: 'class-y3-blue', name: 'Year 3 - Blue', year_level: 3 };
        const term = { id: 'term-1', name: 'Term 1', academicYearId: 'year-1' };
        const subject = {
            key: 'english', label: 'English', assessorRole: 'subject_teacher',
            criteria: [{ id: 'y3-english-01', text: 'English criterion' }],
        };
        const template = {
            yearLevel: 3,
            label: 'Year 3',
            version: 'year-3-test',
            ratingOrder: ['WT', 'WW', 'WA'],
            subjects: [subject],
        };
        assignmentApi.subjects.mockResolvedValue({ assignments: [{
            id: 'assignment-1', class: klass, subject: { id: 'english', name: 'English', code: 'ENG' },
        }] });
        academicYearApi.list.mockResolvedValue([{ id: 'year-1', name: '2026/2027', isCurrent: true }]);
        termApi.current.mockResolvedValue({ term, currentWeek: 1 });
        termApi.list.mockResolvedValue([term]);
        settlingInApi.subjectClassReport.mockResolvedValue({
            class: { id: klass.id, name: klass.name, yearLevel: 3 },
            term,
            template,
            students: [{
                id: 'student-1', name: 'Abel Tesfaye', admissionNo: 'BIS-301', rollNum: 1, sections: {},
            }],
        });
        settlingInApi.subjectReport.mockResolvedValue({
            class: { id: klass.id, name: klass.name, yearLevel: 3 },
            term,
            template,
            subject,
            student: {
                id: 'student-1', name: 'Abel Tesfaye', admissionNo: 'BIS-301', rollNum: 1,
                sections: { english: { subjectKey: 'english', ratings: {}, ratedCount: 0, totalCount: 1 } },
            },
        });

        renderHome();
        fireEvent.click(within(screen.getByTestId('side-nav')).getByRole('button', { name: 'Settling In' }));

        expect(await screen.findByTestId('settling-in-assessment-editor')).toBeInTheDocument();
        expect(await screen.findByText(/English criterion/)).toBeInTheDocument();
        expect(settlingInApi.subjectClassReport).toHaveBeenCalledWith('class-y3-blue', 'term-1');
        expect(screen.queryByTestId('settling-in-main-teacher-editor')).not.toBeInTheDocument();
        expect(screen.queryByText('Maths')).not.toBeInTheDocument();
    });

    test('Planning opens the server-backed scheme and weekly lesson plan workflow', async () => {
        renderHome();
        fireEvent.click(within(screen.getByTestId('side-nav')).getByRole('button', { name: 'Planning' }));
        expect(screen.getByRole('tab', { name: /Scheme of Work/i })).toBeInTheDocument();
        expect(screen.getByRole('tab', { name: /Weekly Lesson Plans/i })).toBeInTheDocument();
        await waitFor(() => expect(screen.getByRole('button', { name: /New scheme of work/i })).toBeInTheDocument());

        fireEvent.click(screen.getByRole('tab', { name: /Weekly Lesson Plans/i }));
        expect(screen.getByRole('button', { name: /New lesson plan/i })).toBeInTheDocument();
    });

    test('Calendar opens the shared school calendar board', () => {
        renderHome();
        fireEvent.click(within(screen.getByTestId('side-nav')).getByRole('button', { name: 'Calendar' }));
        expect(screen.getByText('Upcoming')).toBeInTheDocument();
    });
});
