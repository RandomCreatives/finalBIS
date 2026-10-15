import '@testing-library/jest-dom';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { ThemeProvider } from '../theme';
import Calendar from '../pages/Calendar';
import { calendarApi, classApi, termApi } from '../api/endpoints';
import { useAuth } from '../auth/AuthContext';
import { schoolMonth } from '../utils/schoolTime';

jest.mock('../auth/AuthContext', () => ({ useAuth: jest.fn() }));

jest.mock('../api/endpoints', () => ({
    calendarApi: { list: jest.fn(), create: jest.fn(), update: jest.fn(), remove: jest.fn() },
    termApi: { list: jest.fn(), current: jest.fn(), create: jest.fn(), update: jest.fn(), setCurrent: jest.fn() },
    classApi: { list: jest.fn() },
}));

/*
 * The suite runs in Addis Ababa time (src/testTimezone.js). There, local
 * midnight is 21:00 UTC the previous day, so building month cells with
 * toISOString() shifted the whole month back a day and dropped its last day.
 */
const MONTH = schoolMonth();
const [Y, M] = MONTH.split('-').map(Number);
const LAST = String(new Date(Date.UTC(Y, M, 0)).getUTCDate()).padStart(2, '0');

beforeEach(() => {
    jest.clearAllMocks();
    useAuth.mockReturnValue({ user: { id: 'a1', role: 'admin', name: 'Admin' }, isAdmin: true });
    termApi.list.mockResolvedValue([]);
    termApi.current.mockResolvedValue({ term: null, currentWeek: null });
    classApi.list.mockResolvedValue([]);
    calendarApi.list.mockResolvedValue({
        events: [
            { id: 'e1', title: 'First-day assembly', category: 'event', startsOn: `${MONTH}-01`, endsOn: `${MONTH}-01` },
            { id: 'e2', title: 'Month-end review', category: 'meeting', startsOn: `${MONTH}-${LAST}`, endsOn: `${MONTH}-${LAST}` },
        ],
    });
});

test('the month view covers the whole school month on an Addis Ababa device', async () => {
    render(
        <ThemeProvider>
            <MemoryRouter>
                <Calendar />
            </MemoryRouter>
        </ThemeProvider>,
    );

    await waitFor(() => expect(calendarApi.list).toHaveBeenCalledWith({ from: `${MONTH}-01`, to: `${MONTH}-${LAST}` }));
    // Both land in the month grid (the cell's tooltip labels the event).
    expect(await screen.findByLabelText('First-day assembly')).toBeInTheDocument();
    expect(screen.getByLabelText('Month-end review')).toBeInTheDocument();
});
