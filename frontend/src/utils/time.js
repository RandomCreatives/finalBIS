/*
 * Small human-time helpers shared by the staff screens.
 */

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

    const title = then.toLocaleString('en-GB', {
        weekday: 'short', day: 'numeric', month: 'short', year: 'numeric',
        hour: '2-digit', minute: '2-digit',
    });

    const startOfDay = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
    const dayDiff = Math.round((startOfDay(now) - startOfDay(then)) / 86400000);

    if (dayDiff <= 0) {
        return {
            text: `Today ${then.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}`,
            tone: 'fresh',
            title,
        };
    }
    if (dayDiff === 1) return { text: 'Yesterday', tone: 'fresh', title };
    if (dayDiff < 7) {
        return { text: `${dayDiff} days ago`, tone: dayDiff >= 3 ? 'stale' : 'fresh', title };
    }
    return {
        text: then.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }),
        tone: 'stale',
        title,
    };
};
