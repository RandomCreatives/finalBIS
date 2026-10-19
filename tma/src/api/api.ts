import { getToken } from '../auth/auth';

// In production the Mini App is served from the same origin as the API, so a
// relative URL is correct. VITE_API_URL is only needed when the API lives on
// another host (e.g. a standalone backend during development).
export const API_BASE = (import.meta.env.VITE_API_URL || '').replace(/\/$/, '');

type Method = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

export class ApiError extends Error {
    status: number;

    constructor(message: string, status: number) {
        super(message);
        this.name = 'ApiError';
        this.status = status;
    }
}

async function request(path: string, method: Method = 'GET', body?: unknown) {
    const token = getToken();
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (token) headers.Authorization = `Bearer ${token}`;

    const res = await fetch(`${API_BASE}/api${path}`, {
        method,
        headers,
        body: body === undefined ? undefined : JSON.stringify(body),
    });

    if (!res.ok) {
        let message = `Request failed (${res.status})`;
        try {
            const payload = await res.json();
            if (payload?.message) message = payload.message;
        } catch {
            /* keep the status-based message */
        }
        throw new ApiError(message, res.status);
    }

    if (res.status === 204) return null;
    return res.json();
}

export const api = {
    get: (path: string) => request(path, 'GET'),
    post: (path: string, body: unknown) => request(path, 'POST', body),
    put: (path: string, body: unknown) => request(path, 'PUT', body),
    patch: (path: string, body: unknown) => request(path, 'PATCH', body),
    del: (path: string) => request(path, 'DELETE'),
};
