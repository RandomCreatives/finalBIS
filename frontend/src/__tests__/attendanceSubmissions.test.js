import '@testing-library/jest-dom';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { ThemeProvider } from '../theme';
import Attendance from '../pages/Attendance';
import { attendanceApi, classApi, studentApi, subjectApi } from '../api/endpoints';
import { useAuth } from '../auth/AuthContext';
import { schoolMonth } from '../utils/schoolTime';

jest.mock('../auth/AuthContext', () => ({ useAuth: jest.fn() }));

jest.mock('../api/endpoints', () => ({
    attendanceApi: {
        mark: jest.fn(),
        forClass: jest.fn(),
        forStudent: jest.fn(),
        monthly: jest.fn(),
        daily: jest.fn(),
        week: jest.fn(),
        monthlyGrid: jest.fn(),
        submitMonth: jest.fn(),
        returnMonth: jest.fn(),
        submissions: jest.fn(),
        reportCsv: jest.fn(),
        reportXlsx: jest.fn(),
    },
    classApi: { list: jest.fn() },
    studentApi: { list: jest.fn() },
    subjectApi: { list: jest.fn() },
}));

const MONTH = schoolMonth();

const SUBMISSIONS = {
    submissions: [
        {
            classId: 'c-blue', className: 'Year 3 - Blue', month: MONTH,
            status: 'submitted', submittedAt: `${MONTH}-21T08:30:00.000Z`, note: null,
        },
        {
            classId: 'c-green', className: 'Year 3 - Green', month: MONTH,
            status: 'pending', submittedAt: null, note: null,
        },
        {
            classId: 'c-red', className: 'Year 3 - Red', month: MONTH,
            status: 'returned', submittedAt: `${MONTH}-20T09:00:00.000Z`,
            note: 'Week two absences look swapped with Year 3 Yellow.',
        },
    ],
};

const renderPage = () =>
    render(
        <ThemeProvider>
            <BrowserRouter>
                <Attendance />
            </BrowserRouter>
        </ThemeProvider>,
    );

beforeEach(() => {
    jest.clearAllMocks();
    classApi.list.mockResolvedValue([{ id: 'c-blue', name: 'Year 3 - Blue' }]);
    studentApi.list.mockResolvedValue([]);
    subjectApi.list.mockResolvedValue([]);
    attendanceApi.forClass.mockResolvedValue([]);
    attendanceApi.submissions.mockResolvedValue(SUBMISSIONS);
    attendanceApi.returnMonth.mockResolvedValue({ message: 'returned' });
    attendanceApi.daily.mockResolvedValue({
        date: '2026-10-15', isToday: true, reminderTime: '08:45', classes: [],
        totals: { classes: 0, taken: 0, notTaken: 0, partial: 0, roster: 0, marked: 0, present: 0, late: 0, absent: 0, excused: 0, rate: null },
    });
});

