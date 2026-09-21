import '@testing-library/jest-dom';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import Dashboard from '../pages/Dashboard';
import { ThemeProvider } from '../theme';
import { useAuth } from '../auth/AuthContext';
import { dashboardApi, termApi } from '../api/endpoints';

jest.mock('../auth/AuthContext', () => ({
    useAuth: jest.fn(),
}));

jest.mock('../api/endpoints', () => ({
    dashboardApi: {
        dataFlow: jest.fn(),
        summary: jest.fn(),
        me: jest.fn(),
    },
    termApi: { current: jest.fn() },
}));

const renderDashboard = () =>
    render(
        <ThemeProvider>
            <MemoryRouter initialEntries={['/app']}>
                <Dashboard />
            </MemoryRouter>
        </ThemeProvider>,
    );

beforeEach(() => {
    jest.clearAllMocks();
    useAuth.mockReturnValue({
        user: { id: 'u1', name: 'Mr. Mike Coordinator', role: 'admin' },
        isAdmin: true,
    });
    termApi.current.mockResolvedValue({ term: { name: 'Term 1', weekCount: 13 }, currentWeek: 0 });
    dashboardApi.summary.mockResolvedValue({
        students: 390, classes: 14, staff: 33,
        attendanceToday: { marked: 0, present: 0, rate: 0 },
        pendingLeaveRequests: 1, overdueBooks: 0,
    });
    dashboardApi.dataFlow.mockResolvedValue({
        role: 'admin', healthScore: 92, openItems: 4, flows: [],
    });
});

describe('Dashboard — collapsible data flow', () => {
    test('glance cards show immediately while the command center stays folded', async () => {
        renderDashboard();
        // the everyday numbers are visible…
        expect(await screen.findByText('Active students')).toBeInTheDocument();
        expect(screen.getByText('390')).toBeInTheDocument();
        expect(screen.getByText('Attendance today')).toBeInTheDocument();
        // …and the busy command center is collapsed to a single bar
        expect(screen.getByText('Teacher ↔ Admin data flow')).toBeInTheDocument();
        expect(screen.queryByText('Flow health')).not.toBeInTheDocument();
    });

    test('one tap expands the full data-flow map, tap again refolds', async () => {
        renderDashboard();
        const bar = (await screen.findByText('Teacher ↔ Admin data flow'))
            .closest('[class*="MuiStack-root"]');
        fireEvent.click(bar);
        expect(await screen.findByText('Flow health')).toBeInTheDocument();
        expect(screen.getByText('92%')).toBeInTheDocument();

        fireEvent.click(screen.getByText('Teacher ↔ Admin data flow').closest('[class*="MuiStack-root"]'));
        // the folded content unmounts once the exit transition settles
        await waitFor(() => expect(screen.queryByText('Flow health')).not.toBeInTheDocument());
    });

    test('the sign-in activity card surfaces who needs a nudge', async () => {
        dashboardApi.dataFlow.mockResolvedValue({
            role: 'admin', healthScore: 70, openItems: 3,
            flows: [{
                id: 'signins', title: 'Staff sign-in activity',
                source: 'Active staff accounts', destination: 'Teacher portals',
                metric: '6/14 staff active this week',
                detail: '8 never signed in · 0 quiet for 3+ days.',
                progress: 43, status: 'critical', href: '/app/staff',
                nextAction: 'Nudge the staff listed on the Staff page',
            }],
        });
        renderDashboard();
        fireEvent.click((await screen.findByText('Teacher ↔ Admin data flow')).closest('[class*="MuiStack-root"]'));

        expect(await screen.findByText('Staff sign-in activity')).toBeInTheDocument();
        expect(screen.getByText('6/14 staff active this week')).toBeInTheDocument();
        expect(screen.getByText('8 never signed in · 0 quiet for 3+ days.')).toBeInTheDocument();
    });
});
