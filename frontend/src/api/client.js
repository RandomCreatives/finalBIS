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
            if (window.location.pathname !== '/login') {
                window.location.replace('/login?expired=1');
            }
        }

        const message =
            error.response?.data?.message ||
            error.message ||
            'Something went wrong. Please try again.';

        return Promise.reject(Object.assign(new Error(message), { status: error.response?.status }));
    }
);

export default client;
