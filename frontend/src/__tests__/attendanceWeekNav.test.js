import '@testing-library/jest-dom';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { ThemeProvider } from '../theme';
import Attendance from '../pages/Attendance';
import Dashboard from '../pages/Dashboard';
import WeekView from '../components/attendance/WeekView';
import { attendanceApi, classApi, dashboardApi, studentApi, subjectApi, termApi } from '../api/endpoints';
import { useAuth } from '../auth/AuthContext';
import { addDays, schoolToday, schoolWeekStart } from '../utils/schoolTime';

jest.mock('../auth/AuthContext', () => ({ useAuth: jest.fn() }));

jest.mock('../api/endpoints', () => ({
    attendanceApi: { mark: jest.fn(), forClass: jest.fn(), daily: jest.fn(), week: jest.fn(), submissions: jest.fn(), returnMonth: jest.fn() },
    classApi: { list: jest.fn() },
    studentApi: { list: jest.fn() },
    subjectApi: { list: jest.fn() },
    dashboardApi: { summary: jest.fn(), dataFlow: jest.fn(), me: jest.fn() },
    termApi: { current: jest.fn() },
}));

/*
 * A week report like the API's, built around whatever week the tests run
 * in: this week is "Week 4 · Term 1", each week back counts down. Monday's
 * register is in; later past days are missing; future days are to come.
 */
const THIS_WEEK = schoolWeekStart();
const LAST_WEEK = addDays(THIS_WEEK, -7);
const WEEK = 7 * 24 * 60 * 60 * 1000;

const weekReport = (date) => {
    const weekStart = schoolWeekStart(date);
    const back = Math.round((Date.parse(THIS_WEEK) - Date.parse(weekStart)) / WEEK);
    const today = schoolToday();
    const dates = [0, 1, 2, 3, 4].map((i) => addDays(weekStart, i));
    const status = (d, i) => {
        if (d > today) return 'upcoming';
        if (i === 0) return 'taken';
        return d === today ? 'pending' : 'not_taken';
    };
    return {
        weekStart,
        weekEnd: dates[4],
        today,
        isCurrentWeek: back === 0,
        term: { name: 'Term 1', weekNumber: 4 - back, weekCount: 14 },
        previousWeek: addDays(weekStart, -7),
        nextWeek: back > 0 ? addDays(weekStart, 7) : null,
        days: dates.map((d, i) => ({
            date: d, label: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'][i], isToday: d === today, isFuture: d > today,
            closed: null, taken: i === 0 ? 1 : 0, expected: d > today ? 0 : 1,
        })),
        classes: [{
            classId: 'c-blue', className: 'Year 3 - Blue', mainTeacher: 'Ms. Mahilet', roster: 2, taken: 1, expected: 1,
            days: dates.map((d, i) => ({
                date: d, status: status(d, i), marked: i === 0 ? 2 : 0, present: i === 0 ? 2 : 0,
                late: 0, absent: 0, excused: 0, rate: i === 0 ? 100 : null,
            })),
        }],
        totals: { expected: 1, taken: 1, missing: 0, marked: 2, present: 2, late: 0, absent: 0, excused: 0, rate: 100 },
    };
};

const renderAt = (ui, path = '/app/attendance') => render(
    <ThemeProvider>
        <MemoryRouter initialEntries={[path]}>{ui}</MemoryRouter>
    </ThemeProvider>,
);

beforeEach(() => {
    jest.clearAllMocks();
    useAuth.mockReturnValue({ user: { id: 'a1', role: 'admin', name: 'Admin' }, isAdmin: true });
    attendanceApi.week.mockImplementation(async ({ date }) => weekReport(date));
    attendanceApi.daily.mockImplementation(async ({ date }) => ({
        date, isToday: date === schoolToday(), reminderTime: '08:45', classes: [],
        totals: { classes: 0, taken: 0, notTaken: 0, partial: 0, roster: 0, marked: 0, present: 0, late: 0, absent: 0, excused: 0, rate: null },
    }));
    attendanceApi.forClass.mockResolvedValue([]);
    classApi.list.mockResolvedValue([{ id: 'c-blue', name: 'Year 3 - Blue' }]);
    studentApi.list.mockResolvedValue([]);
    subjectApi.list.mockResolvedValue([]);
    dashboardApi.summary.mockResolvedValue({
        students: 390, classes: 14, staff: 33, openThreads: 0, openTasks: 0,
        attendanceToday: { marked: 0, present: 0, rate: null }, pendingLeaveRequests: 0, overdueBooks: 0,
    });
    dashboardApi.dataFlow.mockResolvedValue({ role: 'admin', healthScore: 90, openItems: 0, flows: [] });
    termApi.current.mockResolvedValue({ term: { name: 'Term 1', weekCount: 14 }, currentWeek: 4 });
});

