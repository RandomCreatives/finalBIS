import '@testing-library/jest-dom';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { ThemeProvider } from '../theme';
import Planning from '../pages/Planning';
import { planningApi, termApi, assignmentApi } from '../api/endpoints';
import { useAuth } from '../auth/AuthContext';

jest.mock('../auth/AuthContext', () => ({ useAuth: jest.fn() }));

jest.mock('../api/endpoints', () => ({
    planningApi: {
        schemes: jest.fn(),
        scheme: jest.fn(),
        createScheme: jest.fn(),
        updateScheme: jest.fn(),
        saveSchemeWeek: jest.fn(),
        lessonPlans: jest.fn(),
        saveLessonPlan: jest.fn(),
        deleteLessonPlan: jest.fn(),
        submit: jest.fn(),
        review: jest.fn(),
        overview: jest.fn(),
    },
    termApi: { current: jest.fn() },
    assignmentApi: { subjects: jest.fn() },
}));

const OVERVIEW = {
    termId: 't1',
    term: { id: 't1', name: 'Term 1', weekCount: 11, currentWeek: 3 },
    rows: [
        {
            classSubjectId: 'cs2', teacher: { id: 'u-sub', name: 'Dawit Haile' },
            subject: { id: 's-mat', name: 'Mathematics' }, class: { id: 'c1', name: 'Year 3 - Green' },
            schemeId: 'sch2', schemeStatus: 'submitted', lessonPlanCount: 3, approvedPlans: 0,
            submittedWeeks: [1, 2, 3], missingWeeks: [], expectedWeeks: 11,
        },
        {
            classSubjectId: 'cs1', teacher: { id: 'u-main', name: 'Meron Abebe' },
            subject: { id: 's-eng', name: 'English' }, class: { id: 'c1', name: 'Year 3 - Green' },
            schemeId: 'sch1', schemeStatus: 'approved', lessonPlanCount: 2, approvedPlans: 2,
            submittedWeeks: [1, 2], missingWeeks: [3], expectedWeeks: 11,
        },
    ],
    awaiting: [
        {
            kind: 'schemes', id: 'sch2', classSubjectId: 'cs2', status: 'submitted',
            author: { id: 'u-sub', name: 'Dawit Haile' },
            class: { id: 'c1', name: 'Year 3 - Green' }, subject: { id: 's-mat', name: 'Mathematics' },
            submittedAt: '2026-09-19T08:00:00.000Z', title: 'Mathematics — Term 1',
        },
        {
            kind: 'lesson-plans', id: 'lp1', classSubjectId: 'cs1', status: 'submitted',
            author: { id: 'u-main', name: 'Meron Abebe' },
            class: { id: 'c1', name: 'Year 3 - Green' }, subject: { id: 's-eng', name: 'English' },
            submittedAt: '2026-09-20T08:00:00.000Z', weekNumber: 3, topic: 'Persuasive writing',
            objectives: 'Write a persuasive paragraph',
            activities: null, resources: null, homework: null, reflection: null,
        },
    ],
    summary: {
        assignments: 2, schemesMissing: 0, awaitingReview: 2, schemesApproved: 1, lateTeachers: 1,
    },
};

const renderPage = () =>
    render(
        <ThemeProvider>
            <BrowserRouter>
                <Planning />
            </BrowserRouter>
        </ThemeProvider>,
    );

const asAdmin = () =>
    useAuth.mockReturnValue({ user: { id: 'u-admin', role: 'admin', name: 'Admin' }, isAdmin: true });

beforeEach(() => {
    jest.clearAllMocks();
    termApi.current.mockResolvedValue({
        term: { id: 't1', name: 'Term 1', weekCount: 11, startsOn: '2026-09-07', endsOn: '2026-11-17' },
        currentWeek: 3,
    });
    planningApi.schemes.mockResolvedValue([]);
    planningApi.lessonPlans.mockResolvedValue([]);
    planningApi.overview.mockResolvedValue(OVERVIEW);
    assignmentApi.subjects.mockResolvedValue({ academicYearId: 'y1', assignments: [] });
});

describe('Planning — admin approval hub', () => {
    test('the admin gets two tabs with the waiting inbox first', async () => {
        asAdmin();
        renderPage();

        const tabs = await screen.findAllByRole('tab');
        expect(tabs[0].textContent).toBe('Waiting for approval (2)');
        expect(tabs[1].textContent).toBe('Teacher progress');

        // Inbox shows both documents, typed and attributed.
        expect(await screen.findByText('Mathematics — Term 1')).toBeInTheDocument();
        expect(screen.getByText('Persuasive writing')).toBeInTheDocument();
        expect(screen.getByText('Scheme of work')).toBeInTheDocument();
        expect(screen.getByText('Week 3 plan')).toBeInTheDocument();
        expect(screen.getAllByRole('button', { name: 'Approve' })).toHaveLength(2);

        // Admins review; they do not author here.
        expect(screen.queryByText('My schemes of work')).not.toBeInTheDocument();
    });

    test('approving from the inbox approves that document', async () => {
        asAdmin();
        renderPage();

        const [approveScheme] = await screen.findAllByRole('button', { name: 'Approve' });
        fireEvent.click(approveScheme);

        // The scheme is the oldest submission, so it sits on the first row.
        await waitFor(() =>
            expect(planningApi.review).toHaveBeenCalledWith('schemes', 'sch2', 'approved', null));
    });

    test('reading a weekly plan shows its content before deciding', async () => {
        asAdmin();
        renderPage();

        const readButtons = await screen.findAllByRole('button', { name: 'Read' });
        fireEvent.click(readButtons[1]);

        expect(await screen.findByText('Week 3 lesson plan')).toBeInTheDocument();
        expect(screen.getByText('Write a persuasive paragraph')).toBeInTheDocument();
        // The API is not hit again — the inbox payload already carries the content.
        expect(planningApi.scheme).not.toHaveBeenCalled();
    });

    test('teacher progress flags whoever is behind this week', async () => {
        asAdmin();
        renderPage();

        fireEvent.click(await screen.findByRole('tab', { name: /teacher progress/i }));

        expect(await screen.findByText('Missing week 3')).toBeInTheDocument();
        expect(screen.getByText('Up to date')).toBeInTheDocument();

        // The late teacher is sorted to the first table row.
        const rows = screen.getAllByRole('row');
        expect(rows[1].textContent).toContain('Meron Abebe');
        expect(rows[2].textContent).toContain('Dawit Haile');
    });

    test('a teacher keeps the authoring workspace with no tabs', async () => {
        useAuth.mockReturnValue({ user: { id: 'u-sub', role: 'subject_teacher', name: 'Dawit' } });
        renderPage();

        expect(await screen.findByText('My schemes of work')).toBeInTheDocument();
        expect(screen.getByText('My lesson plans')).toBeInTheDocument();
        expect(screen.queryAllByRole('tab')).toHaveLength(0);
    });

    test('a main teacher authors too — the staff tracker is gone', async () => {
        useAuth.mockReturnValue({ user: { id: 'u-main', role: 'main_teacher', name: 'Meron' } });
        renderPage();

        expect(await screen.findByText('My schemes of work')).toBeInTheDocument();
        expect(screen.queryAllByRole('tab')).toHaveLength(0);
        expect(screen.queryByText('Staff overview')).not.toBeInTheDocument();
        expect(screen.queryByText('Teacher progress')).not.toBeInTheDocument();
    });
});
