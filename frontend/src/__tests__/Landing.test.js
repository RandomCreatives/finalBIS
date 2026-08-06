import '@testing-library/jest-dom';
import { render, screen, fireEvent } from '@testing-library/react';
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
    test('renders hero headline and branding', () => {
        renderWithProviders(<Landing />);
        expect(
            screen.getByText(/The Complete Digital Spine for/i)
        ).toBeInTheDocument();
        expect(
            screen.getAllByText(/British International School/i).length
        ).toBeGreaterThan(0);
    });

    test('renders interactive simulators section', () => {
        renderWithProviders(<Landing />);
        expect(
            screen.getByText(/Interactive Backend Logic Simulators/i)
        ).toBeInTheDocument();
        expect(
            screen.getByText(/Marksheet Grading Engine/i)
        ).toBeInTheDocument();
        expect(
            screen.getByText(/Library Overdue Calculator/i)
        ).toBeInTheDocument();
    });

    test('opens module detail modal when clicking a feature card', () => {
        renderWithProviders(<Landing />);
        const exploreButtons = screen.getAllByText(/Explore Workflow & Specs/i);
        expect(exploreButtons.length).toBeGreaterThan(0);

        fireEvent.click(exploreButtons[0]);
        expect(
            screen.getByText(/ARCHITECTURAL OVERVIEW/i)
        ).toBeInTheDocument();
    });
});
