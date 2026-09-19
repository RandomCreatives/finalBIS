import '@testing-library/jest-dom';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { ThemeProvider } from '../theme';
import SubjectHome from '../pages/SubjectHome';

jest.mock('../auth/AuthContext', () => ({
    useAuth: () => ({
        user: { id: 't1', name: 'English Teacher 1', role: 'subject_teacher' },
        logout: jest.fn(),
    }),
}));

jest.mock('../api/endpoints', () => ({
    assignmentApi: {
        subjects: jest.fn().mockResolvedValue({ assignments: [] }),
    },
    assessmentApi: {
        list: jest.fn().mockResolvedValue({ assessments: [] }),
    },
    studentApi: {
        list: jest.fn().mockResolvedValue({ students: [] }),
    },
    termApi: {
        current: jest.fn().mockResolvedValue({ term: { id: 'term-1', name: 'Term 1' } }),
    },
    timetableApi: {
        myWeek: jest.fn().mockResolvedValue([]),
        forClass: jest.fn().mockResolvedValue({ slots: [] }),
    },
    authApi: { me: jest.fn().mockRejectedValue(new Error('no session')) },
}));

const renderHome = () =>
    render(
        <ThemeProvider>
            <MemoryRouter initialEntries={['/subject-home']}>
                <SubjectHome />
            </MemoryRouter>
        </ThemeProvider>,
    );

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

    test('Planning opens the shared planning-documents workspace (teacher bucket)', () => {
        renderHome();
        fireEvent.click(within(screen.getByTestId('side-nav')).getByRole('button', { name: 'Planning' }));
        expect(screen.getByRole('button', { name: /New Scheme of Work/i })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /New Lesson Plan/i })).toBeInTheDocument();
    });

    test('Calendar opens the shared school calendar board', () => {
        renderHome();
        fireEvent.click(within(screen.getByTestId('side-nav')).getByRole('button', { name: 'Calendar' }));
        expect(screen.getByText('Upcoming')).toBeInTheDocument();
    });
});
