import '@testing-library/jest-dom';
import { render, screen } from '@testing-library/react';
import TelegramLoginButton from '../components/TelegramLoginButton';
import { fetchTelegramConfig } from '../auth/telegram';

jest.mock('../auth/telegram', () => ({
    fetchTelegramConfig: jest.fn(),
    botChatUrl: jest.fn(() => null),
}));

describe('TelegramLoginButton', () => {
    test('login purpose: grayed-out placeholder while the bot is unfinished', async () => {
        fetchTelegramConfig.mockResolvedValue({
            enabled: true, botUsername: 'bisnocbot', loginEnabled: false,
        });
        render(<TelegramLoginButton onAuth={() => {}} />);

        await screen.findByText('Sign in with Telegram');
        expect(screen.getByText(/paused while we finish the bot/i)).toBeInTheDocument();
        // The widget container is NOT rendered, so no live sign-in button exists.
        expect(document.querySelector('iframe')).toBeNull();
    });

    test('link purpose: stays active for account linking even when login is paused', async () => {
        fetchTelegramConfig.mockResolvedValue({
            enabled: true, botUsername: 'bisnocbot', loginEnabled: false,
        });
        render(<TelegramLoginButton onAuth={() => {}} purpose="link" />);

        // Placeholder copy must not appear; the widget mount point does.
        await screen.findByText((_, el) => el?.tagName === 'DIV' && el.children.length >= 0);
        expect(screen.queryByText(/paused while we finish the bot/i)).not.toBeInTheDocument();
    });

    test('login purpose: renders the live widget when login is enabled', async () => {
        fetchTelegramConfig.mockResolvedValue({
            enabled: true, botUsername: 'bisnocbot', loginEnabled: true,
        });
        const { container } = render(<TelegramLoginButton onAuth={() => {}} />);

        // Wait for config to resolve, then the script should mount into the container.
        await screen.findByText((_, el) => el?.tagName === 'DIV');
        expect(screen.queryByText(/paused while we finish the bot/i)).not.toBeInTheDocument();
        const scripts = container.querySelectorAll('script[data-telegram-login="bisnocbot"]');
        expect(scripts.length).toBeGreaterThan(0);
    });
});
