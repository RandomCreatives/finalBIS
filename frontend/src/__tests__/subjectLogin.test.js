import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { MemoryRouter } from 'react-router-dom';
import { ThemeProvider } from '../theme';
import SubjectLogin, { yearBands, sectionLabel } from '../pages/SubjectLogin';
import { CLASSES, CLASS_LOGIN_KEY } from '../data/classes';

const renderWall = (route = '/class-home/:slug') =>
    render(
        <ThemeProvider>
            <MemoryRouter initialEntries={['/teacher-login']}>
                <SubjectLogin />
            </MemoryRouter>
        </ThemeProvider>,
    );

beforeEach(() => {
    localStorage.clear();
    jest.restoreAllMocks();
});

describe('yearBands', () => {
    test('groups the roster into ascending year bands', () => {
        const bands = yearBands(CLASSES);
        expect(bands.map((b) => b.year)).toEqual([3, 4]);
        expect(bands[0].classes).toHaveLength(4);
        expect(bands[1].classes).toHaveLength(10);
    });

    test('sectionLabel renders the year heading', () => {
        expect(sectionLabel(3)).toBe('Year 3');
        expect(sectionLabel(4)).toBe('Year 4');
    });
});

describe('SubjectLogin wall — class cards', () => {
    test('renders both year bands and one card per class', () => {
        renderWall();
        expect(screen.getByText('Year 3')).toBeInTheDocument();
        expect(screen.getByText('Year 4')).toBeInTheDocument();
        expect(screen.getAllByTestId('class-card')).toHaveLength(CLASSES.length);
        expect(screen.getByText('Year 3 - Blue')).toBeInTheDocument();
        expect(screen.getByText('Year 4 - Orange')).toBeInTheDocument();
    });

    test('cards show the class team and a sign-in action', () => {
        renderWall();
        expect(screen.getAllByText('Ms. Yeabsira A.').length).toBeGreaterThan(0);
        expect(screen.getAllByRole('button', { name: /Class Sign-In/i })).toHaveLength(CLASSES.length);
    });

    test('no generic email sign-in — subject teachers go to their own wall instead', () => {
        renderWall();
        expect(screen.queryByRole('link', { name: /staff email sign-in|sign in with your staff email/i }))
            .toBeNull();
        const subjectLink = screen.getByRole('link', { name: /sign in with your teacher card/i });
        expect(subjectLink).toHaveAttribute('href', '/subject-login');
    });

    test('tapping a card opens the shared class password dialog', () => {
        renderWall();
        const [firstCard] = screen.getAllByTestId('class-card');
        fireEvent.click(firstCard.closest('div').querySelector('button'));
        expect(screen.getByText(/Welcome, Ms. Yeabsira A./)).toBeInTheDocument();
        expect(screen.getByLabelText(/Class password/i)).toBeInTheDocument();
    });

    test('submitting the class password calls class-login and stores the session', async () => {
        const payload = {
            token: 'jwt-token',
            user: { id: 'u1', name: 'Ms. Yeabsira A.' },
            class: { id: 'c1', name: 'Year 3 - Blue' },
        };
        const fetchMock = jest.fn().mockResolvedValue({
            ok: true,
            json: () => Promise.resolve(payload),
        });
        global.fetch = fetchMock;

        renderWall();
        const [firstCard] = screen.getAllByTestId('class-card');
        fireEvent.click(firstCard.closest('div').querySelector('button'));

        fireEvent.change(screen.getByLabelText(/Class password/i), {
            target: { value: 'year 3 blue' },
        });
        fireEvent.click(screen.getByRole('button', { name: /^Sign In$/i }));

        await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
        const [url, init] = fetchMock.mock.calls[0];
        expect(url).toMatch(/\/api\/auth\/class-login$/);
        expect(JSON.parse(init.body)).toEqual({ className: 'Year 3 - Blue', password: 'year 3 blue' });

        await waitFor(() => {
            const saved = JSON.parse(localStorage.getItem(CLASS_LOGIN_KEY));
            expect(saved).toMatchObject({ slug: 'year-3-blue', className: 'Year 3 - Blue', classId: 'c1' });
        });
    });

    test('shows the API error on a wrong password', async () => {
        global.fetch = jest.fn().mockResolvedValue({
            ok: false,
            json: () => Promise.resolve({ message: 'Wrong class password' }),
        });

        renderWall();
        const [firstCard] = screen.getAllByTestId('class-card');
        fireEvent.click(firstCard.closest('div').querySelector('button'));
        fireEvent.change(screen.getByLabelText(/Class password/i), { target: { value: 'nope' } });
        fireEvent.click(screen.getByRole('button', { name: /^Sign In$/i }));

        expect(await screen.findByText('Wrong class password')).toBeInTheDocument();
    });
});
