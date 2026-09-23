import '@testing-library/jest-dom';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { StudentsSection } from '../pages/ClassHome';
import Students from '../pages/Students';
import { ThemeProvider } from '../theme';
import { useAuth } from '../auth/AuthContext';
import { termApi, paymentApi, studentApi, classApi, studentRequestApi } from '../api/endpoints';

jest.mock('../auth/AuthContext', () => ({
    useAuth: jest.fn(),
    AuthProvider: ({ children }) => children,
    useColorScheme: () => ({ toggleColorScheme: jest.fn() }),
}));

jest.mock('../api/endpoints', () => {
    const actual = jest.requireActual('../api/endpoints');
    return {
        ...actual,
        termApi: { current: jest.fn() },
        paymentApi: { list: jest.fn() },
        studentApi: { list: jest.fn(), update: jest.fn(), transfer: jest.fn() },
        classApi: { list: jest.fn() },
        studentRequestApi: { list: jest.fn(), create: jest.fn(), approve: jest.fn(), reject: jest.fn() },
    };
});

const TERM = { term: { id: 't1', name: 'Term 1' }, currentWeek: 3 };
const S1 = { id: 's1', name: 'Abel Tesfaye', admissionNo: 'BIS2026-001', rollNum: 1, guardianPhone: '0911', classId: 'c1' };
const REQ = {
    id: 'r1', classId: 'c1', className: 'Year 3 - Red', name: 'Pending Kid',
    requestedByName: 'Ms Alpha', createdAt: '2026-09-23T08:00:00.000Z',
    guardianPhone: '911223344', status: 'pending',
};

const wrap = (ui) => render(
    <ThemeProvider>
        <MemoryRouter>{ui}</MemoryRouter>
    </ThemeProvider>,
);

const renderSection = () => wrap(
    <StudentsSection
        klass={{ name: 'Year 3 - Red', mainTeacher: 'Ms Alpha' }}
        roster={[S1]}
        loading={false}
        error={null}
        reload={jest.fn()}
        classNames={['Year 3 - Red']}
        classIdByName={{ 'Year 3 - Red': 'c1' }}
        classId="c1"
    />,
);

beforeEach(() => {
    jest.clearAllMocks();
    termApi.current.mockResolvedValue(TERM);
    paymentApi.list.mockResolvedValue([]);
    studentRequestApi.list.mockResolvedValue([]);
});

describe('ClassHome — Add student intake', () => {
    test('the Add student button opens the request dialog and submits it', async () => {
        useAuth.mockReturnValue({ user: { id: 'm1', role: 'main_teacher', name: 'Ms Alpha' } });
        studentRequestApi.create.mockResolvedValue({ id: 'r2', name: 'Hanna Girma', status: 'pending' });

        renderSection();
        fireEvent.click(await screen.findByTestId('add-student-btn'));

        expect(screen.getByTestId('add-student-dialog')).toBeInTheDocument();
        fireEvent.change(screen.getByTestId('req-name'), { target: { value: 'Hanna Girma' } });
        fireEvent.click(screen.getByTestId('req-submit'));

        await waitFor(() => expect(studentRequestApi.create).toHaveBeenCalledWith(
            expect.objectContaining({ name: 'Hanna Girma' }),
        ));
        expect(await screen.findByText(/Request sent — the office will review Hanna Girma/)).toBeInTheDocument();
    });

    test('pending requests show as a waiting strip on the register', async () => {
        useAuth.mockReturnValue({ user: { id: 'm1', role: 'main_teacher', name: 'Ms Alpha' } });
        studentRequestApi.list.mockResolvedValue([REQ]);

        renderSection();

        const strip = await screen.findByTestId('pending-strip');
        expect(strip).toHaveTextContent('1 waiting for office approval');
        expect(strip).toHaveTextContent('Pending Kid');
    });
});

describe('Admin Students page — the approval queue', () => {
    const setupAdmin = () => {
        useAuth.mockReturnValue({ user: { id: 'admin-1', role: 'admin', name: 'Admin' } });
        studentApi.list.mockResolvedValue([S1]);
        classApi.list.mockResolvedValue([{ id: 'c1', name: 'Year 3 - Red' }]);
        studentRequestApi.list.mockResolvedValue([REQ]);
    };

    test('lists pending requests and approving assigns roll + admission', async () => {
        setupAdmin();
        studentRequestApi.approve.mockResolvedValue({
            request: { className: 'Year 3 - Red' },
            student: { rollNum: 25, admissionNo: 'BIS2026-316' },
        });
        studentRequestApi.list.mockResolvedValueOnce([REQ]).mockResolvedValue([]);

        wrap(<Students />);

        const queue = await screen.findByTestId('student-requests');
        expect(queue).toHaveTextContent('Pending Kid');
        expect(queue).toHaveTextContent('Ms Alpha');
        fireEvent.click(screen.getByTestId('approve-r1'));

        await waitFor(() => expect(studentRequestApi.approve).toHaveBeenCalledWith('r1'));
        expect(await screen.findByText(/roll 25 · BIS2026-316/)).toBeInTheDocument();
    });

    test('declining asks for a note and rejects the request', async () => {
        setupAdmin();
        studentRequestApi.reject.mockResolvedValue({ id: 'r1', status: 'rejected' });
        studentRequestApi.list.mockResolvedValueOnce([REQ]).mockResolvedValue([]);

        wrap(<Students />);

        fireEvent.click(await screen.findByTestId('decline-r1'));
        fireEvent.change(screen.getByTestId('decline-note'), { target: { value: 'Bring documents first' } });
        fireEvent.click(screen.getByTestId('decline-confirm'));

        await waitFor(() => expect(studentRequestApi.reject).toHaveBeenCalledWith('r1', 'Bring documents first'));
        expect(await screen.findByText(/Request for Pending Kid declined/)).toBeInTheDocument();
    });
});
