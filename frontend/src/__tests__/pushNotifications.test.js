import '@testing-library/jest-dom';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import PushNotifications from '../pages/PushNotifications';
import { pushApi } from '../api/endpoints';
import { ThemeProvider } from '../theme';

jest.mock('../auth/AuthContext', () => ({
    useAuth: () => ({
        user: { id: 'admin-1', name: 'Office Admin', role: 'admin' },
    }),
}));

jest.mock('../api/endpoints', () => ({
    pushApi: {
        stats: jest.fn(),
        send: jest.fn(),
    },
}));

describe('PushNotifications (Admin Broadcast page)', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        pushApi.stats.mockResolvedValue({
            subscribedUsers: 3,
            webPushEnabled: true,
            telegramLinkedUsers: 8,
            activeStaffUsers: 22,
        });
        pushApi.send.mockResolvedValue({
            sent: 33,
            failed: 0,
            telegramSent: 8,
            webPushSent: 3,
            inAppSent: 22,
        });
    });

    test('renders without crashing via useApi object shape and sends broadcast', async () => {
        render(
            <ThemeProvider>
                <PushNotifications />
            </ThemeProvider>,
        );

        expect(screen.getByText('Send a broadcast')).toBeInTheDocument();

        await waitFor(() => {
            expect(screen.getByText('Telegram (@bisnocbot): 8 linked')).toBeInTheDocument();
        });
        expect(screen.getByText('Browser push devices: 3')).toBeInTheDocument();
        expect(screen.getByText('In-app bell recipients: 22')).toBeInTheDocument();

        fireEvent.change(screen.getByLabelText(/Title/i), {
            target: { value: 'Staff briefing at 15:10' },
        });
        fireEvent.change(screen.getByLabelText(/Body/i), {
            target: { value: 'Please gather in the main hall after Period 6.' },
        });

        fireEvent.click(screen.getByRole('button', { name: /Send broadcast/i }));

        await waitFor(() => {
            expect(pushApi.send).toHaveBeenCalledWith({
                title: 'Staff briefing at 15:10',
                body: 'Please gather in the main hall after Period 6.',
                url: '/app',
            });
        });

        expect(
            await screen.findByText(/8 Telegram \(@bisnocbot\), 3 browser push, 22 in-app bell/i),
        ).toBeInTheDocument();
    });
});
