import '@testing-library/jest-dom';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { ThemeProvider } from '../theme';
import SubjectHome from '../pages/SubjectHome';
import {
    assignmentApi, assessmentApi, authApi, planningApi, studentApi, termApi, timetableApi,
} from '../api/endpoints';

jest.mock('../auth/AuthContext', () => ({
    useAuth: () => ({
        user: { id: 't1', name: 'English Teacher 1', role: 'subject_teacher' },
        logout: jest.fn(),
    }),
}));

jest.mock('../api/endpoints', () => ({
    assignmentApi: { subjects: jest.fn() },
    assessmentApi: { list: jest.fn() },
    studentApi: { list: jest.fn() },
    termApi: { current: jest.fn() },
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
        ['Overview', 'My week', 'Planning', 'Calendar', 'My classes', 'Marks'].forEach((label) => {
            expect(within(nav).getByRole('button', { name: label })).toBeInTheDocument();
        });
        // Profile stays pinned to the bottom of the full-length sidebar
        const buttons = within(nav).getAllByRole('button');
        expect(buttons[buttons.length - 1]).toBe(within(nav).getByTestId('side-nav-profile'));
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
