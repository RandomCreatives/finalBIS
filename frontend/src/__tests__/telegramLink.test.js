import '@testing-library/jest-dom';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { ThemeProvider } from '../theme';
import { AuthProvider } from '../auth/AuthContext';
import { TelegramCard } from '../components/settings/profileCards';
import { authApi } from '../api/endpoints';
import { fetchTelegramConfig } from '../auth/telegram';

jest.mock('../api/endpoints', () => ({
    authApi: {
        me: jest.fn(),
        requestTelegramLink: jest.fn(),
        telegramLinkStatus: jest.fn(),
        unlinkTelegram: jest.fn(),
    },
}));

jest.mock('../auth/telegram', () => ({
    fetchTelegramConfig: jest.fn(),
    botChatUrl: jest.fn(() => null),
}));

const wrap = (ui) => render(
    <ThemeProvider>
        <AuthProvider>{ui}</AuthProvider>
    </ThemeProvider>
);

const TOKEN = 'A'.repeat(43);
const DEEP_LINK = `https://t.me/bisnocbot?start=link_${TOKEN}`;

beforeEach(() => {
    jest.clearAllMocks();
    localStorage.clear();
    fetchTelegramConfig.mockResolvedValue({ enabled: true, botUsername: 'bisnocbot', loginEnabled: false });
    authApi.me.mockResolvedValue({ id: 'u1', telegramId: null, telegramUsername: null });
});

describe('TelegramCard — one-time linking', () => {
    test('a signed-in member mints a one-time link and can open it in Telegram', async () => {
        authApi.requestTelegramLink.mockResolvedValue({
            token: TOKEN,
            deepLink: DEEP_LINK,
            botUsername: 'bisnocbot',
            expiresAt: new Date(Date.now() + 600000).toISOString(),
            expiresInSeconds: 600,
        });

        wrap(<TelegramCard />);

        const button = await screen.findByRole('button', { name: /Create link/i });
        fireEvent.click(button);

        expect(await screen.findByDisplayValue(DEEP_LINK)).toBeInTheDocument();
        const open = screen.getByRole('link', { name: /Open in Telegram/i });
        expect(open).toHaveAttribute('href', DEEP_LINK);
        expect(screen.getByText(/Waiting for you to open it/i)).toBeInTheDocument();
        expect(authApi.requestTelegramLink).toHaveBeenCalledTimes(1);
    });

    test('an already-linked member sees the linked chip and no link button', async () => {
        authApi.me.mockResolvedValue({
            id: 'u1', telegramId: '700100200', telegramUsername: 'test_staff',
        });

        wrap(<TelegramCard />);

        expect(await screen.findByText(/Linked · @test_staff/)).toBeInTheDocument();
        expect(screen.queryByRole('button', { name: /Create link/i })).not.toBeInTheDocument();
    });

    test('polls the link and flips to Linked once the bot consumes it', async () => {
        jest.useFakeTimers();
        try {
            authApi.requestTelegramLink.mockResolvedValue({
                token: TOKEN,
                deepLink: DEEP_LINK,
                botUsername: 'bisnocbot',
                expiresAt: new Date(Date.now() + 600000).toISOString(),
                expiresInSeconds: 600,
            });
            authApi.telegramLinkStatus.mockResolvedValue({ status: 'used' });
            // Unlinked on mount; linked by the time the poll refreshes the profile.
            authApi.me
                .mockResolvedValueOnce({ id: 'u1', telegramId: null, telegramUsername: null })
                .mockResolvedValue({
                    id: 'u1', telegramId: '700100200', telegramUsername: 'test_staff',
                });

            wrap(<TelegramCard />);
            await act(async () => {});

            fireEvent.click(screen.getByRole('button', { name: /Create link/i }));
            await act(async () => { jest.advanceTimersByTime(0); });

            expect(screen.getByDisplayValue(DEEP_LINK)).toBeInTheDocument();

            await act(async () => { jest.advanceTimersByTime(4100); });

            expect(authApi.telegramLinkStatus).toHaveBeenCalledWith(TOKEN);
            expect(screen.getByText(/Linked · @test_staff/)).toBeInTheDocument();
        } finally {
            jest.useRealTimers();
        }
    });

    test('shows an error when the server refuses to mint a link', async () => {
        authApi.requestTelegramLink.mockRejectedValue(
            new Error('This account is already linked to a Telegram account.')
        );

        wrap(<TelegramCard />);
        fireEvent.click(await screen.findByRole('button', { name: /Create link/i }));

        expect(await screen.findByText(/already linked to a Telegram account/i)).toBeInTheDocument();
    });

    test('unlink clears the linked state', async () => {
        authApi.me.mockResolvedValue({
            id: 'u1', telegramId: '700100200', telegramUsername: 'test_staff',
        });
        authApi.unlinkTelegram.mockResolvedValue({
            user: { id: 'u1', telegramId: null, telegramUsername: null },
        });

        wrap(<TelegramCard />);
        fireEvent.click(await screen.findByRole('button', { name: /Unlink/i }));

        await waitFor(() => expect(authApi.unlinkTelegram).toHaveBeenCalled());
        expect(await screen.findByRole('button', { name: /Create link/i })).toBeInTheDocument();
    });
});
