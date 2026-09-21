import '@testing-library/jest-dom';
import { fireEvent, render, screen } from '@testing-library/react';
import { ThemeProvider } from '../theme';
import { Section, foldKeyFor } from '../components/DashboardSections';

const renderSection = (props = {}) => render(
    <ThemeProvider>
        <Section title="Admin Communications" {...props}>
            <div>panel body</div>
        </Section>
    </ThemeProvider>,
);

beforeEach(() => localStorage.clear());

test('a folded panel stays folded next visit; an opened one stays open', () => {
    // First visit: starts collapsed (defaultExpanded false).
    const first = renderSection();
    expect(screen.getByRole('button', { name: 'Expand' })).toBeInTheDocument();

    // Teacher opens it.
    fireEvent.click(screen.getByText('Admin Communications'));
    expect(screen.getByRole('button', { name: 'Collapse' })).toBeInTheDocument();
    expect(localStorage.getItem(foldKeyFor('Admin Communications'))).toBe('1');

    // "Next visit" — fresh mount must read the saved state, not the default.
    first.unmount();
    renderSection();
    expect(screen.getByRole('button', { name: 'Collapse' })).toBeInTheDocument();

    // Fold it again; a third visit keeps it folded.
    fireEvent.click(screen.getByText('Admin Communications'));
    expect(localStorage.getItem(foldKeyFor('Admin Communications'))).toBe('0');
});

test('without a saved fold the default still wins, and titles fold independently', () => {
    render(
        <ThemeProvider>
            <>
                <Section title="First panel" defaultExpanded><div>a</div></Section>
                <Section title="Second panel"><div>b</div></Section>
            </>
        </ThemeProvider>,
    );

    // Defaults: first open, second closed.
    const buttons = screen.getAllByRole('button');
    expect(buttons[0]).toHaveAccessibleName('Collapse');
    expect(buttons[1]).toHaveAccessibleName('Expand');

    // Fold the first; the second is untouched.
    fireEvent.click(screen.getByText('First panel'));
    expect(localStorage.getItem(foldKeyFor('First panel'))).toBe('0');
    expect(localStorage.getItem(foldKeyFor('Second panel'))).toBeNull();
});

test('persistFold={false} panels keep the old always-default behaviour', () => {
    localStorage.setItem(foldKeyFor('Sticky-free'), '1');
    renderSection({ title: 'Sticky-free', persistFold: false });
    expect(screen.getByRole('button', { name: 'Expand' })).toBeInTheDocument();
});
