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
            webApp.setHeaderColor?.('#16171d');
            webApp.setBackgroundColor?.('#16171d');
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

/** Exchange Telegram's signed initData for one of our JWT sessions. */
export async function signInWithTelegram(): Promise<AuthResponse> {
    const data = initData();
    if (!data) {
        throw new Error(
            'Telegram sign-in data is not available. Open this app from the BIS NOC Telegram bot.',
        );
    }

    const base = (import.meta.env.VITE_API_URL || '').replace(/\/$/, '');
    const res = await fetch(`${base}/api/auth/telegram-webapp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ init_data: data }),
    });

    if (!res.ok) {
        let message = 'Telegram sign-in failed. Please try again.';
        try {
            const body = await res.json();
            if (body?.message) message = body.message;
        } catch {
            /* non-JSON error body — keep the generic message */
        }
        throw new Error(message);
    }

    return res.json();
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
