import { getToken } from '../auth/auth';

// In production the Mini App is served from the same origin as the API, so a
// relative URL is correct. VITE_API_URL is only needed when the API lives on
// another host (e.g. a standalone backend during development).
export const API_BASE = (import.meta.env.VITE_API_URL || '').replace(/\/$/, '');

type Method = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

export class ApiError extends Error {
    status: number;
    /** Machine-readable outcome from the API (e.g. TELEGRAM_NOT_LINKED). */
    code?: string;
    details?: unknown;

    constructor(message: string, status: number, code?: string, details?: unknown) {
        super(message);
        this.name = 'ApiError';
        this.status = status;
        this.code = code;
        this.details = details;
    }
}

async function request(path: string, method: Method = 'GET', body?: unknown) {
    const token = getToken();
    if (
        import.meta.env.DEV &&
        (token === '__dev_preview_main__' || token === '__dev_preview_subject__')
    ) {
        const { handleDevPreviewRequest } = await import('../dev/previewMock');
        return handleDevPreviewRequest(token, path, method, body);
    }

    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (token) headers.Authorization = `Bearer ${token}`;

    const res = await fetch(`${API_BASE}/api${path}`, {
        method,
        headers,
        body: body === undefined ? undefined : JSON.stringify(body),
    });

    if (!res.ok) {
        let message = `Request failed (${res.status})`;
        let code: string | undefined;
        let details: unknown;
        try {
            const payload = await res.json();
            if (payload?.message) message = payload.message;
            code = payload?.code;
            details = payload?.details;
        } catch {
            /* keep the status-based message */
        }
        throw new ApiError(message, res.status, code, details);
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
