export const API_BASE = import.meta.env.VITE_API_URL || '';

type Method = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

async function request(path: string, method: Method = 'GET', body?: unknown) {
    const token = localStorage.getItem('tma_token');
    const headers: Record<string, string> = {
        'Content-Type': 'application/json',
    };
    if (token) headers['Authorization'] = `Bearer ${token}`;
    const res = await fetch(`${API_BASE}/api${path}`, { method, headers, body: body ? JSON.stringify(body) : undefined });
    if (!res.ok) {
        const text = await res.text().catch(() => '');
        throw new Error(text || `Request failed ${res.status}`);
    }
    if (res.status === 204) return null as any;
    return res.json();
}

export const api = {
    get: (path: string) => request(path, 'GET'),
    post: (path: string, body: unknown) => request(path, 'POST', body),
    put: (path: string, body: unknown) => request(path, 'PUT', body),
    patch: (path: string, body: unknown) => request(path, 'PATCH', body),
    del: (path: string) => request(path, 'DELETE'),
};
