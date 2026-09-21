import '@testing-library/jest-dom';
import { fireEvent, render, screen } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { ThemeProvider } from '../theme';
import Timetable from '../pages/Timetable';
import { timetableApi, classApi, assignmentApi } from '../api/endpoints';
import { useAuth } from '../auth/AuthContext';

jest.mock('../auth/AuthContext', () => ({ useAuth: jest.fn() }));

jest.mock('../api/endpoints', () => ({
    timetableApi: {
        myWeek: jest.fn(),
        get: jest.fn(),
        roster: jest.fn(),
        create: jest.fn(),
        remove: jest.fn(),
    },
    classApi: { list: jest.fn() },
    assignmentApi: { subjects: jest.fn() },
}));

const renderPage = () =>
    render(
        <ThemeProvider>
            <BrowserRouter>
                <Timetable />
            </BrowserRouter>
        </ThemeProvider>,
    );

beforeEach(() => {
    jest.clearAllMocks();
    useAuth.mockReturnValue({ user: { id: 'u1', role: 'admin', name: 'Admin' }, isAdmin: true });
    classApi.list.mockResolvedValue([{ id: 'c1', name: 'Year 3 - Blue' }]);
    timetableApi.myWeek.mockResolvedValue([]);
    timetableApi.get.mockResolvedValue([]);
    timetableApi.roster.mockResolvedValue(null);
    assignmentApi.subjects.mockResolvedValue({ academicYearId: 'y1', assignments: [] });
});

describe('Timetable page', () => {
    test('admin sees Week, Class schedule and Who attends as tabs, week first', async () => {
        renderPage();

        const tabs = await screen.findAllByRole('tab');
        expect(tabs.map((t) => t.textContent)).toEqual(['Week', 'Class schedule', 'Who attends']);

        // Week is the default view — its legend shows, roster prompts stay hidden.
        expect(screen.getByText('Main-teacher subject')).toBeInTheDocument();
        expect(screen.queryByText('Choose a class to see everyone attached to it.')).not.toBeInTheDocument();
    });

    test('switching to Who attends swaps the panel without the week legend', async () => {
        renderPage();

        fireEvent.click(await screen.findByRole('tab', { name: /who attends/i }));

        expect(await screen.findByText('Choose a class to see everyone attached to it.')).toBeInTheDocument();
        expect(screen.queryByText('Main-teacher subject')).not.toBeInTheDocument();
        // week/grid class picker appears on class-bound tabs
        expect(screen.getByLabelText('Class')).toBeInTheDocument();
    });

    test('subject teachers keep the single schedule view with no tab bar', async () => {
        useAuth.mockReturnValue({ user: { id: 'u2', role: 'subject_teacher', name: 'Dawit' }, isAdmin: false });

        renderPage();

        expect(await screen.findByText('Your weekly teaching schedule.')).toBeInTheDocument();
        expect(screen.queryByRole('tab')).not.toBeInTheDocument();
    });
});
