import '@testing-library/jest-dom';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { ThemeProvider } from '../theme';
import Notices from '../pages/Notices';
import { noticeApi } from '../api/endpoints';
import { useAuth } from '../auth/AuthContext';

jest.mock('../auth/AuthContext', () => ({
    useAuth: jest.fn(),
}));

jest.mock('../api/endpoints', () => ({
    noticeApi: {
        list: jest.fn(),
        markRead: jest.fn(),
        receipts: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        remove: jest.fn(),
    },
}));

const NOTICES = [
    // n1 is pinned, demands acknowledgement, and nobody has read it yet.
    {
        id: 'n1', title: 'Assembly moves to Friday', body: 'Morning assembly moves this week.',
        audience: 'main_teacher', requiresAck: true, isPinned: true, postedOn: '2026-09-20',
        author: { id: 'u-admin', name: 'Mr. Mike' },
        readAt: null, acknowledgedAt: null,
        stats: { readCount: 3, ackCount: 1, audienceSize: 12 },
    },
    // n2 is a plain announcement already read.
    {
        id: 'n2', title: 'Staffroom tea rota', body: 'The new rota is on the board.',
        audience: 'all', requiresAck: false, isPinned: false, postedOn: '2026-09-19',
        author: { id: 'u-admin', name: 'Mr. Mike' },
        readAt: '2026-09-19T10:00:00.000Z', acknowledgedAt: null,
        stats: { readCount: 12, ackCount: 0, audienceSize: 12 },
    },
];

const renderPage = () =>
    render(
        <ThemeProvider>
            <BrowserRouter>
                <Notices />
            </BrowserRouter>
        </ThemeProvider>,
    );

beforeEach(() => {
    jest.clearAllMocks();
    noticeApi.list.mockResolvedValue(NOTICES);
    noticeApi.markRead.mockResolvedValue({ readAt: '2026-09-21T08:00:00.000Z', acknowledgedAt: null });
    noticeApi.create.mockResolvedValue({});
});

describe('Notices page (revived module)', () => {
    test('a teacher sees the board, and unread notices mark themselves read', async () => {
        useAuth.mockReturnValue({
            user: { id: 't1', name: 'Meron', role: 'main_teacher' }, isAdmin: false,
        });
        renderPage();

        expect(await screen.findByText('Assembly moves to Friday')).toBeInTheDocument();
        expect(screen.getByText('Staffroom tea rota')).toBeInTheDocument();

        // The unread one (n1) quietly records a read; the already-read one (n2) does not.
        await waitFor(() =>
            expect(noticeApi.markRead).toHaveBeenCalledWith('n1', false));
        expect(noticeApi.markRead).not.toHaveBeenCalledWith('n2', false);
        // The n1 announcement came from a main teacher, so the audience chip shows.
        expect(screen.getByText('Main teachers')).toBeInTheDocument();
    });

    test('acknowledging a flagged notice records the acknowledgement', async () => {
        useAuth.mockReturnValue({
            user: { id: 't1', name: 'Meron', role: 'main_teacher' }, isAdmin: false,
        });
        renderPage();

        fireEvent.click(await screen.findByRole('button', { name: 'Acknowledge' }));

        await waitFor(() =>
            expect(noticeApi.markRead).toHaveBeenCalledWith('n1', true));
    });

    test('a subject teacher reads but cannot post', async () => {
        useAuth.mockReturnValue({
            user: { id: 't2', name: 'Dawit', role: 'subject_teacher' }, isAdmin: false,
        });
        renderPage();

        expect(await screen.findByText('Assembly moves to Friday')).toBeInTheDocument();
        expect(screen.queryByRole('button', { name: /post notice/i })).not.toBeInTheDocument();
    });

    test('an admin sees reach figures and can post a notice', async () => {
        useAuth.mockReturnValue({
            user: { id: 'a1', name: 'Mr. Mike', role: 'admin' }, isAdmin: true,
        });
        renderPage();

        // Reach visible at a glance: who has read, who has acknowledged.
        expect(await screen.findByText(/Read by 3 of 12/)).toBeInTheDocument();
        expect(screen.getByText(/1 acknowledged/)).toBeInTheDocument();

        fireEvent.click(screen.getByRole('button', { name: /post notice/i }));
        fireEvent.change(await screen.findByLabelText(/title/i), {
            target: { value: 'Parents meeting on Friday' },
        });
        fireEvent.change(screen.getByLabelText(/message/i), {
            target: { value: 'All teachers please prepare progress notes.' },
        });
        fireEvent.click(screen.getByRole('button', { name: 'Save' }));

        await waitFor(() => expect(noticeApi.create).toHaveBeenCalledWith({
            title: 'Parents meeting on Friday',
            body: 'All teachers please prepare progress notes.',
            audience: 'all',
            requiresAck: false,
            isPinned: false,
        }));
    });
});
