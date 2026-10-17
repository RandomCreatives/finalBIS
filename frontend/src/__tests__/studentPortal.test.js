import '@testing-library/jest-dom';
import { render, screen, fireEvent, cleanup, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import StudentPortal from '../pages/StudentPortal';
import { ThemeProvider } from '../theme';
import { useAuth } from '../auth/AuthContext';

jest.mock('../auth/AuthContext', () => ({
    useAuth: jest.fn(),
}));

jest.mock('../api/endpoints', () => ({
    classApi: { list: jest.fn() },
    termApi: { current: jest.fn() },
    studentApi: { list: jest.fn(), get: jest.fn() },
    marksheetApi: { forStudent: jest.fn() },
    attendanceApi: { forStudent: jest.fn() },
    paymentApi: { list: jest.fn() },
}));

const classes = [
    { id: 'c1', name: 'Year 4A' },
    { id: 'c2', name: 'Year 4B' },
];
const currentTerm = { id: 't1', name: 'Term 1' };
const students = [
    {
        id: 's1',
        name: 'Alem Tadesse',
        admissionNo: 'ADM-001',
        rollNum: 1,
        class: { name: 'Year 4A' },
        guardianName: 'Mrs Tadesse',
        guardianPhone: '0911111111',
        guardianEmail: 'mom@example.com',
        specialNeeds: true,
        specialNeedsNote: 'Seats near board',
    },
    {
        id: 's2',
        name: 'Bete Yohannes',
        admissionNo: 'ADM-002',
        rollNum: 2,
        class: { name: 'Year 4A' },
    },
];
const attendance = {
    attendance: [
        { id: 'a1', subject: { name: 'Homeroom' }, date: '2026-09-10', status: 'present' },
        { id: 'a2', subject: { name: 'English' }, date: '2026-09-09', status: 'absent' },
        { id: 'a3', subject: { name: 'Maths' }, date: '2026-09-08', status: 'late' },
    ],
    stats: { attendanceRate: 67, present: 1, late: 1, absent: 1 },
};
const marksheets = {
    marksheets: [
        { id: 'm1', subject: { name: 'English' }, marks: 85, percentage: 85, grade: 'A' },
        { id: 'm2', subject: { name: 'Maths' }, marks: 68, percentage: 68 },
    ],
};

const api = require('../api/endpoints');

const renderShell = () => {
    useAuth.mockReturnValue({
        user: { id: 'u1', name: 'Mr. Mike', role: 'main_teacher', email: 'u@bis.et' },
        logout: jest.fn(),
        isAdmin: false,
    });
    return render(
        <ThemeProvider>
            <MemoryRouter initialEntries={['/app/student-portal']}>
                <Routes>
                    <Route path="/app/student-portal" element={<StudentPortal />} />
                </Routes>
            </MemoryRouter>
        </ThemeProvider>,
    );
};

beforeEach(() => {
    api.classApi.list.mockResolvedValue(classes);
    api.termApi.current.mockResolvedValue({ term: currentTerm });
    api.studentApi.list.mockResolvedValue(students);
    api.studentApi.get.mockResolvedValue(students[0]);
    api.marksheetApi.forStudent.mockResolvedValue(marksheets);
    api.attendanceApi.forStudent.mockResolvedValue(attendance);
    api.paymentApi.list.mockResolvedValue([]);
});

afterEach(() => {
    cleanup();
});

describe('Student Portal', () => {
    test('shows loading state before APIs resolve', () => {
        renderShell();
        expect(screen.queryByText('Student summary')).not.toBeInTheDocument();
    });

    test('renders student summary cards with current-term averages', async () => {
        renderShell();

        await screen.findByText('Student summary');
        await screen.findByText('Alem Tadesse');
        expect(screen.getByText('Admission no: ADM-001')).toBeInTheDocument();
        expect(screen.getByText('Roll number: 1')).toBeInTheDocument();
        expect(screen.getByText('Class: Year 4A')).toBeInTheDocument();

        // (85 + 68) / 2 = 76.5
        await screen.findByText('76.5%');
        expect(screen.getByText('Current term')).toBeInTheDocument();
        expect(screen.getByText(/Term: Term 1/)).toBeInTheDocument();

        // Attendance: 1 present, 1 late, 1 absent → 67%
        await screen.findByText('67%');
        expect(screen.getByText('1 present · 1 late · 1 absent')).toBeInTheDocument();
    });

    test('renders performance by subject with grades', async () => {
        renderShell();
        await screen.findByText('Performance by subject');

        const card = screen.getByText('Performance by subject').closest('div');
        const table = card.querySelector('table');

        await within(card).findByText('English');
        expect(within(table).getByText('85')).toBeInTheDocument();
        expect(within(table).getByText('85.0%')).toBeInTheDocument();
        expect(within(table).getByText('A')).toBeInTheDocument();

        expect(within(table).getByText('Maths')).toBeInTheDocument();
        expect(within(table).getByText('68')).toBeInTheDocument();
        expect(within(table).getByText('68.0%')).toBeInTheDocument();
        // 68 → B (60–69)
        expect(within(table).getByText('B')).toBeInTheDocument();
    });

    test('renders guardian contact card', async () => {
        renderShell();
        await screen.findByText('Guardian contact');
        expect(screen.getByText('Mrs Tadesse')).toBeInTheDocument();
        expect(screen.getByText('0911111111')).toBeInTheDocument();
        expect(screen.getByText('mom@example.com')).toBeInTheDocument();
        expect(screen.getByText('Seats near board')).toBeInTheDocument();
    });

    test('renders recent attendance entries with status chips', async () => {
        renderShell();
        await screen.findByText('Recent attendance');

        const card = screen.getByText('Recent attendance').closest('div');
        await within(card).findByText('Homeroom');
        expect(within(card).getByText('present')).toBeInTheDocument();
        expect(within(card).getByText('English')).toBeInTheDocument();
        expect(within(card).getByText('absent')).toBeInTheDocument();
        expect(within(card).getByText('Maths')).toBeInTheDocument();
        expect(within(card).getByText('late')).toBeInTheDocument();
    });

    test('shows Unpaid fee status for a student with no payment record', async () => {
        api.paymentApi.list.mockResolvedValue([]);
        renderShell();
        await screen.findByText('Fee status');
        expect(screen.getByText('Unpaid')).toBeInTheDocument();
    });

    test('switching classes updates the roster and hides the portal when empty', async () => {
        api.studentApi.list.mockImplementation((params) =>
            Promise.resolve(params?.classId === 'c1' ? students : []),
        );

        renderShell();
        await screen.findByText('Student summary');

        const classSelect = screen.getByLabelText('Class');
        fireEvent.mouseDown(classSelect);
        await screen.findByRole('option', { name: 'Year 4B' });
        fireEvent.click(screen.getByRole('option', { name: 'Year 4B' }));

        await screen.findByText('Select a class and student to open the portal.');
        expect(screen.queryByText('Student summary')).not.toBeInTheDocument();
    });
});
