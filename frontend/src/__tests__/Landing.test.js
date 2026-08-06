import '@testing-library/jest-dom';
import { render, screen } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { ThemeProvider } from '@mui/material';
import theme from '../theme';
import Landing from '../pages/Landing';
import { AuthProvider } from '../auth/AuthContext';

const renderWithProviders = (ui) =>
    render(
        <ThemeProvider theme={theme}>
            <BrowserRouter>
                <AuthProvider>{ui}</AuthProvider>
            </BrowserRouter>
        </ThemeProvider>
    );

describe('Landing Page', () => {
    test('renders school branding and sign-in button', () => {
        renderWithProviders(<Landing />);
        expect(screen.getAllByText(/British International School/i).length).toBeGreaterThan(0);
        expect(screen.getByRole('link', { name: /Staff Sign In/i })).toBeInTheDocument();
    });

    test('renders welcome tagline', () => {
        renderWithProviders(<Landing />);
        expect(
            screen.getByText(/manage teaching assignments/i)
        ).toBeInTheDocument();
    });

    test('renders footer with copyright', () => {
        renderWithProviders(<Landing />);
        expect(
            screen.getByText(/Internal Staff Use Only/i)
        ).toBeInTheDocument();
    });
});
