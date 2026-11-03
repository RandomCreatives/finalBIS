import { readClassLogin } from '../data/classes';

const ROLE_LABELS = {
    admin: 'Administrator',
    main_teacher: 'Main Teacher',
    assistant_teacher: 'Assistant Teacher',
    subject_teacher: 'Subject Teacher',
    librarian: 'Librarian',
    nurse: 'Nurse',
    store_manager: 'Store Manager',
};

export const roleLabel = (role) =>
    Object.prototype.hasOwnProperty.call(ROLE_LABELS, role) ? ROLE_LABELS[role] : 'Staff';

/** Login surface that matches each Telegram-linked role. */
export function loginPathForRole(role) {
    if (role === 'main_teacher') return '/pwa-main-teacher-login';
    if (role === 'subject_teacher') return '/subject-login';
    if (role === 'librarian') return '/librarian-login';
    if (role === 'nurse') return '/nurse-login';
    return '/login';
}

/**
 * Choose the destination for an already-authenticated web-portal user.
 * Main teachers with a matching class-card session return to that class;
 * subject teachers and specialist staff use their role-specific workspaces.
 */
export function dashboardPathForUser(user) {
    if (!user) return '/';
    if (user.role === 'subject_teacher') return '/subject-home';
    if (user.role === 'main_teacher') {
        const classSession = readClassLogin();
        const belongsToUser = !classSession?.userId || !user.id || classSession.userId === user.id;
        if (classSession?.slug && classSession?.classId && belongsToUser) {
            return `/class-home/${encodeURIComponent(classSession.slug)}`;
        }
        return '/app';
    }
    if (user.role === 'librarian') return '/app/library';
    if (user.role === 'nurse') return '/app/clinic';
    if (user.role === 'store_manager') return '/app/store';
    return '/app';
}

/** Keep role-entry `next` targets on this site and reject protocol-relative URLs. */
export function safeNextPath(value) {
    if (typeof value !== 'string' || !value.startsWith('/') || value.startsWith('//') || value.includes('\\')) {
        return null;
    }
    if ([...value].some((character) => character.charCodeAt(0) < 0x20 || character.charCodeAt(0) === 0x7f)) return null;
    return value;
}

/** Read a same-origin return path from either a router location or our entry link. */
export function requestedPathFromState(state) {
    const from = state?.from;
    if (typeof from === 'string') return safeNextPath(from);
    if (!from || typeof from !== 'object') return null;
    const path = from.path || from.pathname;
    if (typeof path !== 'string') return null;
    return safeNextPath(`${path}${from.search || ''}${from.hash || ''}`);
}
