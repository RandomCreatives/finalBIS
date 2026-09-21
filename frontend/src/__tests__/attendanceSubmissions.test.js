import '@testing-library/jest-dom';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { ThemeProvider } from '../theme';
import Attendance from '../pages/Attendance';
import { attendanceApi, classApi, studentApi, subjectApi } from '../api/endpoints';
import { useAuth } from '../auth/AuthContext';

jest.mock('../auth/AuthContext', () => ({ useAuth: jest.fn() }));

jest.mock('../api/endpoints', () => ({
    attendanceApi: {
        mark: jest.fn(),
        forClass: jest.fn(),
        forStudent: jest.fn(),
        monthly: jest.fn(),
        monthlyGrid: jest.fn(),
        submitMonth: jest.fn(),
        returnMonth: jest.fn(),
        submissions: jest.fn(),
        reportCsv: jest.fn(),
    },
    classApi: { list: jest.fn() },
    studentApi: { list: jest.fn() },
    subjectApi: { list: jest.fn() },
}));

const MONTH = new Date().toISOString().slice(0, 7);

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

    test('teachers keep the plain register with no tabs', async () => {
        useAuth.mockReturnValue({ user: { id: 't1', role: 'main_teacher', name: 'Meron' } });
        renderPage();

        expect(await screen.findByText(/Choose a class to begin/)).toBeInTheDocument();
        expect(screen.queryByRole('tab')).not.toBeInTheDocument();
    });
});