describe('Attendance — weekly view with previous-week navigation', () => {
    test('opens on this week (Week 4) and steps back to Week 3 and home again', async () => {
        renderAt(<Attendance />);
        fireEvent.click(await screen.findByRole('tab', { name: /weekly/i }));

        expect(await screen.findByText('Week 4 · Term 1')).toBeInTheDocument();
        expect(attendanceApi.week).toHaveBeenCalledWith({ date: THIS_WEEK });
        expect(screen.getByRole('button', { name: 'Next week' })).toBeDisabled();
        expect(screen.queryByRole('button', { name: 'This week' })).not.toBeInTheDocument();

        fireEvent.click(screen.getByRole('button', { name: 'Previous week' }));
        expect(await screen.findByText('Week 3 · Term 1')).toBeInTheDocument();
        expect(attendanceApi.week).toHaveBeenLastCalledWith({ date: LAST_WEEK });
        expect(screen.getByRole('button', { name: 'Next week' })).toBeEnabled();
        // A past week is a fixed record: no "Live" claim.
        expect(screen.getByTestId('live-status')).toHaveTextContent(/^Updated/);

        fireEvent.click(screen.getByRole('button', { name: 'This week' }));
        expect(await screen.findByText('Week 4 · Term 1')).toBeInTheDocument();
    });

    test('a missing register in a past week opens that class’s register for that day', async () => {
        renderAt(<Attendance />, `/app/attendance?week=${LAST_WEEK}`);
        expect(await screen.findByText('Week 3 · Term 1')).toBeInTheDocument();
        expect(screen.getByRole('tab', { name: /weekly/i })).toHaveAttribute('aria-selected', 'true');

        // Step back once more, to Week 2, then open a missing register there.
        const twoWeeksAgo = addDays(LAST_WEEK, -7);
        fireEvent.click(screen.getByRole('button', { name: 'Previous week' }));
        expect(await screen.findByText('Week 2 · Term 1')).toBeInTheDocument();

        const tuesday = addDays(twoWeeksAgo, 1);
        const table = screen.getByRole('table', { name: /attendance by class and day/i });
        fireEvent.click(within(table).getByRole('button', { name: `Take register ${tuesday}` }));

        expect(await screen.findByRole('tab', { name: /daily register/i })).toHaveAttribute('aria-selected', 'true');
        await waitFor(() => expect(attendanceApi.forClass).toHaveBeenCalledWith({ classId: 'c-blue', date: tuesday, subjectId: undefined }));

        // Back on the Weekly tab, the week the admin was looking at is still showing.
        fireEvent.click(screen.getByRole('tab', { name: /weekly/i }));
        expect(await screen.findByText('Week 2 · Term 1')).toBeInTheDocument();
    });

    test('a day heading opens the daily report for that day', async () => {
        renderAt(<Attendance />, `/app/attendance?week=${LAST_WEEK}`);
        await screen.findByText('Week 3 · Term 1');
        fireEvent.click(screen.getByRole('button', { name: `Daily report ${LAST_WEEK}` }));

        expect(await screen.findByRole('tab', { name: /daily report/i })).toHaveAttribute('aria-selected', 'true');
        await waitFor(() => expect(attendanceApi.daily).toHaveBeenLastCalledWith({ date: LAST_WEEK }));
    });
});

describe('Dashboard — the attendance week card', () => {
    test('◀ steps back a week; "Open attendance" opens that week', async () => {
        renderAt(<Dashboard />, '/app');

        expect(await screen.findByText('Attendance this week')).toBeInTheDocument();
        expect(await screen.findByText('Week 4 · Term 1')).toBeInTheDocument();

        fireEvent.click(screen.getByRole('button', { name: 'Previous week' }));
        expect(await screen.findByText('Week 3 · Term 1')).toBeInTheDocument();
        expect(screen.getByText('Attendance by week')).toBeInTheDocument();
        expect(attendanceApi.week).toHaveBeenLastCalledWith({ date: LAST_WEEK });
        expect(screen.getByRole('link', { name: 'Open attendance' })).toHaveAttribute('href', `/app/attendance?week=${LAST_WEEK}`);

        // Missing past registers stand out; each cell opens its register.
        const tuesday = addDays(LAST_WEEK, 1);
        const cell = screen.getByRole('link', { name: `Year 3 - Blue ${tuesday} attendance` });
        expect(cell).toHaveAttribute('href', `/app/attendance?classId=c-blue&date=${tuesday}`);
    });
});

/*
 * Every status the API can send, on fixed dates (rendering follows the
 * status, not the real clock): Monday taken/partial, Tuesday a holiday,
 * Wednesday one register missing, Thursday "today" with one still open,
 * Friday to come.
 */
