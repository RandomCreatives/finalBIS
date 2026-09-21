import '@testing-library/jest-dom';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { ThemeProvider } from '../theme';
import NotificationBell from '../components/NotificationBell';
import { noticeApi, notificationApi } from '../api/endpoints';
import { useAuth } from '../auth/AuthContext';

jest.mock('../auth/AuthContext', () => ({
    useAuth: jest.fn(),
}));

jest.mock('../api/endpoints', () => ({
    noticeApi: {
        create: jest.fn(),
        markRead: jest.fn(),
    },
    notificationApi: {
        feed: jest.fn(),
        markRead: jest.fn(),
    },
}));

const ADMIN = { id: 'u-admin', name: 'Mr. Mike', role: 'admin' };
const TEACHER = { id: 'u-teacher', name: 'Dawit', role: 'subject_teacher' };

const FEED = {
    notifications: [
        {
            id: 'nudge-1', type: 'nudge', kind: 'plan_reviewed', title: 'Changes requested on your plan',
            body: 'Mr. Mike asked for changes on your weekly lesson plan: add week 5',
            link: '/app/planning', createdAt: '2026-09-22T09:00:00.000Z', readAt: null,
            requiresAck: false, acknowledgedAt: null, isPinned: false, author: null,
        },
        {
            id: 'ann-1', type: 'announcement', title: 'Staff meeting Thursday',
            body: 'After last period in the staffroom.',
            link: null, createdAt: '2026-09-22T07:00:00.000Z', readAt: null,
            requiresAck: true, acknowledgedAt: null, isPinned: false,
            author: { name: 'Mr. Mike' },
        },
    ],
    unreadCount: 2,
};

const renderBell = (user) => {
    useAuth.mockReturnValue({ user });
    return render(
        <ThemeProvider>
            <BrowserRouter>
                <NotificationBell />
            </BrowserRouter>
        </ThemeProvider>,
    );
};

const openBell = async () => {
    fireEvent.click(await screen.findByTestId('notification-bell'));
    return screen.findByTestId('notification-menu');
};

beforeEach(() => {
    jest.clearAllMocks();
    notificationApi.feed.mockResolvedValue(FEED);
    notificationApi.markRead.mockResolvedValue({ readAt: '2026-09-22T10:00:00.000Z' });
    noticeApi.markRead.mockResolvedValue({ readAt: '2026-09-22T10:00:00.000Z', acknowledgedAt: '2026-09-22T10:00:00.000Z' });
    noticeApi.create.mockResolvedValue({ id: 'ann-new' });
});

test('the badge counts unread items and the menu lists them', async () => {
    renderBell(TEACHER);

    await waitFor(() => expect(screen.getByTestId('notification-badge')).toHaveTextContent('2'));

    const menu = await openBell();
    expect(within(menu).getByText('Changes requested on your plan')).toBeInTheDocument();
    expect(within(menu).getByText('Staff meeting Thursday')).toBeInTheDocument();
    // The nudge carries its body; the announcement names its author.
    expect(within(menu).getByText(/add week 5/)).toBeInTheDocument();
    expect(within(menu).getByText(/Mr. Mike · /)).toBeInTheDocument();
});

test('opening a nudge marks it read and the badge drops', async () => {
    renderBell(TEACHER);
    await openBell();

    fireEvent.click(await screen.findByTestId('bell-item-nudge-nudge-1'));

    await waitFor(() => expect(notificationApi.markRead).toHaveBeenCalledWith('nudge-1'));
    await waitFor(() => expect(screen.getByTestId('notification-badge')).toHaveTextContent('1'));
});

test('a must-confirm announcement shows a Got it button that acknowledges', async () => {
    renderBell(TEACHER);
    await openBell();

    const ack = await screen.findByTestId('bell-ack-ann-1');
    fireEvent.click(ack);

    await waitFor(() => expect(noticeApi.markRead).toHaveBeenCalledWith('ann-1', true));
    await waitFor(() => expect(screen.queryByTestId('bell-ack-ann-1')).not.toBeInTheDocument());
});

test('a teacher does not get a compose shortcut; the admin does', async () => {
    notificationApi.feed.mockResolvedValue({ notifications: [], unreadCount: 0 });
    renderBell(TEACHER);
    await openBell();
    expect(screen.queryByTestId('bell-compose-open')).not.toBeInTheDocument();
    expect(screen.getByTestId('bell-empty')).toHaveTextContent(/caught up/);
});

test('an admin can push an announcement straight from the bell', async () => {
    renderBell(ADMIN);
    await openBell();

    fireEvent.click(screen.getByTestId('bell-compose-open'));

    const dialog = await screen.findByTestId('bell-compose');
    fireEvent.change(within(dialog).getByTestId('bell-compose-title').querySelector('input'), {
        target: { value: 'Early close Friday' },
    });
    fireEvent.change(within(dialog).getByTestId('bell-compose-body').querySelector('textarea'), {
        target: { value: 'School closes at noon for the holiday.' },
    });
    // The must-confirm switch on.
    fireEvent.click(within(dialog).getByRole('checkbox'));

    fireEvent.click(within(dialog).getByTestId('bell-compose-send'));

    await waitFor(() => expect(noticeApi.create).toHaveBeenCalledWith({
        title: 'Early close Friday',
        body: 'School closes at noon for the holiday.',
        requiresAck: true,
    }));
    await waitFor(() => expect(screen.queryByTestId('bell-compose')).not.toBeInTheDocument());
});
