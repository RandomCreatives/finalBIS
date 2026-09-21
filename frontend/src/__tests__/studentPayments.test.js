import '@testing-library/jest-dom';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import StudentIdCard from '../components/StudentIdCard';
import { StudentsSection } from '../pages/ClassHome';
import Students from '../pages/Students';
import { PaymentChip, paymentLabel } from '../utils/payments';
import { ThemeProvider } from '../theme';
import { termApi, paymentApi, studentApi, classApi } from '../api/endpoints';

jest.mock('../auth/AuthContext', () => ({
    useAuth: () => ({ user: { id: 'admin-1', role: 'admin', name: 'Admin' } }),
    AuthProvider: ({ children }) => children,
    useColorScheme: () => ({ toggleColorScheme: jest.fn() }),
}));

jest.mock('../api/endpoints', () => {
    const actual = jest.requireActual('../api/endpoints');
    return {
        ...actual,
        termApi: { current: jest.fn() },
        paymentApi: { list: jest.fn(), set: jest.fn() },
        studentApi: { list: jest.fn(), update: jest.fn(), transfer: jest.fn() },
        classApi: { list: jest.fn() },
    };
});

const TERM = { term: { id: 't1', name: 'Term 1' }, currentWeek: 3 };

const S1 = { id: 's1', name: 'Abel Tesfaye', admissionNo: 'A001', rollNum: 1, guardianPhone: '0911', classId: 'c1' };
const S2 = { id: 's2', name: 'Sara Kebede', admissionNo: 'A002', rollNum: 2, guardianPhone: '0922', classId: 'c1' };
const S3 = { id: 's3', name: 'Miki Alemu', admissionNo: 'A003', rollNum: 3, guardianPhone: '', classId: 'c1' };

const wrap = (ui) => render(
    <ThemeProvider>
        <MemoryRouter>{ui}</MemoryRouter>
    </ThemeProvider>,
);

beforeEach(() => {
    jest.clearAllMocks();
    termApi.current.mockResolvedValue(TERM);
    paymentApi.list.mockResolvedValue([
        { studentId: 's1', termId: 't1', status: 'paid_term', markedBy: 'Ms Alpha', markedAt: '2026-09-22T08:00:00Z' },
        { studentId: 's2', termId: 't1', status: 'paid_annum', markedBy: 'Ms Alpha', markedAt: '2026-09-22T08:10:00Z' },
    ]);
});

describe('paymentLabel / PaymentChip', () => {
    test('speaks the school statuses', () => {
        expect(paymentLabel('paid_term', 'Term 1')).toBe('Paid · Term 1');
        expect(paymentLabel('paid_annum', 'Term 1')).toBe('Paid · Annum');
        expect(paymentLabel(undefined, 'Term 1')).toBe('Unpaid');
    });

    test('the chip renders the label and fires clicks', () => {
        const onClick = jest.fn();
        render(<PaymentChip status="paid_annum" termName="Term 1" onClick={onClick} />);
        const chip = screen.getByText('Paid · Annum');
        fireEvent.click(chip);
        expect(onClick).toHaveBeenCalled();
    });
});

describe('StudentIdCard payment receipt', () => {
    const student = { ...S1, className: 'Year 3 - Blue', guardianName: 'Guardian T' };

    test('receipt section sits under the record with status + recorded-by', () => {
        render(
            <ThemeProvider>
                <MemoryRouter>
                    <StudentIdCard
                        student={student} canManage onClose={() => {}} onSave={() => {}} onTransfer={() => {}}
                        payment={{ status: 'paid_term', markedBy: 'Ms Alpha', markedAt: '2026-09-22T08:00:00Z' }}
                        termName="Term 1" onMarkPayment={() => {}}
                    />
                </MemoryRouter>
            </ThemeProvider>,
        );
        const receipt = screen.getByTestId('payment-receipt');
        expect(within(receipt).getByText('PAYMENT · TERM 1')).toBeInTheDocument();
        // the status chip AND the active status button both read "Paid · Term 1"
        expect(within(receipt).getAllByText('Paid · Term 1').length).toBeGreaterThanOrEqual(1);
        expect(receipt.textContent).toMatch(/Recorded by Ms Alpha · 22 Sept 2026/);
    });

    test('teacher taps a status; unmanaged visitors see no controls', () => {
        const onMark = jest.fn();
        const { rerender } = render(
            <ThemeProvider>
                <MemoryRouter>
                    <StudentIdCard
                        student={student} canManage onClose={() => {}} onSave={() => {}} onTransfer={() => {}}
                        payment={null} termName="Term 1" onMarkPayment={onMark}
                    />
                </MemoryRouter>
            </ThemeProvider>,
        );
        expect(screen.getByText(/Not recorded yet/)).toBeInTheDocument();
        fireEvent.click(screen.getByRole('button', { name: 'Paid · Annum' }));
        expect(onMark).toHaveBeenCalledWith('paid_annum');

        rerender(
            <ThemeProvider>
                <MemoryRouter>
                    <StudentIdCard
                        student={student} canManage={false} onClose={() => {}} onSave={() => {}} onTransfer={() => {}}
                        payment={null} termName="Term 1" onMarkPayment={onMark}
                    />
                </MemoryRouter>
            </ThemeProvider>,
        );
        expect(screen.queryByRole('button', { name: 'Paid · Annum' })).not.toBeInTheDocument();
        // receipt itself still shows for viewers
        expect(screen.getByTestId('payment-receipt')).toBeInTheDocument();
    });
});

