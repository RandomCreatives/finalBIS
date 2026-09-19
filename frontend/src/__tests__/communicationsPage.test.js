import '@testing-library/jest-dom';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { ThemeProvider } from '../theme';
import Communications from '../pages/Communications';
import { communicationsApi, conductApi, permissionApi, storeApi } from '../api/endpoints';

jest.mock('../api/endpoints', () => ({
    communicationsApi: { badgeCounts: jest.fn() },
    permissionApi: {
        list: jest.fn(),
        review: jest.fn(),
    },
    storeApi: { list: jest.fn() },
    conductApi: {
        list: jest.fn(),
        updateStatus: jest.fn(),
    },
}));

const PENDING = [{
    id: 'r1', status: 'pending', reason: 'Hanna leaves at 10:30 for the dentist.',
    pickupTime: '2026-09-22T10:30:00Z', createdAt: '2026-09-19T08:00:00Z',
    student: { id: 's1', name: 'Hanna Y.' },
    class: { id: 'c1', name: 'Year 3 - Blue' },
    requester: { id: 't1', name: 'Ms. Yeabsira K.' },
}];

const renderPage = () =>
    render(
        <ThemeProvider>
            <BrowserRouter>
                <Communications />
            </BrowserRouter>
        </ThemeProvider>,
    );

beforeEach(() => {
    jest.clearAllMocks();
    communicationsApi.badgeCounts.mockResolvedValue({
        storeRequestsPending: 1,
        permissionRequestsPending: 1,
        conductReportsPending: 0,
    });
    permissionApi.list.mockResolvedValue(PENDING);
    storeApi.list.mockResolvedValue([]);
    conductApi.list.mockResolvedValue([{
        id: 'c1', status: 'new', type: 'serious', body: 'Hanna hit a classmate during break.',
        createdAt: '2026-09-19T09:00:00Z',
        student: { id: 's1', name: 'Hanna Y.' },
        class: { id: 'cl1', name: 'Year 3 - Blue' },
        reporter: { id: 't1', name: 'Ms. Yeabsira K.' },
    }]);
});

describe('Admin Communications queue', () => {
    test('header shows the live pending counters', async () => {
        renderPage();
        expect(await screen.findByText('1 requests pending')).toBeInTheDocument();
        expect(screen.getByText('1 store pending')).toBeInTheDocument();
    });

    test('lists pending permission requests with class + requester context', async () => {
        renderPage();
        const student = await screen.findByText('Hanna Y.');
        expect(student).toBeInTheDocument();
        expect(screen.getByText(/Year 3 - Blue/)).toBeInTheDocument();
        expect(screen.getByText(/Ms. Yeabsira K\./)).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Approve' })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Decline' })).toBeInTheDocument();
    });

    test('approving sends the decision with the note and refreshes', async () => {
        permissionApi.review.mockResolvedValue({ id: 'r1', status: 'approved' });
        permissionApi.list
            .mockResolvedValueOnce(PENDING)
            .mockResolvedValueOnce([]);
        renderPage();
        fireEvent.click(await screen.findByRole('button', { name: 'Approve' }));

        const dialog = await screen.findByText('Approve request?');
        expect(dialog).toBeInTheDocument();
        fireEvent.change(screen.getByLabelText(/Note to the teacher/i), {
            target: { value: 'OK — inform the guard.' },
        });
        fireEvent.click(screen.getAllByRole('button', { name: 'Approve' }).pop());

        await waitFor(() =>
            expect(permissionApi.review).toHaveBeenCalledWith('r1', 'approved', 'OK — inform the guard.'));
        expect(await screen.findByText(/all caught up/i)).toBeInTheDocument();
    });

    test('store tab links to the full Store page', async () => {
        renderPage();
        fireEvent.click(screen.getByRole('tab', { name: 'Store requests' }));
        expect(await screen.findByRole('link', { name: /Open Store page/i }))
            .toHaveAttribute('href', '/app/store');
    });

    test('conduct tab lists reports and acknowledging moves the flow forward', async () => {
        conductApi.updateStatus.mockResolvedValue({ id: 'c1', status: 'acknowledged' });
        conductApi.list
            .mockResolvedValueOnce([{
                id: 'c1', status: 'new', type: 'serious', body: 'Hanna hit a classmate during break.',
                createdAt: '2026-09-19T09:00:00Z',
                student: { id: 's1', name: 'Hanna Y.' },
                class: { id: 'cl1', name: 'Year 3 - Blue' },
                reporter: { id: 't1', name: 'Ms. Yeabsira K.' },
            }])
            .mockResolvedValueOnce([{
                id: 'c1', status: 'acknowledged', type: 'serious', body: 'Hanna hit a classmate during break.',
                createdAt: '2026-09-19T09:00:00Z', actionNote: 'Will call the parents today.',
                student: { id: 's1', name: 'Hanna Y.' },
                class: { id: 'cl1', name: 'Year 3 - Blue' },
                reporter: { id: 't1', name: 'Ms. Yeabsira K.' },
            }]);

        renderPage();
        fireEvent.click(screen.getByRole('tab', { name: 'Conduct reports' }));

        const row = await screen.findByText('Hanna hit a classmate during break.');
        expect(row).toBeInTheDocument();
        expect(screen.getByText('Serious incident')).toBeInTheDocument();

        fireEvent.click(screen.getByRole('button', { name: 'Acknowledge' }));
        expect(await screen.findByText('Acknowledge report?')).toBeInTheDocument();
        fireEvent.change(screen.getByLabelText(/Note to the teacher/i), {
            target: { value: 'Will call the parents today.' },
        });
        fireEvent.click(screen.getAllByRole('button', { name: 'Acknowledge' }).pop());

        await waitFor(() =>
            expect(conductApi.updateStatus)
                .toHaveBeenCalledWith('c1', 'acknowledged', 'Will call the parents today.'));
        // the chip moves to Acknowledged (also a filter label, hence the AllBy query)
        expect((await screen.findAllByText('Acknowledged')).length).toBeGreaterThan(0);
        expect(screen.getByText(/Your note: Will call the parents today\./)).toBeInTheDocument();
    });
});
