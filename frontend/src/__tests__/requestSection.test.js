import '@testing-library/jest-dom';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { ThemeProvider } from '../theme';
import RequestSection from '../components/communications/RequestSection';
import { permissionApi } from '../api/endpoints';

jest.mock('../api/endpoints', () => ({
    permissionApi: {
        list: jest.fn(),
        create: jest.fn(),
        remove: jest.fn(),
    },
}));

const ROSTER = [
    { id: 's1', name: 'Hanna Y.' },
    { id: 's2', name: 'Abel K.' },
];

const renderSection = () =>
    render(
        <ThemeProvider>
            <RequestSection klass={{ name: 'Year 3 - Blue' }} classId="class-1" roster={ROSTER} />
        </ThemeProvider>,
    );

beforeEach(() => {
    jest.clearAllMocks();
    permissionApi.list.mockResolvedValue([]);
});

describe('RequestSection (Admin Communications — Request)', () => {
    test('empty state explains the channel', async () => {
        renderSection();
        expect(await screen.findByText('No requests yet')).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /New permission request/i })).toBeInTheDocument();
    });

    test('teacher picks a student, writes a reason and sends', async () => {
        permissionApi.create.mockResolvedValue({ id: 'r1' });
        permissionApi.list
            .mockResolvedValueOnce([])
            .mockResolvedValueOnce([{
                id: 'r1', status: 'pending', reason: 'Hanna leaves at 10:30 for the dentist.',
                pickupTime: null, createdAt: '2026-09-19T08:00:00Z',
                student: { id: 's1', name: 'Hanna Y.' },
            }]);

        renderSection();
        fireEvent.click(await screen.findByRole('button', { name: /New permission request/i }));

        fireEvent.mouseDown(screen.getByRole('combobox'));
        fireEvent.click(await screen.findByRole('option', { name: 'Hanna Y.' }));

        fireEvent.change(screen.getByLabelText(/What needs permission/i), {
            target: { value: 'Hanna leaves at 10:30 for the dentist.' },
        });
        fireEvent.click(screen.getByRole('button', { name: /Send to admin/i }));

        await waitFor(() => expect(permissionApi.create).toHaveBeenCalledTimes(1));
        expect(permissionApi.create).toHaveBeenCalledWith({
            classId: 'class-1',
            studentId: 's1',
            reason: 'Hanna leaves at 10:30 for the dentist.',
            pickupTime: null,
        });

        // the pending request now shows with a withdraw affordance
        const card = (await screen.findByText('Hanna Y.')).closest('[class*="MuiPaper"]');
        expect(within(card).getByText('Pending')).toBeInTheDocument();
        expect(within(card).getByRole('button', { name: 'Withdraw' })).toBeInTheDocument();
    });

    test('withdrawing a pending request deletes it', async () => {
        permissionApi.list
            .mockResolvedValueOnce([{
                id: 'r1', status: 'pending', reason: 'Early pickup',
                pickupTime: null, createdAt: '2026-09-19T08:00:00Z',
                student: { id: 's1', name: 'Hanna Y.' },
            }])
            .mockResolvedValueOnce([]);
        permissionApi.remove.mockResolvedValue({});

        renderSection();
        fireEvent.click(await screen.findByRole('button', { name: 'Withdraw' }));
        await waitFor(() => expect(permissionApi.remove).toHaveBeenCalledWith('r1'));
        expect(await screen.findByText('No requests yet')).toBeInTheDocument();
    });

    test('declined requests show the admin note', async () => {
        permissionApi.list.mockResolvedValue([{
            id: 'r2', status: 'declined', reason: 'Whole-day absence',
            pickupTime: null, createdAt: '2026-09-19T08:00:00Z', reviewNote: 'Assessment week — keep her in class.',
            student: { id: 's1', name: 'Hanna Y.' },
        }]);
        renderSection();
        expect(await screen.findByText('Declined')).toBeInTheDocument();
        expect(screen.getByText(/Assessment week/)).toBeInTheDocument();
        expect(screen.queryByRole('button', { name: 'Withdraw' })).not.toBeInTheDocument();
    });
});
