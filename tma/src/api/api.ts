import { getToken, resolveApiBase } from '../auth/auth';
import { emitSyncEvent, topicsForMutation } from '../utils/syncEvents';

// In production the Mini App is served from the same origin as the API, so a
// relative URL is correct. VITE_API_URL is only needed when the API lives on
// another host (e.g. a standalone backend during development).
export const API_BASE = resolveApiBase();

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

function publishMutation(method: Method, path: string) {
    if (method === 'GET') return;
    const topics = topicsForMutation(path);
    if (topics.length > 0) emitSyncEvent(topics);
}

async function request(path: string, method: Method = 'GET', body?: unknown) {
    const token = getToken();
    if (
        import.meta.env.DEV &&
        (token === '__dev_preview_main__' || token === '__dev_preview_subject__')
    ) {
        const { handleDevPreviewRequest } = await import('../dev/previewMock');
        const result = await handleDevPreviewRequest(token, path, method, body);
        publishMutation(method, path);
        return result;
    }

    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (token) headers.Authorization = `Bearer ${token}`;

    const res = await fetch(`${API_BASE}/api${path}`, {
        method,
        headers,
        cache: method === 'GET' ? 'no-store' : undefined,
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

    if (res.status === 204) {
        publishMutation(method, path);
        return null;
    }
    const payload = await res.json();
    publishMutation(method, path);
    return payload;
}

export const api = {
    get: (path: string) => request(path, 'GET'),
    post: (path: string, body: unknown) => request(path, 'POST', body),
    put: (path: string, body: unknown) => request(path, 'PUT', body),
    patch: (path: string, body: unknown) => request(path, 'PATCH', body),
    del: (path: string) => request(path, 'DELETE'),
};