describe('Attendance — admin monthly submissions', () => {
    test('the admin gets a Monthly submissions tab listing every class', async () => {
        useAuth.mockReturnValue({ user: { id: 'a1', role: 'admin', name: 'Admin' }, isAdmin: true });
        renderPage();

        fireEvent.click(await screen.findByRole('tab', { name: /monthly submissions/i }));

        const table = await screen.findByRole('table');
        expect(within(table).getByText('Year 3 - Blue')).toBeInTheDocument();
        expect(within(table).getByText('Year 3 - Green')).toBeInTheDocument();
        expect(within(table).getByText('Year 3 - Red')).toBeInTheDocument();

        expect(within(table).getByText('Submitted')).toBeInTheDocument();
        expect(within(table).getByText('Not submitted')).toBeInTheDocument();
        expect(within(table).getByText('Returned for correction')).toBeInTheDocument();
        // The return reason stays visible for the paper trail.
        expect(within(table).getByText(/swapped with Year 3 Yellow/)).toBeInTheDocument();
    });

    test('returning a submitted month sends the mandatory note', async () => {
        useAuth.mockReturnValue({ user: { id: 'a1', role: 'admin', name: 'Admin' }, isAdmin: true });
        renderPage();

        fireEvent.click(await screen.findByRole('tab', { name: /monthly submissions/i }));
        fireEvent.click(await screen.findByRole('button', { name: /return for correction/i }));

        // No note, no return — the paper trail is mandatory.
        const confirm = await screen.findByRole('button', { name: /return and unlock/i });
        expect(confirm).toBeDisabled();

        fireEvent.change(screen.getByLabelText(/why is it being returned/i), {
            target: { value: 'Two days are blank, please complete and resubmit' },
        });
        fireEvent.click(confirm);

        await waitFor(() => expect(attendanceApi.returnMonth).toHaveBeenCalledWith({
            classId: 'c-blue',
            month: MONTH,
            note: 'Two days are blank, please complete and resubmit',
        }));
        expect(attendanceApi.submissions).toHaveBeenCalledTimes(2); // reloaded after the return

        // Wait for the dialog to close — while it is open MUI aria-hides the table behind it.
        await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
        // Only a submitted month can be returned — pending/returned rows have no button.
        expect(screen.getAllByRole('button', { name: /return for correction/i })).toHaveLength(1);
    });

    test('the admin downloads a monthly workbook for a selected class', async () => {
        useAuth.mockReturnValue({ user: { id: 'a1', role: 'admin', name: 'Admin' }, isAdmin: true });
        attendanceApi.reportXlsx.mockResolvedValue(new Blob(['xlsx']));

        const createObjectURLDescriptor = Object.getOwnPropertyDescriptor(URL, 'createObjectURL');
        const revokeObjectURLDescriptor = Object.getOwnPropertyDescriptor(URL, 'revokeObjectURL');
        const createObjectURL = jest.fn(() => 'blob:attendance-report');
        const revokeObjectURL = jest.fn();
        Object.defineProperty(URL, 'createObjectURL', { configurable: true, value: createObjectURL });
        Object.defineProperty(URL, 'revokeObjectURL', { configurable: true, value: revokeObjectURL });
        const anchorClick = jest.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});

        try {
            renderPage();
            fireEvent.click(await screen.findByRole('button', { name: /download monthly report/i }));

            const dialog = await screen.findByRole('dialog');
            expect(within(dialog).getByText(/homeroom-attendance sheet for each class/i)).toBeInTheDocument();
            fireEvent.change(within(dialog).getByLabelText(/Month/), { target: { value: '2025-01' } });

            const classSelect = within(dialog).getByRole('combobox', { name: 'Class' });
            fireEvent.mouseDown(classSelect);
            fireEvent.click(await screen.findByRole('option', { name: 'Year 3 - Blue' }));
            fireEvent.click(within(dialog).getByRole('button', { name: 'Download report' }));

            await waitFor(() => expect(attendanceApi.reportXlsx).toHaveBeenCalledWith({
                month: '2025-01',
                classId: 'c-blue',
            }));
            expect(createObjectURL).toHaveBeenCalledWith(expect.any(Blob));
            expect(anchorClick).toHaveBeenCalled();
            expect(await screen.findByText('Monthly attendance report downloaded')).toBeInTheDocument();
        } finally {
            anchorClick.mockRestore();
            if (createObjectURLDescriptor) Object.defineProperty(URL, 'createObjectURL', createObjectURLDescriptor);
            else delete URL.createObjectURL;
            if (revokeObjectURLDescriptor) Object.defineProperty(URL, 'revokeObjectURL', revokeObjectURLDescriptor);
            else delete URL.revokeObjectURL;
        }
    });

    test('teachers keep the plain register with no tabs', async () => {
        useAuth.mockReturnValue({ user: { id: 't1', role: 'main_teacher', name: 'Meron' } });
        renderPage();

        expect(await screen.findByText(/Choose a class to begin/)).toBeInTheDocument();
        expect(screen.queryByRole('tab')).not.toBeInTheDocument();
        expect(screen.queryByRole('button', { name: /download monthly report/i })).not.toBeInTheDocument();
    });
});
