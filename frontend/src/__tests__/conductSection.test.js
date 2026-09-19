import '@testing-library/jest-dom';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { ThemeProvider } from '../theme';
import ConductSection from '../components/communications/ConductSection';
import { conductApi } from '../api/endpoints';

jest.mock('../api/endpoints', () => ({
    conductApi: {
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
            <ConductSection klass={{ name: 'Year 3 - Blue' }} classId="class-1" roster={ROSTER} />
        </ThemeProvider>,
    );

beforeEach(() => {
    jest.clearAllMocks();
    conductApi.list.mockResolvedValue([]);
});

describe('ConductSection (Admin Communications — Conduct report)', () => {
    test('empty state explains the channel', async () => {
        renderSection();
        expect(await screen.findByText('No conduct reports yet')).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /New conduct report/i })).toBeInTheDocument();
    });

    test('teacher picks a tone, a student, writes and sends', async () => {
        conductApi.create.mockResolvedValue({ id: 'c1' });
        conductApi.list
            .mockResolvedValueOnce([])
            .mockResolvedValueOnce([{
                id: 'c1', status: 'new', type: 'serious',
                body: 'Hanna hit a classmate during break.',
                createdAt: '2026-09-19T08:00:00Z',
                student: { id: 's1', name: 'Hanna Y.' },
            }]);

        renderSection();
        fireEvent.click(await screen.findByRole('button', { name: /New conduct report/i }));

        // tone defaults to Praise — switch to Serious incident
        fireEvent.click(screen.getByRole('button', { name: 'Serious incident' }));

        fireEvent.mouseDown(screen.getByRole('combobox'));
        fireEvent.click(await screen.findByRole('option', { name: 'Hanna Y.' }));

        fireEvent.change(screen.getByLabelText(/What happened/i), {
            target: { value: 'Hanna hit a classmate during break.' },
        });
        fireEvent.click(screen.getByRole('button', { name: /Send to admin/i }));

        await waitFor(() => expect(conductApi.create).toHaveBeenCalledTimes(1));
        expect(conductApi.create).toHaveBeenCalledWith({
            classId: 'class-1',
            studentId: 's1',
            type: 'serious',
            body: 'Hanna hit a classmate during break.',
        });

        const card = (await screen.findByText('Hanna Y.')).closest('[class*="MuiPaper"]');
        expect(within(card).getByText('Serious incident')).toBeInTheDocument();
        expect(within(card).getByText('New')).toBeInTheDocument();
        expect(within(card).getByRole('button', { name: 'Withdraw' })).toBeInTheDocument();
    });

    test('withdrawing a new report deletes it', async () => {
        conductApi.list
            .mockResolvedValueOnce([{
                id: 'c1', status: 'new', type: 'praise', body: 'Great group work.',
                createdAt: '2026-09-19T08:00:00Z',
                student: { id: 's1', name: 'Hanna Y.' },
            }])
            .mockResolvedValueOnce([]);
        conductApi.remove.mockResolvedValue({});

        renderSection();
        fireEvent.click(await screen.findByRole('button', { name: 'Withdraw' }));
        await waitFor(() => expect(conductApi.remove).toHaveBeenCalledWith('c1'));
        expect(await screen.findByText('No conduct reports yet')).toBeInTheDocument();
    });

    test('actioned reports show the admin note, no withdraw', async () => {
        conductApi.list.mockResolvedValue([{
            id: 'c2', status: 'actioned', type: 'concern', body: 'Repeated disruption.',
            createdAt: '2026-09-19T08:00:00Z', actionNote: 'Parents met — plan agreed.',
            student: { id: 's1', name: 'Hanna Y.' },
        }]);
        renderSection();
        expect(await screen.findByText('Actioned')).toBeInTheDocument();
        expect(screen.getByText(/Parents met/)).toBeInTheDocument();
        expect(screen.queryByRole('button', { name: 'Withdraw' })).not.toBeInTheDocument();
    });
});
