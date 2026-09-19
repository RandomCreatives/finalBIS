import '@testing-library/jest-dom';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { ThemeProvider } from '../theme';
import StoreSection from '../components/communications/StoreSection';
import { storeApi } from '../api/endpoints';

jest.mock('../api/endpoints', () => ({
    storeApi: {
        list: jest.fn(),
        create: jest.fn(),
    },
}));

const KLASS = { name: 'Year 3 - Blue' };

const renderSection = () =>
    render(
        <ThemeProvider>
            <StoreSection klass={KLASS} classId="class-1" />
        </ThemeProvider>,
    );

beforeEach(() => {
    jest.clearAllMocks();
    storeApi.list.mockResolvedValue([]);
});

describe('StoreSection (Admin Communications — Store)', () => {
    test('empty state explains the flow and offers a new request', async () => {
        renderSection();
        expect(await screen.findByText('Nothing requested yet')).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /New material request/i })).toBeInTheDocument();
    });

    test('creates a cleaned request for the class and reloads the list', async () => {
        storeApi.create.mockResolvedValue({ id: 'r1' });
        storeApi.list
            .mockResolvedValueOnce([])
            .mockResolvedValueOnce([{
                id: 'r1', requestNumber: 'REQ-2026-0001', status: 'pending',
                purpose: 'Art week supplies', createdAt: '2026-09-19T08:00:00Z',
                items: [{ item: 'A4 paper', quantity: 50, note: '' }],
            }]);

        renderSection();
        fireEvent.click(await screen.findByRole('button', { name: /New material request/i }));

        fireEvent.change(screen.getByLabelText(/What is it for/i), {
            target: { value: 'Art week supplies' },
        });
        fireEvent.change(screen.getByLabelText(/^Item \*/i), { target: { value: 'A4 paper' } });
        fireEvent.change(screen.getByLabelText(/^Qty \*/i), { target: { value: '50' } });

        fireEvent.click(screen.getByRole('button', { name: /Send request/i }));

        await waitFor(() => expect(storeApi.create).toHaveBeenCalledTimes(1));
        expect(storeApi.create).toHaveBeenCalledWith({
            classId: 'class-1',
            purpose: 'Art week supplies',
            items: [{ item: 'A4 paper', quantity: 50, note: '' }],
        });
        expect(await screen.findByText('REQ-2026-0001')).toBeInTheDocument();
        expect(screen.getByText('Pending')).toBeInTheDocument();
    });

    test('add-item row and validation: cannot submit without purpose or items', async () => {
        renderSection();
        fireEvent.click(await screen.findByRole('button', { name: /New material request/i }));

        const send = screen.getByRole('button', { name: /Send request/i });
        expect(send).toBeDisabled();

        fireEvent.change(screen.getByLabelText(/What is it for/i), { target: { value: 'Stationery' } });
        expect(send).toBeDisabled(); // still no filled item

        fireEvent.change(screen.getByLabelText(/^Item \*/i), { target: { value: 'Glue sticks' } });
        expect(send).toBeEnabled();

        // a second item row appears on demand
        fireEvent.click(screen.getByRole('button', { name: /Add item/i }));
        expect(screen.getAllByLabelText(/^Item \*/i)).toHaveLength(2);
        fireEvent.click(screen.getByLabelText('Remove item 2'));
        expect(screen.getAllByLabelText(/^Item \*/i)).toHaveLength(1);
    });
});
