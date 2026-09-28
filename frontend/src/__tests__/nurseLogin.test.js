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
    expect(screen.getByTestId('nurse-password')).toBeInTheDocument();
    expect(screen.queryByLabelText(/email/i)).not.toBeInTheDocument();

    fireEvent.change(screen.getByTestId('nurse-password'), { target: { value: '1234' } });
    fireEvent.click(screen.getByRole('button', { name: 'Open Nurse Dashboard' }));
    await waitFor(() => expect(login).toHaveBeenCalledWith('nurse@bisnoc.local', '1234'));
});
