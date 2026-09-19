import '@testing-library/jest-dom';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import Staff from '../pages/Staff';
import { userApi, authApi } from '../api/endpoints';
import { fetchTelegramConfig } from '../auth/telegram';
import { ThemeProvider } from '../theme';
import { AuthProvider } from '../auth/AuthContext';

jest.mock('../api/endpoints', () => ({
    userApi: {
        list: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
    },
    authApi: {
        resetPassword: jest.fn(),
        me: jest.fn(),
    },
}));

jest.mock('../auth/telegram', () => ({
    fetchTelegramConfig: jest.fn(),
    botChatUrl: jest.fn(() => null),
}));

const ROWS = [
    { id: 'a1', name: 'Mr. Leul', email: 'leul@bisnoc.local', role: 'admin', isActive: true },
    { id: 's1', name: 'English Teacher 1', email: 'english.teacher.1@bisnocgerji.local', role: 'subject_teacher', isActive: true },
    { id: 'm1', name: 'Meron Abebe', email: 'meron.tarekegn@bisnoc.local', role: 'main_teacher', isActive: true },
];

const wrap = () => render(
    <ThemeProvider>
        <BrowserRouter>
            <AuthProvider>
                <Staff />
            </AuthProvider>
        </BrowserRouter>
    </ThemeProvider>
);

beforeEach(() => {
    jest.clearAllMocks();
    userApi.list.mockResolvedValue(ROWS);
    authApi.me.mockRejectedValue(new Error('no session'));
    fetchTelegramConfig.mockResolvedValue({ enabled: false, botUsername: '', loginEnabled: false });
});

describe('Staff page — reset password to basic', () => {
    test('teacher rows offer reset, admin rows do not', async () => {
        wrap();
        await screen.findByText('English Teacher 1');

        expect(screen.getByLabelText('Reset password for English Teacher 1')).toBeInTheDocument();
        expect(screen.getByLabelText('Reset password for Meron Abebe')).toBeInTheDocument();
        expect(screen.queryByLabelText('Reset password for Mr. Leul')).not.toBeInTheDocument();
    });

    test('confirm copies the right basic; result dialog hands it over', async () => {
        authApi.resetPassword.mockResolvedValue({
            message: "English Teacher 1's password was reset to the placeholder password (BisNoc2026!).",
            basic: 'BisNoc2026!',
        });
        wrap();
        await screen.findByText('English Teacher 1');

        fireEvent.click(screen.getByLabelText('Reset password for English Teacher 1'));
        const confirm = await screen.findByText(/Reset English Teacher 1’s password\?/);
        expect(confirm).toBeInTheDocument();
        expect(screen.getByText(/BisNoc2026!/i)).toBeInTheDocument();

        fireEvent.click(screen.getByRole('button', { name: 'Reset password' }));
        await waitFor(() => expect(authApi.resetPassword).toHaveBeenCalledWith('s1'));

        expect(await screen.findByText('Password reset')).toBeInTheDocument();
        expect(screen.getAllByText('BisNoc2026!').length).toBeGreaterThan(0);
    });

    test('main teacher confirm names the class card password as the basic', async () => {
        wrap();
        await screen.findByText('Meron Abebe');

        fireEvent.click(screen.getByLabelText('Reset password for Meron Abebe'));
        await screen.findByText(/Reset Meron Abebe’s password\?/);
        expect(screen.getByText(/class card password for their class/)).toBeInTheDocument();
    });
});
