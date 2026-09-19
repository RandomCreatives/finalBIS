import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { MemoryRouter } from 'react-router-dom';
import { ThemeProvider } from '../theme';
import PublicClasses from '../pages/PublicClasses';
import { CLASSES } from '../data/classes';

const renderPage = () =>
    render(
        <ThemeProvider>
            <MemoryRouter initialEntries={['/classes']}>
                <PublicClasses />
            </MemoryRouter>
        </ThemeProvider>,
    );

describe('PublicClasses (shared class cards)', () => {
    test('renders both year groups with one card per class', () => {
        renderPage();
        expect(screen.getByText('Year 3')).toBeInTheDocument();
        expect(screen.getByText('Year 4')).toBeInTheDocument();
        expect(screen.getAllByTestId('class-card')).toHaveLength(CLASSES.length);
    });

    test('tapping a card opens the shared password dialog', () => {
        renderPage();
        const buttons = screen.getAllByRole('button', { name: /Main Teacher Login|Teacher Login/i });
        fireEvent.click(buttons[0]);
        expect(screen.getByText(/Welcome, Ms. Yeabsira A./)).toBeInTheDocument();
        expect(screen.getByLabelText(/Class password/i)).toBeInTheDocument();
    });

    test('unassigned classes get the placeholder dialog instead', () => {
        renderPage();
        // Year 3 - Red has no main teacher assigned.
        fireEvent.click(screen.getByText('Year 3 - Red')
            .closest('[data-testid="class-card"]').querySelector('button'));
        expect(screen.getByText(/No main teacher has been assigned/i)).toBeInTheDocument();
    });
});