describe('Class roster payment column (StudentsSection)', () => {
    const props = {
        klass: { name: 'Year 3 - Blue', mainTeacher: 'Ms Alpha' },
        roster: [S1, S2, S3],
        loading: false, error: null, reload: jest.fn(),
        classNames: ['Year 3 - Blue'], classIdByName: { 'Year 3 - Blue': 'c1' }, classId: 'c1',
    };

    test('status chips per student and a paid summary', async () => {
        wrap(<StudentsSection {...props} />);

        // payments resolve asynchronously after the term does — await them
        await within(await screen.findByTestId(`payment-chip-${S1.id}`)).findByText('Paid · Term 1');
        await within(screen.getByTestId(`payment-chip-${S2.id}`)).findByText('Paid · Annum');
        await within(screen.getByTestId(`payment-chip-${S3.id}`)).findByText('Unpaid');
        expect(await screen.findByText(/2 paid \(Term 1\)/)).toBeInTheDocument();
    });

    test('marking from the student card calls the API and updates the row', async () => {
        paymentApi.set.mockResolvedValue({
            studentId: 's3', termId: 't1', status: 'paid_term', markedBy: 'Ms Alpha', markedAt: '2026-09-22T09:00:00Z',
        });
        wrap(<StudentsSection {...props} />);

        await within(await screen.findByTestId(`payment-chip-${S3.id}`)).findByText('Unpaid');
        fireEvent.click(screen.getAllByText('ID Card')[2]); // Miki's row

        const receipt = await screen.findByTestId('payment-receipt');
        fireEvent.click(within(receipt).getByRole('button', { name: 'Paid · Term 1' }));

        await waitFor(() => expect(paymentApi.set).toHaveBeenCalledWith('s3', 't1', 'paid_term'));
        // dialog still open: the receipt shows the fresh status + who marked it
        await waitFor(() =>
            expect(screen.getByTestId('payment-receipt').textContent).toMatch(/Recorded by Ms Alpha/));

        // two "Close" controls: the card-stripe icon and the footer text button
        fireEvent.click(screen.getAllByRole('button', { name: 'Close' }).pop());
        await waitFor(() => expect(screen.queryByTestId('payment-receipt')).not.toBeInTheDocument());
        await within(screen.getByTestId(`payment-chip-${S3.id}`)).findByText('Paid · Term 1');
        expect(await screen.findByText(/3 paid \(Term 1\)/)).toBeInTheDocument();
    });
});

describe('Admin students list payment confirmation', () => {
    test('chips, summary, and an admin correction dialog', async () => {
        studentApi.list.mockResolvedValue([
            { ...S1, class: { name: 'Year 3 - Blue' } },
            { ...S2, class: { name: 'Year 3 - Blue' } },
            { ...S3, class: { name: 'Year 4 - Red' } },
        ]);
        classApi.list.mockResolvedValue([{ id: 'c1', name: 'Year 3 - Blue' }]);
        paymentApi.set.mockResolvedValue({
            studentId: 's3', termId: 't1', status: 'paid_annum', markedBy: 'Admin', markedAt: '2026-09-22T09:30:00Z',
        });
        wrap(<Students />);

        await within(await screen.findByTestId(`admin-payment-chip-${S1.id}`)).findByText('Paid · Term 1');
        await within(screen.getByTestId(`admin-payment-chip-${S2.id}`)).findByText('Paid · Annum');
        await within(screen.getByTestId(`admin-payment-chip-${S3.id}`)).findByText('Unpaid');
        expect(await screen.findByText(/2 of 3 shown are paid for Term 1/)).toBeInTheDocument();

        fireEvent.click(screen.getByTestId(`admin-payment-chip-${S3.id}`));
        const dialog = await screen.findByRole('dialog');
        expect(within(dialog).getByText('Payment — Miki Alemu')).toBeInTheDocument();
        expect(within(dialog).getByText(/No payment recorded/)).toBeInTheDocument();

        fireEvent.click(within(dialog).getByRole('button', { name: 'Paid · Annum' }));
        await waitFor(() => expect(paymentApi.set).toHaveBeenCalledWith('s3', 't1', 'paid_annum'));

        await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
        await within(screen.getByTestId(`admin-payment-chip-${S3.id}`)).findByText('Paid · Annum');
        expect(await screen.findByText(/3 of 3 shown are paid for Term 1/)).toBeInTheDocument();
    });
});
