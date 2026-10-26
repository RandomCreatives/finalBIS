import '@testing-library/jest-dom';
import { render, screen, within } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { CssBaseline } from '@mui/material';
import ClassHome from '../pages/ClassHome';
import { ThemeProvider } from '../theme';
import { CLASS_LOGIN_KEY } from '../data/classes';

// ClassHome normally renders inside <AuthProvider> (see App.js); the smoke
// test renders it bare, so provide just enough auth for the bell.
jest.mock('../auth/AuthContext', () => ({
    useAuth: jest.fn(),
}));

const { useAuth } = jest.requireMock('../auth/AuthContext');

const renderDash = (slug) => {
    useAuth.mockReturnValue({ user: { id: 'u-1', name: 'Ms. Yeabsira A.', role: 'main_teacher' } });
    localStorage.setItem(CLASS_LOGIN_KEY, JSON.stringify({
        slug, className: 'Year 3 - Blue', teacher: 'Ms. Yeabsira A.',
        classId: '713bfeaa-d141-44f0-864a-cee594efb105', at: Date.now(),
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

    test('sidebar is full-length with Profile pinned to the bottom', () => {
        renderDash('year-3-blue');
        const nav = screen.getByTestId('side-nav');
        expect(screen.getByTestId('side-nav-spacer')).toBeInTheDocument();
        const profile = within(nav).getByTestId('side-nav-profile');
        expect(profile).toHaveTextContent('Profile');
        const buttons = within(nav).getAllByRole('button');
        expect(buttons[buttons.length - 1]).toBe(profile);
    });

    test('sidebar groups: Class Room Management order, visual dividers, Report Cards & Admin Communications greyed "soon"', () => {
        renderDash('year-3-blue');
        const nav = screen.getByTestId('side-nav');
        expect(screen.getByTestId('side-nav-group-0'))
            .toHaveTextContent('Class Room Management');
        expect(screen.getByTestId('side-nav-group-1'))
            .toHaveTextContent('Admin Communications');

        // Exact order inside Class Room Management + Admin Communications + Profile
        const buttons = within(nav).getAllByRole('button');
        expect(buttons.map((b) => b.textContent.trim())).toEqual([
            'Overview',
            'Students',
            'Attendance',
            'Marksheets',
            'Timetable',
            'Planning',
            'Calendar',
            'Report Cardssoon',
            'Storesoon',
            'Requestsoon',
            'Conduct reportsoon',
            'Profile',
        ]);

        // Report Cards and Admin Communications stay visible but greyed with a "soon" chip
        const reportCards = within(nav).getByRole('button', { name: /^Report Cards soon$/ });
        const store = within(nav).getByRole('button', { name: /^Store soon$/ });
        const request = within(nav).getByRole('button', { name: /^Request soon$/ });
        const conduct = within(nav).getByRole('button', { name: /^Conduct report soon$/ });
        for (const btn of [reportCards, store, request, conduct]) expect(btn).toBeDisabled();

        // Visual separator lines: after Timetable, and framing Report Cards
        const afterTimetable = within(nav).getByTestId('side-nav-divider-after-timetable');
        const beforeReportCards = within(nav).getByTestId('side-nav-divider-before-reportCards');
        const afterReportCards = within(nav).getByTestId('side-nav-divider-after-reportCards');

        const timetableBtn = within(nav).getByRole('button', { name: 'Timetable' });
        const planningBtn = within(nav).getByRole('button', { name: 'Planning' });
        const calendarBtn = within(nav).getByRole('button', { name: 'Calendar' });
        const adminGroup = within(nav).getByTestId('side-nav-group-1');

        expect(timetableBtn.compareDocumentPosition(afterTimetable) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
        expect(afterTimetable.compareDocumentPosition(planningBtn) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
        expect(calendarBtn.compareDocumentPosition(beforeReportCards) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
        expect(beforeReportCards.compareDocumentPosition(reportCards) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
        expect(reportCards.compareDocumentPosition(afterReportCards) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
        expect(afterReportCards.compareDocumentPosition(adminGroup) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
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
