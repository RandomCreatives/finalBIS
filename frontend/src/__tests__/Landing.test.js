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
        expect(screen.getAllByRole('link', { name: /Sign In/i }).length).toBeGreaterThan(0);
    });

    test('renders welcome heading', () => {
        renderWithProviders(<Landing />);
        expect(
            screen.getByText(/One place for everything/i)
        ).toBeInTheDocument();
    });

    test('renders footer with copyright', () => {
        renderWithProviders(<Landing />);
        expect(
            screen.getByText(/Internal Staff Use Only/i)
        ).toBeInTheDocument();
    });

    test('renders role access entries', () => {
        renderWithProviders(<Landing />);
        expect(screen.getByText('Administrator')).toBeInTheDocument();
        expect(screen.getAllByText('Clinic').length).toBeGreaterThan(0);
        expect(screen.getByText('Store Manager')).toBeInTheDocument();
    });

    test('renders module cards', () => {
        renderWithProviders(<Landing />);
        expect(screen.getByText('Attendance')).toBeInTheDocument();
        expect(screen.getByText('Timetable')).toBeInTheDocument();
    });
});
