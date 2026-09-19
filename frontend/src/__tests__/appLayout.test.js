import '@testing-library/jest-dom';
import { render, screen, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import AppLayout from '../components/AppLayout';
import { ThemeProvider } from '../theme';
import { useAuth } from '../auth/AuthContext';
import { communicationsApi } from '../api/endpoints';

jest.mock('../auth/AuthContext', () => ({
    useAuth: jest.fn(),
}));

jest.mock('../api/endpoints', () => ({
    communicationsApi: { badgeCounts: jest.fn() },
}));

const renderShell = (role) => {
    useAuth.mockReturnValue({
        user: { id: 'u1', name: role === 'admin' ? 'Mr. Mike' : 'Ms. Teacher', role, email: 'u@bis.et' },
        logout: jest.fn(),
        isAdmin: role === 'admin',
    });
    return render(
        <ThemeProvider>
            <MemoryRouter initialEntries={['/app']}>
                <Routes>
                    <Route path="/app" element={<AppLayout />}>
                        <Route index element={<div>page body</div>} />
                    </Route>
                </Routes>
            </MemoryRouter>
        </ThemeProvider>,
    );
};

beforeEach(() => {
    jest.clearAllMocks();
    communicationsApi.badgeCounts.mockResolvedValue({
        storeRequestsPending: 2, permissionRequestsPending: 1, conductReportsPending: 0,
    });
});

describe('AppLayout (staff workspace shell)', () => {
    test('teacher-style chrome: brand header, grouped nav, settings pinned, page outlet', async () => {
        renderShell('admin');
        expect(screen.getByText('BIS NOC Gerji')).toBeInTheDocument();
        expect(screen.getByText(/Administration · 2026\/2027/)).toBeInTheDocument();
        expect(screen.getByText('page body')).toBeInTheDocument();

        const nav = screen.getByTestId('side-nav');
        expect(within(nav).getByTestId('side-nav-group-0')).toHaveTextContent('School Today');
        expect(within(nav).getByTestId('side-nav-group-3')).toHaveTextContent('Admin Communications');
        // settings pinned at the bottom, like Profile on the teacher dashboards
        expect(within(nav).getByTestId('side-nav-settings')).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Sign out' })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /switch to (light|dark) mode/i })).toBeInTheDocument();
    });

    test('admin sees Communications with the pending-count badge (dot shown)', async () => {
        renderShell('admin');
        expect(await screen.findAllByText('Communications')).not.toHaveLength(0);
        const nav = screen.getByTestId('side-nav');
        const link = within(nav).getByRole('link', { name: /Communications/ });
        // pending total 3 > 0 → the dot badge is visible
        expect(link.querySelector('.MuiBadge-dot')).not.toBeNull();
    });

    test('non-admin sees only the role-open items — no admin pages leak', () => {
        renderShell('main_teacher');
        const nav = screen.getByTestId('side-nav');
        expect(within(nav).queryByText('Communications')).not.toBeInTheDocument();
        expect(within(nav).queryByText('Staff')).not.toBeInTheDocument();
        expect(within(nav).queryByText('Subjects')).not.toBeInTheDocument();
        expect(within(nav).queryByText('Assignments')).not.toBeInTheDocument();
        // teacher keeps the everyday items (+ dashboard/calendar/timetable)
        expect(within(nav).getByText('Daily Planner')).toBeInTheDocument();
        expect(within(nav).getByText('Attendance')).toBeInTheDocument();
        expect(within(nav).getByText('Students')).toBeInTheDocument();
        expect(screen.getByText(/Main teacher workspace · 2026\/2027/)).toBeInTheDocument();
    });
});
