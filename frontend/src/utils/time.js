/*
 * Small human-time helpers shared by the staff screens.
 * Always on the school's clock (Addis Ababa, GMT+3).
 */
import { formatDate, formatDateTime, formatTime, schoolToday } from './schoolTime';

/**
 * Turn a last-login timestamp into words an admin can scan.
 * Returns { text, tone } with tone 'fresh' | 'stale' | 'never' — 'stale'
 * means the account went quiet for 3+ days, matching the dashboard's
 * sign-in activity card.
 */
export const signInMeta = (iso, now = new Date()) => {
    if (!iso) return { text: 'Never', tone: 'never', title: 'This account has never signed in' };

    const then = new Date(iso);
    if (Number.isNaN(then.getTime())) {
        return { text: String(iso), tone: 'stale', title: String(iso) };
    }

    const title = formatDateTime(then, {
        weekday: 'short', day: 'numeric', month: 'short', year: 'numeric',
        hour: '2-digit', minute: '2-digit',
    });

    // Calendar days between the two, as the school's calendar counts them.
    const dayOf = (d) => Date.parse(`${schoolToday(d)}T00:00:00Z`);
    const dayDiff = Math.round((dayOf(now) - dayOf(then)) / 86400000);

    if (dayDiff <= 0) {
        return {
            text: `Today ${formatTime(then)}`,
            tone: 'fresh',
            title,
        };
    }
    if (dayDiff === 1) return { text: 'Yesterday', tone: 'fresh', title };
    if (dayDiff < 7) {
        return { text: `${dayDiff} days ago`, tone: dayDiff >= 3 ? 'stale' : 'fresh', title };
    }
    return {
        text: formatDate(then, { day: 'numeric', month: 'short', year: 'numeric' }),
        tone: 'stale',
        title,
    };
};
