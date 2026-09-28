import '@testing-library/jest-dom';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { ThemeProvider } from '../theme';
import NurseLogin from '../pages/NurseLogin';
import { useAuth } from '../auth/AuthContext';

jest.mock('../auth/AuthContext', () => ({ useAuth: jest.fn() }));

test('nurse login asks only for a password', async () => {
    const login = jest.fn().mockResolvedValue({ role: 'nurse' });
    useAuth.mockReturnValue({ login });

    render(<ThemeProvider><MemoryRouter><NurseLogin /></MemoryRouter></ThemeProvider>);
    const passwordInput = screen.getByTestId('nurse-password');
    expect(passwordInput).toBeInTheDocument();
    expect(passwordInput).toHaveAttribute('type', 'password');
    expect(screen.queryByLabelText(/email/i)).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Show password' }));
    expect(passwordInput).toHaveAttribute('type', 'text');
    fireEvent.click(screen.getByRole('button', { name: 'Hide password' }));
    expect(passwordInput).toHaveAttribute('type', 'password');

    fireEvent.change(passwordInput, { target: { value: '123456' } });

    fireEvent.click(screen.getByRole('button', { name: 'Open Nurse Dashboard' }));
    await waitFor(() => expect(login).toHaveBeenCalledWith('nurse@bisnoc.local', '123456'));
});
