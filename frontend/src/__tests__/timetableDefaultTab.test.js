import '@testing-library/jest-dom';
import { render, screen } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { ThemeProvider } from '../theme';
import Timetable from '../pages/Timetable';
import { timetableApi, classApi, assignmentApi } from '../api/endpoints';
import { useAuth } from '../auth/AuthContext';

jest.mock('../auth/AuthContext', () => ({
    useAuth: jest.fn(),
}));

jest.mock('../api/endpoints', () => ({
    timetableApi: {
        myWeek: jest.fn(),
        get: jest.fn(),
        roster: jest.fn(),
    },
    classApi: {
        list: jest.fn(),
    },
    assignmentApi: {
        subjects: jest.fn(),
    },
}));

const renderPage = (user, isAdmin) => {
    useAuth.mockReturnValue({ user, isAdmin });
    return render(
        <ThemeProvider>
            <BrowserRouter>
                <Timetable />
            </BrowserRouter>
        </ThemeProvider>,
    );
};

const selectedTab = () => screen.getAllByRole('tab').find((t) => t.getAttribute('aria-selected') === 'true');

beforeEach(() => {
    jest.clearAllMocks();
    timetableApi.myWeek.mockResolvedValue([]);
    timetableApi.get.mockResolvedValue([]);
    timetableApi.roster.mockResolvedValue(null);
    classApi.list.mockResolvedValue([]);
    assignmentApi.subjects.mockResolvedValue([]);
});

test('an admin lands on the Class schedule tab — they have no week of their own', async () => {
    renderPage({ id: 'u-admin', name: 'Mr. Mike', role: 'admin' }, true);

    expect(selectedTab()).toHaveTextContent('Class schedule');
    // The class picker for the schedule view is right there.
    expect(await screen.findByLabelText('Class')).toBeInTheDocument();
});

test('a main teacher still lands on their own Week tab', () => {
    renderPage({ id: 'u-main', name: 'Meron', role: 'main_teacher' }, false);

    expect(selectedTab()).toHaveTextContent('Week');
});
