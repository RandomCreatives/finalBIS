import '@testing-library/jest-dom';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { ThemeProvider } from '../theme';
import { AuthProvider } from '../auth/AuthContext';
import {
    IdentityCard, SecurityCard, TeachingCard, PreferencesCard,
} from '../components/settings/profileCards';
import { authApi } from '../api/endpoints';

jest.mock('../api/endpoints', () => ({
    authApi: {
        me: jest.fn(),
        updateProfile: jest.fn(),
        changePassword: jest.fn(),
    },
}));

const wrap = (ui) => render(
    <ThemeProvider>
        <AuthProvider>{ui}</AuthProvider>
    </ThemeProvider>
);

beforeEach(() => jest.clearAllMocks());

/* ── security ────────────────────────────────────────────── */
describe('SecurityCard', () => {
    test('managed mode explains and shows no password form', () => {
        wrap(<SecurityCard mode="managed" />);
        expect(screen.getByText(/class card/i)).toBeInTheDocument();
        expect(screen.queryByLabelText(/Current password/i)).not.toBeInTheDocument();
    });

    test('self-service validates mismatched passwords', () => {
        wrap(<SecurityCard />);
        fireEvent.change(screen.getByLabelText(/^Current password/i), { target: { value: 'old-secret-1' } });
        fireEvent.change(screen.getByLabelText(/^New password/i), { target: { value: 'fresh-secret-42' } });
        fireEvent.change(screen.getByLabelText(/^Confirm new password/i), { target: { value: 'something-else' } });
        fireEvent.click(screen.getByRole('button', { name: /Change password/i }));
        expect(screen.getByText(/do not match/i)).toBeInTheDocument();
        expect(authApi.changePassword).not.toHaveBeenCalled();
    });

    test('self-service submits a valid change and clears the form', async () => {
        authApi.changePassword.mockResolvedValue({ message: 'ok' });
        wrap(<SecurityCard />);
        fireEvent.change(screen.getByLabelText(/^Current password/i), { target: { value: 'old-secret-1' } });
        fireEvent.change(screen.getByLabelText(/^New password/i), { target: { value: 'fresh-secret-42' } });
        fireEvent.change(screen.getByLabelText(/^Confirm new password/i), { target: { value: 'fresh-secret-42' } });
        fireEvent.click(screen.getByRole('button', { name: /Change password/i }));
        await screen.findByText(/Password changed/i);
        expect(authApi.changePassword).toHaveBeenCalledWith('old-secret-1', 'fresh-secret-42');
        expect(screen.getByLabelText(/^Current password/i)).toHaveValue('');
    });
});

/* ── identity ────────────────────────────────────────────── */
const TEACHER = {
    id: 't1', name: 'English Teacher 1', email: 'english.teacher.1@bisnocgerji.local',
    role: 'subject_teacher', phone: null,
};

describe('IdentityCard', () => {
    test('teacher view: name is locked with explanation; phone saves', async () => {
        authApi.me.mockResolvedValue(TEACHER);
        authApi.updateProfile.mockResolvedValue({ user: { ...TEACHER, phone: '0911234567' } });
        wrap(<IdentityCard roleLabel="Subject Teacher" />);

        await screen.findByText('English Teacher 1');
        expect(screen.queryByLabelText('Display name')).not.toBeInTheDocument();
        expect(screen.getByText(/issued by the school/i)).toBeInTheDocument();

        fireEvent.change(screen.getByLabelText('Phone'), { target: { value: '0911234567' } });
        fireEvent.click(screen.getByRole('button', { name: 'Save' }));
        await waitFor(() =>
            expect(authApi.updateProfile).toHaveBeenCalledWith({ phone: '0911234567' }));
    });

    test('admin view: name is editable and saves', async () => {
        authApi.me.mockResolvedValue({ ...TEACHER, name: 'Test Admin', role: 'admin' });
        authApi.updateProfile.mockResolvedValue({ user: { ...TEACHER, name: 'Mr. Mike', role: 'admin' } });
        wrap(<IdentityCard roleLabel="System Administrator" canEditName />);

        await screen.findByDisplayValue('Test Admin'); // me() effect has populated the field
        fireEvent.change(screen.getByLabelText('Display name'), { target: { value: 'Mr. Mike' } });
        fireEvent.click(screen.getAllByRole('button', { name: 'Save' })[0]);
        await waitFor(() =>
            expect(authApi.updateProfile).toHaveBeenCalledWith({ name: 'Mr. Mike' }));
    });
});

/* ── teaching ────────────────────────────────────────────── */
describe('TeachingCard', () => {
    test('renders rows', () => {
        wrap(<TeachingCard items={[
            { primary: 'English — Year 4 Blue', secondary: '5 sessions per week' },
        ]} />);
        expect(screen.getByText('English — Year 4 Blue')).toBeInTheDocument();
        expect(screen.getByText('5 sessions per week')).toBeInTheDocument();
    });

    test('renders the empty hint with no assignments', () => {
        wrap(<TeachingCard items={[]} />);
        expect(screen.getByText(/Nothing assigned/i)).toBeInTheDocument();
    });
});

/* ── preferences ─────────────────────────────────────────── */
describe('PreferencesCard', () => {
    test('renders the dark-mode switch', () => {
        wrap(<PreferencesCard />);
        expect(screen.getByText('Dark mode')).toBeInTheDocument();
        expect(screen.getByLabelText('Toggle dark mode')).toBeInTheDocument();
    });
});
