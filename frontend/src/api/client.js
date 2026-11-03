import axios from 'axios';

const BASE_URL = process.env.REACT_APP_API_URL || '';

export const TOKEN_KEY = 'bisnoc.token';

export const getToken = () => localStorage.getItem(TOKEN_KEY);
export const setToken = (token) => localStorage.setItem(TOKEN_KEY, token);
export const clearToken = () => localStorage.removeItem(TOKEN_KEY);

const client = axios.create({
    baseURL: `${BASE_URL}/api`,
    headers: { 'Content-Type': 'application/json' },
});

/**
 * Attach the bearer token to every request.
 * This is the piece the old code was missing: it defined an interceptor
 * but never imported the instance, so no request was ever authenticated.
 */
client.interceptors.request.use((config) => {
    const token = getToken();
    if (token) {
        config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
});

/**
 * Normalise errors into a plain Error with a usable `.message`, and sign the
 * user out on 401 so an expired session cannot leave the UI half-broken.
 */
client.interceptors.response.use(
    (response) => response,
    (error) => {
        if (error.response?.status === 401 && getToken()) {
            clearToken();
            const pathname = window.location.pathname;
            const signInPaths = new Set([
                '/login', '/pwa-sign-in', '/pwa-main-teacher-login', '/teacher-login',
                '/subject-login', '/librarian-login', '/nurse-login',
            ]);
            const isRoleEntry = pathname.startsWith('/telegram-entry/');
            if (!signInPaths.has(pathname) && !isRoleEntry) {
                const next = `${pathname}${window.location.search || ''}`;
                window.location.replace(`/pwa-sign-in?expired=1&next=${encodeURIComponent(next)}`);
            }
        }

        const message =
            error.response?.data?.message ||
            error.message ||
            'Something went wrong. Please try again.';

        // `code`/`details` let a screen react to a specific outcome (e.g.
        // TELEGRAM_NOT_LINKED) instead of pattern-matching the message.
        return Promise.reject(Object.assign(new Error(message), {
            status: error.response?.status,
            code: error.response?.data?.code,
            details: error.response?.data?.details,
        }));
    }
);

export default client;
