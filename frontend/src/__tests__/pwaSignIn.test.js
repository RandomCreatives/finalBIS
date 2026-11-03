import '@testing-library/jest-dom';
import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import PwaSignIn from '../pages/PwaSignIn';
import { ThemeProvider } from '../theme';

function LocationCapture() {
    const location = useLocation();
    return <output data-testid="location">{location.pathname}|{location.state?.expectedRole || ''}</output>;
}

function renderSignIn() {
    return render(
        <ThemeProvider>
            <MemoryRouter initialEntries={['/pwa-sign-in']}>
                <Routes>
                    <Route path="/pwa-sign-in" element={<PwaSignIn />} />
                    <Route path="/pwa-main-teacher-login" element={<div>Main Teacher sign-in</div>} />
                    <Route path="/subject-login" element={<div>Subject Teacher sign-in</div>} />
                    <Route path="/login" element={<div>Email sign-in</div>} />
                </Routes>
                <LocationCapture />
            </MemoryRouter>
        </ThemeProvider>,
    );
}

describe('PWA role sign-in selector', () => {
    test('lists role-specific teacher sign-in choices and identifies the chosen role', async () => {
        renderSignIn();

        expect(screen.getByText(/Teachers will see their own sign-in/)).toBeInTheDocument();
        fireEvent.click(screen.getByRole('link', { name: /Main Teacher/ }));
        expect(await screen.findByText('Main Teacher sign-in')).toBeInTheDocument();
        expect(screen.getByTestId('location')).toHaveTextContent('/pwa-main-teacher-login|main_teacher');
    });

    test('subject teachers get their teacher-card sign-in rather than the staff email form', async () => {
        renderSignIn();

        fireEvent.click(screen.getByRole('link', { name: /Subject Teacher/ }));
        expect(await screen.findByText('Subject Teacher sign-in')).toBeInTheDocument();
        expect(screen.getByTestId('location')).toHaveTextContent('/subject-login|subject_teacher');
    });
});
