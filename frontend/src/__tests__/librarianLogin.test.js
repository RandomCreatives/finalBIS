import '@testing-library/jest-dom';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { ThemeProvider } from '../theme';
import LibrarianLogin from '../pages/LibrarianLogin';
import { useAuth } from '../auth/AuthContext';

jest.mock('../auth/AuthContext', () => ({
    useAuth: jest.fn(),
}));

test('librarian login asks only for a password and opens Library', async () => {
    const login = jest.fn().mockResolvedValue({ role: 'librarian' });
    useAuth.mockReturnValue({ login });

    render(
        <ThemeProvider>
            <MemoryRouter>
                <LibrarianLogin />
            </MemoryRouter>
        </ThemeProvider>,
    );

    expect(screen.getByTestId('librarian-password')).toBeInTheDocument();
    expect(screen.queryByLabelText(/email/i)).not.toBeInTheDocument();

    fireEvent.change(screen.getByTestId('librarian-password'), { target: { value: '123456' } });
    fireEvent.click(screen.getByRole('button', { name: 'Open Library' }));

    await waitFor(() => expect(login).toHaveBeenCalledWith('librarian@bisnoc.local', '123456'));
});
