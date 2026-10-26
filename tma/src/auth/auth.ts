/**
 * Telegram Mini App glue.
 *
 * Telegram exposes the SDK on `window.Telegram.WebApp` (the older
 * `window.TelegramWebApp` alias does not exist). Without the script from
 * https://telegram.org/js/telegram-web-app.js — loaded in index.html — none of
 * this is available and the app must fall back to a clear error rather than
 * crashing.
 */

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
    user: StaffUser;
    linked?: boolean;
}

/** Shape returned by the API's `publicUser` serializer (camelCase). */
export interface StaffUser {
    id: string;
    name: string;
    email: string;
    phone?: string | null;
    role: string;
    schoolId?: string;
    isActive?: boolean;
    telegramId?: string | null;
    telegramUsername?: string | null;
}

export interface SubjectTeacherOption {
    id: string;
    name: string;
    subjects: { code: string; name: string; seats: number }[];
}

export interface LinkTelegramPayload {
    email?: string;
    password?: string;
    classPassword?: string;
    teacherId?: string;
}

export class TelegramAuthError extends Error {
    status: number;
    code?: string;
    details?: { telegramId?: string; username?: string | null };

    constructor(
        message: string,
        status: number,
        code?: string,
        details?: { telegramId?: string; username?: string | null },
    ) {
        super(message);
        this.name = 'TelegramAuthError';
        this.status = status;
        this.code = code;
        this.details = details;
    }
}

interface TelegramWebApp {
    initData: string;
    initDataUnsafe?: { user?: TelegramUser };
    themeParams?: Record<string, string>;
    colorScheme?: 'light' | 'dark';
    ready: () => void;
    expand: () => void;
    close?: () => void;
    disableVerticalSwipes?: () => void;
    setHeaderColor?: (color: string) => void;
    setBackgroundColor?: (color: string) => void;
    onEvent?: (eventType: string, handler: () => void) => void;
    offEvent?: (eventType: string, handler: () => void) => void;
}

declare global {
    interface Window {
        Telegram?: {
            WebApp?: TelegramWebApp;
        };
    }
}

const TOKEN_KEY = 'tma_token';

/** The Telegram Web App instance, or null when opened outside Telegram. */
export function getWebApp(): TelegramWebApp | null {
    return window.Telegram?.WebApp ?? null;
}

export function isTelegramEnvironment(): boolean {
    return Boolean(getWebApp()?.initData);
}

/** Whether Telegram (or system browser outside Telegram) is rendering in dark mode. */
export function isDarkColorScheme(): boolean {
    const webApp = getWebApp();
    if (webApp?.colorScheme === 'dark') return true;
    if (webApp?.colorScheme === 'light' && webApp.initData) return false;
    const bg = webApp?.themeParams?.bg_color;
    if (bg && /^#[0-9a-fA-F]{6}$/.test(bg)) {
        const r = parseInt(bg.slice(1, 3), 16);
        const g = parseInt(bg.slice(3, 5), 16);
        const b = parseInt(bg.slice(5, 7), 16);
        // Perceived luminance < 128 indicates a dark surface.
        return (r * 299 + g * 587 + b * 114) / 1000 < 128;
    }
    if (typeof window !== 'undefined' && window.matchMedia) {
        return window.matchMedia('(prefers-color-scheme: dark)').matches;
    }
    return false;
}

let initialized = false;

/** Tell Telegram the app is ready and expand it to full height. Idempotent. */
export function initTelegram(): void {
    if (initialized) return;
    initialized = true;

    const webApp = getWebApp();
    if (!webApp) {
        console.warn('[tma] Telegram WebApp SDK not available — open this page from the Telegram bot.');
        return;
    }

    try {
        webApp.ready();
        webApp.expand();
        webApp.disableVerticalSwipes?.();
        if (webApp.colorScheme === 'dark') {
            webApp.setHeaderColor?.('#0f172a');
            webApp.setBackgroundColor?.('#0f172a');
        }
    } catch (err) {
        console.warn('[tma] Telegram initialization failed:', err);
    }
}

export function telegramUser(): TelegramUser | null {
    return getWebApp()?.initDataUnsafe?.user ?? null;
}

/** The signed launch payload — send this to the backend to authenticate. */
export function initData(): string | null {
    const value = getWebApp()?.initData;
    return value ? value : null;
}

export function themeColor(key: string, fallback: string): string {
    return getWebApp()?.themeParams?.[key] ?? fallback;
}

const apiBase = () => (import.meta.env.VITE_API_URL || '').replace(/\/$/, '');

async function parseAuthResponse(res: Response, fallbackMsg: string): Promise<AuthResponse> {
    if (!res.ok) {
        let message = fallbackMsg;
        let code: string | undefined;
        let details: { telegramId?: string; username?: string | null } | undefined;
        try {
            const body = await res.json();
            if (body?.message) message = body.message;
            code = body?.code;
            details = body?.details;
        } catch {
            /* non-JSON error body — keep the generic message */
        }
        throw new TelegramAuthError(message, res.status, code, details);
    }
    return res.json();
}

/** Exchange Telegram's signed initData for one of our JWT sessions. */
export async function signInWithTelegram(): Promise<AuthResponse> {
    const data = initData();
    if (!data) {
        throw new TelegramAuthError(
            'Telegram sign-in data is not available. Open this app from the BIS NOC Telegram bot.',
            400,
        );
    }

    const res = await fetch(`${apiBase()}/api/auth/telegram-webapp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ init_data: data }),
    });

    return parseAuthResponse(res, 'Telegram sign-in failed. Please try again.');
}

/**
 * Authenticate once with BIS NOC credentials inside the Mini App and bind the
 * verified Telegram account (`initData`) to that staff account in one step.
 */
export async function linkAndSignInWithTelegram(payload: LinkTelegramPayload): Promise<AuthResponse> {
    const data = initData();
    if (!data) {
        throw new TelegramAuthError(
            'Telegram sign-in data is not available. Reopen this app from the BIS NOC Telegram bot.',
            400,
        );
    }

    const res = await fetch(`${apiBase()}/api/auth/telegram-webapp/link`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ init_data: data, ...payload }),
    });

    return parseAuthResponse(res, 'Could not link your BIS NOC account. Check your credentials and try again.');
}

/** Load active subject teachers for the Subject Teacher sign-in picker. */
export async function fetchSubjectTeachers(): Promise<SubjectTeacherOption[]> {
    const res = await fetch(`${apiBase()}/api/auth/subject-teachers`);
    if (!res.ok) return [];
    const data = await res.json();
    return Array.isArray(data?.teachers) ? data.teachers : [];
}

export function setToken(token: string): void {
    localStorage.setItem(TOKEN_KEY, token);
}

export function getToken(): string | null {
    return localStorage.getItem(TOKEN_KEY);
}

export function clearToken(): void {
    localStorage.removeItem(TOKEN_KEY);
}

/** Sign out locally, then close the Mini App when running inside Telegram. */
export function logout(): void {
    clearToken();
    getWebApp()?.close?.();
}
