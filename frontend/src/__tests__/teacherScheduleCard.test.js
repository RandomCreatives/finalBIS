import '@testing-library/jest-dom';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import Dashboard from '../pages/Dashboard';
import { ThemeProvider } from '../theme';
import { useAuth } from '../auth/AuthContext';
import { dashboardApi, termApi, timetableApi } from '../api/endpoints';

jest.mock('../auth/AuthContext', () => ({ useAuth: jest.fn() }));
jest.mock('../api/endpoints', () => ({
    dashboardApi: { dataFlow: jest.fn(), me: jest.fn() },
    attendanceApi: { week: jest.fn() },
    termApi: { current: jest.fn() },
    timetableApi: { myCurrent: jest.fn() },
}));

beforeEach(() => {
    jest.clearAllMocks();
    useAuth.mockReturnValue({
        user: { id: 'teacher-1', name: 'Ms. Meron', role: 'main_teacher' },
        isAdmin: false,
    });
    termApi.current.mockResolvedValue({ term: { name: 'Term 1', weekCount: 13 }, currentWeek: 5 });
    dashboardApi.dataFlow.mockResolvedValue({ role: 'main_teacher', healthScore: 100, openItems: 0, flows: [] });
    dashboardApi.me.mockResolvedValue({
        attendanceOutstanding: [], planningGaps: [], todaySlots: [], homerooms: [],
        teachingSubjects: [], openTasks: [], upcomingEvents: [], unreadMessages: 0,
    });
    timetableApi.myCurrent.mockResolvedValue({
        date: '2026-11-03', time: '10:45', timeZone: 'Africa/Addis_Ababa',
        current: {
            id: 'slot-3', periodNumber: 3, isRegistration: false,
            startsAt: '10:40:00', endsAt: '11:30:00', room: 'Room 4',
            subject: { id: 'math', name: 'Mathematics' },
            class: { id: 'y3-red', name: 'Year 3 - Red' },
        },
        next: null,
    });
});

test('teacher dashboard shows the current class, period, and room in a live card', async () => {
    render(
        <ThemeProvider>
            <MemoryRouter initialEntries={['/app']}>
                <Dashboard />
            </MemoryRouter>
        </ThemeProvider>,
    );

    expect(await screen.findByText('Your class / period')).toBeInTheDocument();
    expect(await screen.findByText('Happening now')).toBeInTheDocument();
    expect(screen.getByText('Mathematics — Year 3 - Red')).toBeInTheDocument();
    expect(screen.getByText(/Period 3 · 10:40–11:30 · Room 4/)).toBeInTheDocument();
});
