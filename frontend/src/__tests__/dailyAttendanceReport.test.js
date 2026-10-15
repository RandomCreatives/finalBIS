import '@testing-library/jest-dom';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { ThemeProvider } from '../theme';
import Attendance from '../pages/Attendance';
import { attendanceApi, classApi, studentApi, subjectApi } from '../api/endpoints';
import { useAuth } from '../auth/AuthContext';
import { schoolToday } from '../utils/schoolTime';

jest.mock('../auth/AuthContext', () => ({ useAuth: jest.fn() }));

jest.mock('../api/endpoints', () => ({
    attendanceApi: {
        mark: jest.fn(),
        forClass: jest.fn(),
        daily: jest.fn(),
        submissions: jest.fn(),
        returnMonth: jest.fn(),
    },
    classApi: { list: jest.fn() },
    studentApi: { list: jest.fn() },
    subjectApi: { list: jest.fn() },
}));

const TODAY = schoolToday();

const row = (over) => ({
    classId: 'c', className: 'Class', mainTeacher: null, status: 'not_taken', roster: 2, marked: 0,
    present: 0, late: 0, absent: 0, excused: 0, rate: null, lastSavedAt: null, lastSavedBy: null, ...over,
});

const REPORT = {
    date: TODAY, today: TODAY, isToday: true, timeZone: 'Africa/Addis_Ababa', reminderTime: '08:45',
    totals: { classes: 3, taken: 2, notTaken: 1, partial: 1, roster: 6, marked: 3, present: 1, late: 1, absent: 1, excused: 0, rate: 66.7 },
    classes: [
        row({ classId: 'c-red', className: 'Year 3 - Red', mainTeacher: 'Mr. Robel', status: 'taken', marked: 2,
            present: 1, late: 1, rate: 100, lastSavedAt: `${TODAY}T05:12:00.000Z`, lastSavedBy: 'Mr. Robel' }),
        row({ classId: 'c-blue', className: 'Year 3 - Blue', mainTeacher: 'Ms. Mahilet' }),
        row({ classId: 'c-green', className: 'Year 3 - Green', mainTeacher: 'Ms. Sena', status: 'partial', marked: 1,
            absent: 1, rate: 0, lastSavedAt: `${TODAY}T05:20:00.000Z`, lastSavedBy: 'Ms. Sena' }),
    ],
};

const renderPage = () => render(
    <ThemeProvider>
        <BrowserRouter>
            <Attendance />
        </BrowserRouter>
    </ThemeProvider>,
);

beforeEach(() => {
    jest.clearAllMocks();
    useAuth.mockReturnValue({ user: { id: 'a1', role: 'admin', name: 'Admin' }, isAdmin: true });
    attendanceApi.daily.mockResolvedValue(REPORT);
    classApi.list.mockResolvedValue([
        { id: 'c-blue', name: 'Year 3 - Blue' }, { id: 'c-green', name: 'Year 3 - Green' }, { id: 'c-red', name: 'Year 3 - Red' },
    ]);
    studentApi.list.mockResolvedValue([{ id: 's1', name: 'Abel', admissionNo: 'BIS-1' }]);
    subjectApi.list.mockResolvedValue([]);
    attendanceApi.forClass.mockResolvedValue([]);
});

describe('Attendance — the office’s live daily report', () => {
    test('opens on today’s report: missing registers first, times in Ethiopian time', async () => {
        renderPage();

        const tab = await screen.findByRole('tab', { name: /daily report/i });
        expect(tab).toHaveAttribute('aria-selected', 'true');
        expect(attendanceApi.daily).toHaveBeenCalledWith({ date: TODAY });

        const table = await screen.findByRole('table', { name: /daily attendance by class/i });
        const rows = within(table).getAllByRole('row').slice(1);
        expect(rows.map((r) => within(r).getAllByRole('cell')[0].textContent))
            .toEqual(['Year 3 - Blue', 'Year 3 - Green', 'Year 3 - Red']);
        expect(within(rows[0]).getByText('Not taken')).toBeInTheDocument();
        expect(within(rows[1]).getByText('Partly taken 1/2')).toBeInTheDocument();
        // Saved 05:12 UTC = 08:12 in Addis Ababa.
        expect(within(rows[2]).getByText('08:12 · Mr. Robel')).toBeInTheDocument();

        expect(screen.getByText('2/3')).toBeInTheDocument();
        expect(screen.getByText('66.7%')).toBeInTheDocument();
        expect(screen.getByText(/reminded automatically at 08:45 \(Ethiopian time\)/)).toBeInTheDocument();
        expect(screen.getByTestId('live-status')).toHaveTextContent(/Live · Updated \d\d:\d\d:\d\d EAT/);
    });

    test('“Take register” opens that class’s register for that day', async () => {
        renderPage();
        const table = await screen.findByRole('table', { name: /daily attendance by class/i });
        const blue = within(table).getAllByRole('row').find((r) => r.textContent.includes('Year 3 - Blue'));

        fireEvent.click(within(blue).getByRole('button', { name: /take register/i }));

        expect(await screen.findByRole('tab', { name: /daily register/i })).toHaveAttribute('aria-selected', 'true');
        await waitFor(() => expect(attendanceApi.forClass).toHaveBeenCalledWith({ classId: 'c-blue', date: TODAY, subjectId: undefined }));
    });

    test('a past day is a fixed record — it does not claim to be live', async () => {
        attendanceApi.daily.mockImplementation(async ({ date }) => ({ ...REPORT, date, isToday: date === TODAY }));
        renderPage();
        await screen.findByRole('table', { name: /daily attendance by class/i });

        fireEvent.change(screen.getByLabelText('Day'), { target: { value: '2026-09-01' } });
        await waitFor(() => expect(attendanceApi.daily).toHaveBeenLastCalledWith({ date: '2026-09-01' }));
        await waitFor(() => expect(screen.getByTestId('live-status')).toHaveTextContent(/^Updated/));
        expect(screen.getByRole('button', { name: /back to today/i })).toBeInTheDocument();
    });

    test('teachers keep the plain register, with no school-wide report', async () => {
        useAuth.mockReturnValue({ user: { id: 't1', role: 'main_teacher', name: 'Teacher' }, isAdmin: false });
        renderPage();
        expect(await screen.findByText(/Choose a class to begin/)).toBeInTheDocument();
        expect(screen.queryByRole('tab')).not.toBeInTheDocument();
        expect(attendanceApi.daily).not.toHaveBeenCalled();
    });
});
