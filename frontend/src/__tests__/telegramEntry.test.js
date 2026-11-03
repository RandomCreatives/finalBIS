import '@testing-library/jest-dom';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import TelegramEntry from '../pages/TelegramEntry';
import { useAuth } from '../auth/AuthContext';
import { ThemeProvider } from '../theme';

jest.mock('../auth/AuthContext', () => ({
    useAuth: jest.fn(),
}));

function LocationCapture() {
    const location = useLocation();
    return (
        <output data-testid="location">
            {location.pathname}|{location.state?.expectedRole || ''}|{location.state?.from?.path || ''}
        </output>
    );
}

function renderEntry(path) {
    return render(
        <ThemeProvider>
            <MemoryRouter initialEntries={[path]}>
                <Routes>
                    <Route path="/telegram-entry/:role" element={<TelegramEntry />} />
                    <Route path="/pwa-main-teacher-login" element={<div>Main Teacher sign-in</div>} />
                    <Route path="/app" element={<div>Role dashboard</div>} />
                    <Route path="/" element={<div>School overview</div>} />
                </Routes>
                <LocationCapture />
            </MemoryRouter>
        </ThemeProvider>,
    );
}

describe('Telegram role entry', () => {
    beforeEach(() => {
        localStorage.clear();
        jest.clearAllMocks();
    });

    test('signed-out teachers are sent to the main-teacher sign-in, not the generic admin login', () => {
        useAuth.mockReturnValue({ user: null, loading: false, logout: jest.fn() });

        renderEntry('/telegram-entry/main_teacher');

        expect(screen.getByText('Main Teacher sign-in')).toBeInTheDocument();
        expect(screen.getByTestId('location')).toHaveTextContent('/pwa-main-teacher-login|main_teacher|');
    });

    test('a signed-in user with the linked role goes to that role dashboard', () => {
        useAuth.mockReturnValue({
            user: { id: 'teacher-1', role: 'main_teacher' },
            loading: false,
            logout: jest.fn(),
        });

        renderEntry('/telegram-entry/main_teacher');

        expect(screen.getByText('Role dashboard')).toBeInTheDocument();
        expect(screen.getByTestId('location')).toHaveTextContent('/app||');
    });

    test('a different browser account is cleared and sent to the linked role sign-in', async () => {
        const logout = jest.fn();
        useAuth.mockReturnValue({
            user: { id: 'admin-1', role: 'admin' },
            loading: false,
            logout,
        });
        const nextPath = '/app/attendance?classId=class-1';

        renderEntry(`/telegram-entry/main_teacher?next=${encodeURIComponent(nextPath)}`);

        expect(await screen.findByText('Main Teacher sign-in')).toBeInTheDocument();
        expect(logout).toHaveBeenCalledTimes(1);
        expect(screen.getByTestId('location').textContent).toBe(
            `/pwa-main-teacher-login|main_teacher|${nextPath}`,
        );
        expect(screen.queryByText('Role dashboard')).not.toBeInTheDocument();
    });
});
