import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { MemoryRouter } from 'react-router-dom';
import { ThemeProvider } from '../theme';
import PublicClasses from '../pages/PublicClasses';
import { ClassLoginDialog } from '../components/ClassLoginCard';
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
        expect(screen.getByText(/Welcome, Ms. Mahilet N./)).toBeInTheDocument();
        expect(screen.getByLabelText(/Class password/i)).toBeInTheDocument();
    });

    test('Year 4 - Green names Ms. Samrawit E. and opens the password dialog', () => {
        renderPage();
        const card = screen.getByText('Year 4 - Green').closest('[data-testid="class-card"]');
        expect(card).toHaveTextContent('Ms. Samrawit E.');
        fireEvent.click(card.querySelector('button'));
        expect(screen.getByText(/Welcome, Ms. Samrawit E./)).toBeInTheDocument();
        expect(screen.getByLabelText(/Class password/i)).toBeInTheDocument();
    });

    test('classes with no main teacher get the placeholder dialog instead', () => {
        // Every real class is assigned now — exercise the placeholder branch
        // directly with a synthetic unassigned class.
        render(
            <ThemeProvider>
                <MemoryRouter>
                    <ClassLoginDialog loginClass={{ name: 'Year 5 - Test', mainTeacher: null }} onClose={() => {}} />
                </MemoryRouter>
            </ThemeProvider>,
        );
        expect(screen.getByText(/No main teacher has been assigned/i)).toBeInTheDocument();
    });
});
