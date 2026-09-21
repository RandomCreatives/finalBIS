import '@testing-library/jest-dom';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import SubjectTeacherLogin, {
    groupTeachers, isWallCard, primarySubject, subjectOf, teacherLabel,
} from '../pages/SubjectTeacherLogin';
import { authApi } from '../api/endpoints';
import { ThemeProvider } from '../theme';
import { AuthProvider } from '../auth/AuthContext';

const mockNavigate = jest.fn();
jest.mock('react-router-dom', () => ({
    ...jest.requireActual('react-router-dom'),
    useNavigate: () => mockNavigate,
}));

jest.mock('../api/endpoints', () => ({
    authApi: {
        subjectTeachers: jest.fn(),
        subjectTeacherLogin: jest.fn(),
        me: jest.fn(),
    },
}));

const seatHolder = (id, name, subjects) => ({ id, name, subjects });

describe('subjectOf', () => {
    test('strips the "Teacher N" suffix', () => {
        expect(subjectOf('English Teacher 1')).toBe('English');
        expect(subjectOf('Amharic Teacher 2')).toBe('Amharic');
        expect(subjectOf('Physical Education Teacher 1')).toBe('Physical Education');
        expect(subjectOf('ICT Teacher 1')).toBe('ICT');
        expect(subjectOf('French Teacher 1')).toBe('French');
    });

    test('leaves real names alone', () => {
        expect(subjectOf('Meron Abebe')).toBe('Meron Abebe');
    });
});

describe('primarySubject', () => {
    test('placeholders file under the subject in their name, whatever the seat mix', () => {
        expect(primarySubject(seatHolder('1', 'English Teacher 3', [
            { code: 'SPL', name: 'Spelling', seats: 8 },
            { code: 'ENG', name: 'English', seats: 4 },
        ]))).toBe('English');
        expect(primarySubject(seatHolder('2', 'Music Teacher 1', [
            { code: 'MUS', name: 'Music', seats: 7 },
        ]))).toBe('Music');
    });

    test('named teachers file under the subject they hold the most seats in', () => {
        expect(primarySubject(seatHolder('1', 'Dihurwe Desire', [
            { code: 'SPL', name: 'Spelling', seats: 3 },
            { code: 'ENG', name: 'English', seats: 5 },
        ]))).toBe('English');
    });

    test('ties break alphabetically; no seats files under Other', () => {
        expect(primarySubject(seatHolder('1', 'Mulu Tadesse', [
            { code: 'B', name: 'Beta', seats: 2 },
            { code: 'A', name: 'Alpha', seats: 2 },
        ]))).toBe('Alpha');
        expect(primarySubject(seatHolder('1', 'Mulu Tadesse', []))).toBe('Other');
    });
});

describe('groupTeachers', () => {
    test('groups placeholders by name and named teachers by seat majority, sorted', () => {
        const teachers = [
            seatHolder('1', 'English Teacher 3', [
                { code: 'SPL', name: 'Spelling', seats: 8 },
                { code: 'ENG', name: 'English', seats: 4 },
            ]),
            seatHolder('2', 'Dihurwe Desire', [
                { code: 'ENG', name: 'English', seats: 5 },
                { code: 'SPL', name: 'Spelling', seats: 3 },
            ]),
            seatHolder('3', 'Mihiret Moges H/Mariam', [{ code: 'AMH', name: 'Amharic', seats: 7 }]),
            seatHolder('4', 'Fremnet Mamo Esubalew', [{ code: 'AMH', name: 'Amharic', seats: 7 }]),
        ];
        const groups = groupTeachers(teachers);
        expect(groups.map((g) => g.subject)).toEqual(['Amharic', 'English']);
        expect(groups[0].teachers.map((t) => t.name)).toEqual(
            ['Fremnet Mamo Esubalew', 'Mihiret Moges H/Mariam'],
        );
        expect(groups[1].teachers.map((t) => t.name)).toEqual(
            ['Dihurwe Desire', 'English Teacher 3'],
        );
    });
});

describe('teacherLabel', () => {
    test('placeholder seats get a generic label', () => {
        expect(teacherLabel({ name: 'English Teacher 3' })).toBe('Teacher 3');
        expect(teacherLabel({ name: 'Physical Education Teacher 1' })).toBe('Teacher 1');
    });

    test('real names are shown on staffed seats', () => {
        expect(teacherLabel({ name: 'Dihurwe Desire' })).toBe('Dihurwe Desire');
    });
});

describe('isWallCard', () => {
    test('every current-year seat holder gets a card — placeholder or named', () => {
        expect(isWallCard(seatHolder('1', 'English Teacher 3', [{ code: 'ENG', name: 'English', seats: 4 }]))).toBe(true);
        expect(isWallCard(seatHolder('2', 'Dihurwe Desire', [{ code: 'ENG', name: 'English', seats: 5 }]))).toBe(true);
    });

    test('accounts without seats this year have no card', () => {
        expect(isWallCard(seatHolder('1', 'Abeba Wendifraw Dinku', []))).toBe(false);
        expect(isWallCard({ id: '2', name: 'English Teacher 4' })).toBe(false);
    });
});

