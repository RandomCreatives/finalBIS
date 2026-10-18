export interface TelegramUser {
    id: number;
    first_name: string;
    last_name?: string;
    username?: string;
    language_code?: string;
    is_premium?: boolean;
    photo_url?: string;
}

export interface AuthResponse {
    token: string;
    user: {
        id: string;
        name: string;
        email: string;
        role: string;
        school_id: string;
    };
}

let initialized = false;

export function initTelegram() {
    if (initialized) return;
    const webApp = (window as any).TelegramWebApp;
    if (webApp) {
        webApp.ready();
        webApp.expand();
        webApp.disableVerticalSwipes();
    }
    initialized = true;
}

export function telegramUser(): TelegramUser | null {
    const webApp = (window as any).TelegramWebApp;
    return webApp?.initDataUnsafe?.user ?? null;
}

export function initData(): string | null {
    const webApp = (window as any).TelegramWebApp;
    return webApp?.initData ?? null;
}

export function themeColor(key: string, fallback: string) {
    const webApp = (window as any).TelegramWebApp;
    return webApp?.themeParams?.[key] ?? fallback;
}

export async function signInWithTelegram(): Promise<AuthResponse> {
    const data = initData();
    if (!data) throw new Error('Telegram initData not available');
    const res = await fetch(`${import.meta.env.VITE_API_URL || ''}/api/auth/telegram-webapp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ init_data: data }),
    });
    if (!res.ok) {
        const text = await res.text().catch(() => '');
        throw new Error(text || 'Telegram sign-in failed');
    }
    return res.json();
}

export function setToken(token: string) {
    localStorage.setItem('tma_token', token);
}

export function getToken(): string | null {
    return localStorage.getItem('tma_token');
}

export function logout() {
    localStorage.removeItem('tma_token');
    const webApp = (window as any).TelegramWebApp;
    if (webApp?.close) webApp.close();
}
