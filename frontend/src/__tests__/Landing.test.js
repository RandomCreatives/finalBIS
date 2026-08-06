import '@testing-library/jest-dom';
import { render, screen } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { CssBaseline } from '@mui/material';
import Landing from '../pages/Landing';
import { ThemeProvider } from '../theme';
import { AuthProvider } from '../auth/AuthContext';

const renderWithProviders = (ui) =>
    render(
        <ThemeProvider>
            <CssBaseline />
            <BrowserRouter>
                <AuthProvider>{ui}</AuthProvider>
            </BrowserRouter>
        </ThemeProvider>
    );

describe('Landing Page', () => {
    test('renders school branding and sign-in button', () => {
        renderWithProviders(<Landing />);
        expect(screen.getAllByText(/BIS NOC Gerji/i).length).toBeGreaterThan(0);
        expect(screen.getByRole('link', { name: /Sign In/i })).toBeInTheDocument();
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

    test('renders theme toggle switch', () => {
        renderWithProviders(<Landing />);
        expect(screen.getByLabelText('Toggle dark mode')).toBeInTheDocument();
    });
});