const everyStatus = (weekStart) => {
    const d = [0, 1, 2, 3, 4].map((i) => addDays(weekStart, i));
    const cell = (date, status, marked = 0) => ({
        date, status, marked, present: marked, late: 0, absent: 0, excused: 0, rate: marked ? 100 : null,
    });
    return {
        weekStart, weekEnd: d[4], today: d[3], isCurrentWeek: false,
        term: { name: 'Term 1', weekNumber: 3, weekCount: 14 },
        previousWeek: addDays(weekStart, -7), nextWeek: addDays(weekStart, 7),
        days: [
            { date: d[0], label: 'Mon', isToday: false, isFuture: false, closed: null, taken: 2, expected: 2 },
            { date: d[1], label: 'Tue', isToday: false, isFuture: false, closed: 'Meskel holiday', taken: 0, expected: 0 },
            { date: d[2], label: 'Wed', isToday: false, isFuture: false, closed: null, taken: 1, expected: 2 },
            { date: d[3], label: 'Thu', isToday: true, isFuture: false, closed: null, taken: 1, expected: 2 },
            { date: d[4], label: 'Fri', isToday: false, isFuture: true, closed: null, taken: 0, expected: 0 },
        ],
        classes: [
            {
                classId: 'c-blue', className: 'Year 3 - Blue', mainTeacher: 'Ms. Mahilet', roster: 2, taken: 1, expected: 3,
                days: [cell(d[0], 'taken', 2), cell(d[1], 'closed'), cell(d[2], 'not_taken'), cell(d[3], 'pending'), cell(d[4], 'upcoming')],
            },
            {
                classId: 'c-green', className: 'Year 3 - Green', mainTeacher: null, roster: 3, taken: 3, expected: 3,
                days: [cell(d[0], 'partial', 2), cell(d[1], 'closed'), cell(d[2], 'taken', 3), cell(d[3], 'taken', 3), cell(d[4], 'upcoming')],
            },
        ],
        totals: { expected: 6, taken: 4, missing: 1, openToday: 1, marked: 10, present: 10, late: 0, absent: 0, excused: 0, rate: 100 },
    };
};

describe('every register status reads clearly', () => {
    test('weekly grid: Missing only for past days; today is "Not yet"; holidays are closed', async () => {
        attendanceApi.week.mockImplementation(async ({ date }) => everyStatus(date));
        const onOpenRegister = jest.fn();
        renderAt(<WeekView weekStart={LAST_WEEK} onWeekChange={() => {}} onOpenRegister={onOpenRegister} />);

        const table = await screen.findByRole('table', { name: /attendance by class and day/i });
        const [wed, thu] = [addDays(LAST_WEEK, 2), addDays(LAST_WEEK, 3)];
        expect(within(table).getAllByText('Missing')).toHaveLength(1);
        expect(within(table).getAllByText('Not yet')).toHaveLength(1);
        expect(within(table).getByText('Meskel holiday')).toBeInTheDocument();
        expect(within(table).getByText('2/3')).toBeInTheDocument(); // the partial register

        // Both untaken cells open the register; the open one counts apart from missing.
        expect(within(table).getByRole('button', { name: `Take register ${wed}` })).toBeInTheDocument();
        fireEvent.click(within(table).getByRole('button', { name: `Take register ${thu}` }));
        expect(onOpenRegister).toHaveBeenCalledWith('c-blue', thu);
        expect(screen.getByText('+ 1 still open today')).toBeInTheDocument();
    });

    test('dashboard card: a missed day is a red box, today\u2019s open register a grey one', async () => {
        attendanceApi.week.mockImplementation(async ({ date }) => everyStatus(date));
        renderAt(<Dashboard />, '/app');

        const wed = addDays(THIS_WEEK, 2);
        const thu = addDays(THIS_WEEK, 3);
        const missed = await screen.findByRole('link', { name: `Year 3 - Blue ${wed} attendance` });
        expect(within(missed).getByLabelText('Attendance not taken')).toBeInTheDocument();
        const open = screen.getByRole('link', { name: `Year 3 - Blue ${thu} attendance` });
        expect(within(open).getByLabelText('Attendance not taken yet today')).toBeInTheDocument();
        expect(screen.getByRole('link', { name: `Year 3 - Green ${addDays(THIS_WEEK, 0)} attendance` }))
            .toContainElement(screen.getAllByLabelText('Attendance partly taken')[0]);
        // Holidays and days to come are not links.
        expect(screen.queryByRole('link', { name: `Year 3 - Blue ${addDays(THIS_WEEK, 1)} attendance` })).not.toBeInTheDocument();
    });
});
