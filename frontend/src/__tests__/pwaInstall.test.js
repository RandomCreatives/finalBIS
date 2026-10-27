import '@testing-library/jest-dom';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { ThemeProvider } from '../theme';
import PwaInstallBanner from '../components/PwaInstallBanner';
import PwaInstallButton from '../components/PwaInstallButton';
import { PwaInstallCard } from '../components/settings/profileCards';
import Landing from '../pages/Landing';
import {
    _resetPwaInstallForTests,
    PWA_SNOOZE_STORAGE_KEY,
} from '../utils/pwaInstall';

const mockAuthState = {
    user: { id: 'u-teacher', name: 'Ms. Bethelhem G.', email: 'bethelhem@bisnoc.local', role: 'main_teacher' },
    loading: false,
};

jest.mock('../auth/AuthContext', () => ({
    useAuth: () => mockAuthState,
}));

const originalUserAgent = window.navigator.userAgent;
const originalMatchMedia = window.matchMedia;

function setUserAgent(ua) {
    Object.defineProperty(window.navigator, 'userAgent', {
        value: ua,
        configurable: true,
    });
}

function setStandalone(matches) {
    window.matchMedia = jest.fn().mockImplementation((query) => ({
        matches: query === '(display-mode: standalone)' ? matches : false,
        media: query,
        addEventListener: jest.fn(),
        removeEventListener: jest.fn(),
    }));
}

function dispatchBeforeInstallPrompt(outcome = 'accepted') {
    const prompt = jest.fn().mockResolvedValue(undefined);
    const event = new Event('beforeinstallprompt', { cancelable: true });
    event.prompt = prompt;
    event.userChoice = Promise.resolve({ outcome });
    act(() => {
        window.dispatchEvent(event);
    });
    return { event, prompt };
}

beforeEach(() => {
    setUserAgent(originalUserAgent);
    setStandalone(false);
    delete window.Telegram;
    mockAuthState.user = {
        id: 'u-teacher',
        name: 'Ms. Bethelhem G.',
        email: 'bethelhem@bisnoc.local',
        role: 'main_teacher',
    };
    mockAuthState.loading = false;
    _resetPwaInstallForTests();
});

afterAll(() => {
    setUserAgent(originalUserAgent);
    window.matchMedia = originalMatchMedia;
    delete window.Telegram;
});

describe('PWA install notification rollout (Option A)', () => {
    test('captures beforeinstallprompt and displays banner + top-bar button for all users', async () => {
        render(
            <ThemeProvider>
                <PwaInstallButton />
                <PwaInstallBanner />
            </ThemeProvider>,
        );

        expect(screen.queryByTestId('pwa-install-banner')).not.toBeInTheDocument();
        expect(screen.queryByTestId('pwa-install-button')).not.toBeInTheDocument();

        const { event, prompt } = dispatchBeforeInstallPrompt('accepted');
        expect(event.defaultPrevented).toBe(true);

        expect(screen.getByTestId('pwa-install-banner')).toBeInTheDocument();
        expect(screen.getByText(/Install BIS NOC Gerji App/i)).toBeInTheDocument();
        expect(screen.getByTestId('pwa-install-button')).toBeInTheDocument();

        fireEvent.click(screen.getByTestId('pwa-banner-install'));
        await waitFor(() => expect(prompt).toHaveBeenCalledTimes(1));
    });

    test('snoozing banner ("Not now") hides banner for 14 days while keeping Settings & header install active', async () => {
        render(
            <ThemeProvider>
                <PwaInstallButton />
                <PwaInstallCard />
                <PwaInstallBanner />
            </ThemeProvider>,
        );

        const { prompt } = dispatchBeforeInstallPrompt('accepted');
        expect(screen.getByTestId('pwa-install-banner')).toBeInTheDocument();

        fireEvent.click(screen.getByTestId('pwa-banner-snooze'));

        // Banner disappears and writes snooze timestamp, while top-bar & Settings card stay ready!
        expect(screen.queryByTestId('pwa-install-banner')).not.toBeInTheDocument();
        expect(Number(window.localStorage.getItem(PWA_SNOOZE_STORAGE_KEY))).toBeGreaterThan(Date.now());
        expect(screen.getByTestId('pwa-install-button')).toBeInTheDocument();
        expect(screen.getByTestId('settings-pwa-install-btn')).toBeInTheDocument();

        fireEvent.click(screen.getByTestId('settings-pwa-install-btn'));
        await waitFor(() => expect(prompt).toHaveBeenCalledTimes(1));
    });

    test('shows iPhone / iPad Add to Home Screen instructions on iOS Safari', () => {
        setUserAgent(
            'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Mobile/15E148 Safari/604.1',
        );

        render(
            <ThemeProvider>
                <PwaInstallButton />
                <PwaInstallCard />
                <PwaInstallBanner />
            </ThemeProvider>,
        );

        expect(screen.getByText(/Add BIS NOC Gerji to Home Screen/i)).toBeInTheDocument();
        expect(screen.getByTestId('pwa-install-button')).toBeInTheDocument();
        expect(screen.getByTestId('settings-pwa-ios-btn')).toBeInTheDocument();

        fireEvent.click(screen.getByTestId('pwa-banner-ios-guide'));
        expect(screen.getByText(/Install BIS NOC Gerji on iPhone \/ iPad/i)).toBeInTheDocument();
    });

    test('suppresses install banner & button inside Telegram WebView and standalone mode', () => {
        window.Telegram = { WebApp: { initData: 'query_id=AAHdF6IQAAAAAN0XohDhrOrc' } };
        setUserAgent(
            'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148 Telegram/10.9',
        );

        const { unmount } = render(
            <ThemeProvider>
                <PwaInstallButton />
                <PwaInstallCard />
                <PwaInstallBanner />
            </ThemeProvider>,
        );

        dispatchBeforeInstallPrompt('accepted');
        expect(screen.queryByTestId('pwa-install-banner')).not.toBeInTheDocument();
        expect(screen.queryByTestId('pwa-install-button')).not.toBeInTheDocument();
        expect(screen.getByText(/currently inside Telegram/i)).toBeInTheDocument();
        unmount();

        // Installed standalone PWA state
        delete window.Telegram;
        setUserAgent(originalUserAgent);
        setStandalone(true);
        _resetPwaInstallForTests();

        render(
            <ThemeProvider>
                <PwaInstallButton />
                <PwaInstallCard />
                <PwaInstallBanner />
            </ThemeProvider>,
        );

        expect(screen.queryByTestId('pwa-install-banner')).not.toBeInTheDocument();
        expect(screen.queryByTestId('pwa-install-button')).not.toBeInTheDocument();
        expect(screen.getByText(/Installed on this device/i)).toBeInTheDocument();
    });

    test('standalone Landing redirects Subject Teachers directly to /subject-home', () => {
        setStandalone(true);
        mockAuthState.user = {
            id: 'u-st',
            name: 'Mr. Michael',
            email: 'michael@bisnoc.local',
            role: 'subject_teacher',
        };

        render(
            <ThemeProvider>
                <MemoryRouter initialEntries={['/']}>
                    <Routes>
                        <Route path="/" element={<Landing />} />
                        <Route path="/subject-home" element={<div data-testid="subject-dest">Subject Home</div>} />
                        <Route path="/app" element={<div data-testid="app-dest">App Home</div>} />
                    </Routes>
                </MemoryRouter>
            </ThemeProvider>,
        );

        expect(screen.getByTestId('subject-dest')).toBeInTheDocument();
    });
});
