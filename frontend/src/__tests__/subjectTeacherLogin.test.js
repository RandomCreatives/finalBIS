import '@testing-library/jest-dom';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import SubjectTeacherLogin, {
    groupTeachers, isWallCard, subjectOf, teacherLabel,
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

describe('groupTeachers', () => {
    test('groups by subject, sorted, numeric order within a subject', () => {
        const teachers = [
            { id: '4', name: 'English Teacher 3' },
            { id: '1', name: 'Amharic Teacher 1' },
            { id: '3', name: 'English Teacher 2' },
            { id: '2', name: 'English Teacher 1' },
            { id: '5', name: 'Amharic Teacher 2' },
        ];
        const groups = groupTeachers(teachers);
        expect(groups.map((g) => g.subject)).toEqual(['Amharic', 'English']);
        expect(groups[0].teachers.map((t) => t.name)).toEqual(['Amharic Teacher 1', 'Amharic Teacher 2']);
        expect(groups[1].teachers.map((t) => t.name)).toEqual(
            ['English Teacher 1', 'English Teacher 2', 'English Teacher 3'],
        );
    });
});

describe('teacherLabel', () => {
    test('placeholder seats get a generic label', () => {
        expect(teacherLabel({ name: 'English Teacher 2' })).toBe('Teacher 2');
        expect(teacherLabel({ name: 'Physical Education Teacher 1' })).toBe('Teacher 1');
    });

    test('real names are kept for the reveal later', () => {
        expect(teacherLabel({ name: 'Meron Abebe' })).toBe('Meron Abebe');
    });
});

describe('isWallCard', () => {
    test('only numbered placeholder seats appear on the wall', () => {
        expect(isWallCard({ name: 'English Teacher 1' })).toBe(true);
        expect(isWallCard({ name: 'Amharic Teacher' })).toBe(false);   // unnumbered shell
        expect(isWallCard({ name: 'Meron Abebe' })).toBe(false);       // real staff name
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

    test('renders collapsible subject bars numbered generically, hiding non-placeholder accounts', async () => {
        authApi.subjectTeachers.mockResolvedValue([
            { id: '1', name: 'English Teacher 1' },
            { id: '2', name: 'English Teacher 2' },
            { id: '3', name: 'Amharic Teacher 1' },
            { id: '8', name: 'Music Teacher' },   // unnumbered shell — hidden
            { id: '9', name: 'Meron Abebe' },     // real staff name — hidden until reveal
        ]);
        renderWall();

        const english = await screen.findByText('English');
        expect(screen.getByText('Amharic')).toBeInTheDocument();
        expect(screen.getByText('2 teachers')).toBeInTheDocument();
        expect(screen.getByText('1 teacher')).toBeInTheDocument();

        // generic Teacher N cards
        expect(screen.getAllByText('Teacher 1')).toHaveLength(2); // English + Amharic
        expect(screen.getByText('Teacher 2')).toBeInTheDocument();
        expect(screen.queryByText('Meron Abebe')).not.toBeInTheDocument();
        expect(screen.queryByText('Music Teacher')).not.toBeInTheDocument();

        // subject bars start collapsed and expand on tap
        const summary = english.closest('.MuiAccordionSummary-root');
        expect(summary).toHaveAttribute('aria-expanded', 'false');
        fireEvent.click(summary);
        expect(summary).toHaveAttribute('aria-expanded', 'true');
    });

    test('tapping a card and entering the password signs into the subject dashboard', async () => {
        authApi.subjectTeachers.mockResolvedValue([
            { id: '1', name: 'Amharic Teacher 1' },
            { id: '2', name: 'Amharic Teacher 2' },
        ]);
        authApi.subjectTeacherLogin.mockResolvedValue({
            token: 't.jwt', user: { id: '2', name: 'Amharic Teacher 2', role: 'subject_teacher' },
        });
        renderWall();

        const summary = (await screen.findByText('Amharic')).closest('.MuiAccordionSummary-root');
        fireEvent.click(summary);

        const cards = await screen.findAllByTestId('subject-seat-card');
        fireEvent.click(cards[1]); // Teacher 2

        expect(await screen.findByText('Sign in as Teacher 2')).toBeInTheDocument();
        fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'amh2pass' } });
        fireEvent.click(screen.getByRole('button', { name: /^Sign in$/ }));

        await waitFor(() =>
            expect(authApi.subjectTeacherLogin).toHaveBeenCalledWith('2', 'amh2pass'));
        await waitFor(() =>
            expect(mockNavigate).toHaveBeenCalledWith('/subject-home', { replace: true }));
    });

    test('a wrong password keeps the dialog open with the server message', async () => {
        authApi.subjectTeachers.mockResolvedValue([{ id: '1', name: 'ICT Teacher 1' }]);
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
