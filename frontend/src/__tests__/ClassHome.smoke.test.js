import '@testing-library/jest-dom';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { CssBaseline } from '@mui/material';
import ClassHome from '../pages/ClassHome';
import { ThemeProvider } from '../theme';
import { CLASS_LOGIN_KEY } from '../data/classes';

const renderDash = (slug) => {
    localStorage.setItem(CLASS_LOGIN_KEY, JSON.stringify({
        slug, className: 'Year 3 - Blue', teacher: 'Ms. Yeabsira A.', at: Date.now(),
    }));
    return render(
        <ThemeProvider>
            <CssBaseline />
            <MemoryRouter initialEntries={[`/class-home/${slug}`]}>
                <Routes>
                    <Route path="/class-home/:slug" element={<ClassHome />} />
                </Routes>
            </MemoryRouter>
        </ThemeProvider>
    );
};

describe('ClassHome dashboard', () => {
    test('renders welcome + sections when logged in', () => {
        renderDash('year-3-blue');
        expect(screen.getAllByText(/Main Teacher/i).length).toBeGreaterThan(0);
        expect(screen.getAllByText(/Overview/i).length).toBeGreaterThan(0);
        expect(screen.getAllByText(/Attendance/i).length).toBeGreaterThan(0);
    });

    test('redirects to /classes when no session', () => {
        localStorage.removeItem(CLASS_LOGIN_KEY);
        const { container } = render(
            <ThemeProvider>
                <CssBaseline />
                <MemoryRouter initialEntries={['/class-home/year-3-blue']}>
                    <Routes>
                        <Route path="/class-home/:slug" element={<ClassHome />} />
                        <Route path="/classes" element={<div>Classes directory</div>} />
                    </Routes>
                </MemoryRouter>
            </ThemeProvider>
        );
        expect(container.textContent).toMatch(/Classes directory/);
        expect(container.textContent).not.toMatch(/Good (morning|afternoon|evening)/);
    });
});
