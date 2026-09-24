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
    test('renders school branding without a confusing top login button', () => {
        renderWithProviders(<Landing />);
        expect(screen.getAllByText(/BIS NOC Gerji/i).length).toBeGreaterThan(0);
        expect(screen.queryByRole('link', { name: /^Sign In$/i })).not.toBeInTheDocument();
        expect(screen.getByRole('link', { name: /Administrator/ })).toBeInTheDocument();
    });

    test('renders the school welcome heading with clear hierarchy', () => {
        renderWithProviders(<Landing />);
        expect(
            screen.getByRole('heading', { name: /Welcome to British International School Gerji Primary 2/i })
        ).toBeInTheDocument();
    });

    test('renders the term-1 start pill', () => {
        renderWithProviders(<Landing />);
        expect(
            screen.getByText(/Term 1 begins Monday, 21 September 2026/)
        ).toBeInTheDocument();
    });

    test('activates Library while Store and Nurse remain Soon', () => {
        renderWithProviders(<Landing />);
        const modules = screen.getByTestId('coming-soon-modules');
        const library = screen.getByRole('link', { name: 'Library' });
        expect(library).toHaveAttribute('href', '/librarian-login');
        expect(modules).toContainElement(library);

        for (const label of ['Store', 'Nurse']) {
            const button = screen.getByRole('button', { name: new RegExp(`${label} Soon`, 'i') });
            expect(button).toBeDisabled();
            expect(modules).toContainElement(button);
        }
        expect(screen.queryByRole('button', { name: /Library Soon/i })).not.toBeInTheDocument();
    });

    test('shows Students, Calendar and Data Center in the public navigation', () => {
        renderWithProviders(<Landing />);
        expect(screen.getByRole('link', { name: 'Students' })).toHaveAttribute('href', '/students');
        expect(screen.getByRole('link', { name: 'Calendar' })).toHaveAttribute('href', '/calendar');
        expect(screen.getByRole('link', { name: 'Data Center' })).toHaveAttribute('href', '/data-center');
        expect(screen.queryByRole('link', { name: 'Classes' })).not.toBeInTheDocument();
        expect(screen.queryByRole('link', { name: 'Teachers' })).not.toBeInTheDocument();
    });

    test('renders the sign-in card above the fold', () => {
        renderWithProviders(<Landing />);
        expect(screen.getByRole('heading', { name: 'Sign in' })).toBeInTheDocument();
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
        expect(screen.getByText('Main Teacher')).toBeInTheDocument();
        expect(screen.getByText('Subject Teacher')).toBeInTheDocument();
    });

    test('role links land on the right sign-in surfaces', () => {
        renderWithProviders(<Landing />);
        // Main teachers sign in with a class card; subject teachers have their
        // own teacher-card wall at /subject-login (opens the subject dashboard).
        expect(screen.getByRole('link', { name: /Subject Teacher/ }))
            .toHaveAttribute('href', '/subject-login');
        expect(screen.getByRole('link', { name: /Main Teacher/ }))
            .toHaveAttribute('href', '/classes');
        expect(screen.getByRole('link', { name: /Administrator/ }))
            .toHaveAttribute('href', '/login');
    });

    test('does not offer an assistant teacher sign-in button yet', () => {
        renderWithProviders(<Landing />);
        expect(screen.queryByText('Assistant Teacher')).not.toBeInTheDocument();
    });

    test('renders module cards', () => {
        renderWithProviders(<Landing />);
        expect(screen.getByText('Attendance')).toBeInTheDocument();
        expect(screen.getByText('Timetable')).toBeInTheDocument();
    });
});
