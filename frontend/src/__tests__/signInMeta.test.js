import '@testing-library/jest-dom';
import { render, screen } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { ThemeProvider } from '../theme';
import Staff from '../pages/Staff';
import { userApi } from '../api/endpoints';
import { useAuth } from '../auth/AuthContext';
import { signInMeta } from '../utils/time';

jest.mock('../auth/AuthContext', () => ({
    useAuth: jest.fn(),
}));

jest.mock('../api/endpoints', () => ({
    userApi: {
        list: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        deactivate: jest.fn(),
    },
}));

describe('signInMeta', () => {
    const now = new Date('2026-09-22T10:00:00');

    test('no login reads Never; today, yesterday and old dates read naturally', () => {
        expect(signInMeta(null, now)).toMatchObject({ text: 'Never', tone: 'never' });
        expect(signInMeta('2026-09-22T08:30:00', now)).toMatchObject({ text: 'Today 08:30', tone: 'fresh' });
        expect(signInMeta('2026-09-21T17:00:00', now)).toMatchObject({ text: 'Yesterday', tone: 'fresh' });
        expect(signInMeta('2026-09-20T09:00:00', now)).toMatchObject({ text: '2 days ago', tone: 'fresh' });
        // 3+ days quiet = stale, same bar as the dashboard card.
        expect(signInMeta('2026-09-19T09:00:00', now)).toMatchObject({ text: '3 days ago', tone: 'stale' });
        const old = signInMeta('2026-09-10T09:00:00', now);
        expect(old.tone).toBe('stale');
        expect(old.text).toBe('10 Sept 2026');
    });
});

describe('Staff page sign-in column', () => {
    test('never-signed-in staff get a Never chip, fresh staff get friendly text', async () => {
        useAuth.mockReturnValue({ user: { id: 'u-admin', name: 'Mr. Mike', role: 'admin' }, isAdmin: true });
        userApi.list.mockResolvedValue([
            { id: 'u1', name: 'Kalab', email: 'k@bis.et', role: 'subject_teacher', isActive: true, lastLoginAt: null },
            { id: 'u2', name: 'Fremnet', email: 'f@bis.et', role: 'subject_teacher', isActive: true, lastLoginAt: new Date().toISOString() },
        ]);

        render(
            <ThemeProvider>
                <BrowserRouter>
                    <Staff />
                </BrowserRouter>
            </ThemeProvider>,
        );

        expect(await screen.findByText('Never')).toBeInTheDocument();
        expect(await screen.findByText(/Today /)).toBeInTheDocument();
    });
});