describe('SubjectTeacherLogin wall', () => {
    const renderWall = () =>
        render(
            <ThemeProvider>
                <MemoryRouter initialEntries={['/subject-login']}>
                    <AuthProvider>
                        <SubjectTeacherLogin />
                    </AuthProvider>
                </MemoryRouter>
            </ThemeProvider>,
        );

    beforeEach(() => {
        jest.clearAllMocks();
    });

    test('renders collapsible subject bars: real names where staffed, teacher numbers where not', async () => {
        authApi.subjectTeachers.mockResolvedValue([
            seatHolder('1', 'English Teacher 3', [
                { code: 'SPL', name: 'Spelling', seats: 8 },
                { code: 'ENG', name: 'English', seats: 4 },
            ]),
            seatHolder('2', 'Dihurwe Desire', [
                { code: 'ENG', name: 'English', seats: 5 },
                { code: 'SPL', name: 'Spelling', seats: 3 },
            ]),
            seatHolder('3', 'Mihiret Moges H/Mariam', [{ code: 'AMH', name: 'Amharic', seats: 7 }]),
            seatHolder('9', 'Abeba Wendifraw Dinku', []), // no seats this year — hidden
        ]);
        renderWall();

        const english = await screen.findByText('English');
        expect(screen.getByText('Amharic')).toBeInTheDocument();
        expect(screen.getByText('2 teachers')).toBeInTheDocument(); // English: placeholder + named
        expect(screen.getByText('1 teacher')).toBeInTheDocument();  // Amharic

        // real names on staffed seats, generic number on the unstaffed one
        expect(screen.getByText('Dihurwe Desire')).toBeInTheDocument();
        expect(screen.getByText('Mihiret Moges H/Mariam')).toBeInTheDocument();
        expect(screen.getByText('Teacher 3')).toBeInTheDocument();
        expect(screen.queryByText('Abeba Wendifraw Dinku')).not.toBeInTheDocument();
        // the placeholder files under "English" (its name), not its majority seat subject
        expect(screen.queryByText('Spelling')).not.toBeInTheDocument();

        // subject bars start collapsed and expand on tap
        const summary = english.closest('.MuiAccordionSummary-root');
        expect(summary).toHaveAttribute('aria-expanded', 'false');
        fireEvent.click(summary);
        expect(summary).toHaveAttribute('aria-expanded', 'true');
    });

    test('tapping a card and entering the password signs into the subject dashboard', async () => {
        authApi.subjectTeachers.mockResolvedValue([
            seatHolder('1', 'Amharic Teacher 1', [{ code: 'AMH', name: 'Amharic', seats: 7 }]),
            seatHolder('2', 'Fremnet Mamo Esubalew', [{ code: 'AMH', name: 'Amharic', seats: 7 }]),
        ]);
        authApi.subjectTeacherLogin.mockResolvedValue({
            token: 't.jwt', user: { id: '2', name: 'Fremnet Mamo Esubalew', role: 'subject_teacher' },
        });
        renderWall();

        const summary = (await screen.findByText('Amharic')).closest('.MuiAccordionSummary-root');
        fireEvent.click(summary);

        const cards = await screen.findAllByTestId('subject-seat-card');
        fireEvent.click(cards[1]); // Fremnet

        expect(await screen.findByText('Sign in as Fremnet Mamo Esubalew')).toBeInTheDocument();
        fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'fremnet-pass' } });
        fireEvent.click(screen.getByRole('button', { name: /^Sign in$/ }));

        await waitFor(() =>
            expect(authApi.subjectTeacherLogin).toHaveBeenCalledWith('2', 'fremnet-pass'));
        await waitFor(() =>
            expect(mockNavigate).toHaveBeenCalledWith('/subject-home', { replace: true }));
    });

    test('back button: fresh visit falls back to the landing page', async () => {
        authApi.subjectTeachers.mockResolvedValue([
            seatHolder('1', 'Amanuel Teamu Tsegaye', [{ code: 'ICT', name: 'ICT', seats: 14 }]),
        ]);
        renderWall();
        fireEvent.click(screen.getByRole('button', { name: 'Back' }));
        expect(mockNavigate).toHaveBeenCalledWith('/');
    });

    test('a11y: icon-only controls carry accessible names', async () => {
        authApi.subjectTeachers.mockResolvedValue([
            seatHolder('1', 'ICT Teacher 1', [{ code: 'ICT', name: 'ICT', seats: 14 }]),
        ]);
        renderWall();
        expect(screen.getByRole('button', { name: /switch to (light|dark) mode/i })).toBeInTheDocument();

        fireEvent.click((await screen.findByText('ICT')).closest('.MuiAccordionSummary-root'));
        fireEvent.click(await screen.findByTestId('subject-seat-card'));
        expect(screen.getByRole('button', { name: /show password/i })).toBeInTheDocument();
    });

    test('a wrong password keeps the dialog open with the server message', async () => {
        authApi.subjectTeachers.mockResolvedValue([
            seatHolder('1', 'ICT Teacher 1', [{ code: 'ICT', name: 'ICT', seats: 14 }]),
        ]);
        authApi.subjectTeacherLogin.mockRejectedValue(new Error('Incorrect password'));
        renderWall();

        fireEvent.click((await screen.findByText('ICT')).closest('.MuiAccordionSummary-root'));
        fireEvent.click(await screen.findByTestId('subject-seat-card'));
        fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'nope' } });
        fireEvent.click(screen.getByRole('button', { name: /^Sign in$/ }));

        expect(await screen.findByText('Incorrect password')).toBeInTheDocument();
        expect(mockNavigate).not.toHaveBeenCalledWith('/subject-home', { replace: true });
    });
});
