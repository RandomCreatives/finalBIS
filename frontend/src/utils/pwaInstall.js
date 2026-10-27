import { useCallback, useEffect, useState } from 'react';

export const PWA_SNOOZE_STORAGE_KEY = 'bisnoc.pwa.installSnoozedUntil';
export const DEFAULT_SNOOZE_DAYS = 14;

let deferredPrompt = null;
let initialized = false;
const listeners = new Set();

function notifyListeners() {
    listeners.forEach((fn) => {
        try {
            fn();
        } catch {
            // Ignore listener errors so other subscribers still update.
        }
    });
}

export function isStandaloneApp() {
    if (typeof window === 'undefined') return false;
    const standaloneMedia = Boolean(
        window.matchMedia && window.matchMedia('(display-mode: standalone)').matches,
    );
    const iosStandalone = window.navigator?.standalone === true;
    return standaloneMedia || iosStandalone;
}

export function isTelegramInAppBrowser() {
    if (typeof window === 'undefined') return false;
    if (window.Telegram?.WebApp?.initData) return true;
    const ua = window.navigator?.userAgent || '';
    if (/Telegram/i.test(ua)) return true;
    if (window.location?.pathname?.startsWith('/tma')) return true;
    return false;
}

export function isIosInstallableBrowser() {
    if (typeof window === 'undefined') return false;
    if (isStandaloneApp() || isTelegramInAppBrowser()) return false;
    const ua = window.navigator?.userAgent || '';
    if (/(FBAN|FBAV|Instagram|Line\/)/i.test(ua)) return false;
    const isClassicIos = /iPhone|iPad|iPod/i.test(ua);
    const isIpadOs = /Macintosh/i.test(ua) && (window.navigator?.maxTouchPoints || 0) > 1;
    return isClassicIos || isIpadOs;
}

export function isBannerSnoozed() {
    if (typeof window === 'undefined') return false;
    try {
        const raw = window.localStorage.getItem(PWA_SNOOZE_STORAGE_KEY);
        if (!raw) return false;
        const until = Number(raw);
        if (!Number.isFinite(until)) return false;
        if (Date.now() < until) return true;
        window.localStorage.removeItem(PWA_SNOOZE_STORAGE_KEY);
        return false;
    } catch {
        return false;
    }
}

export function snoozeInstallBanner(days = DEFAULT_SNOOZE_DAYS) {
    if (typeof window !== 'undefined') {
        try {
            const until = Date.now() + days * 24 * 60 * 60 * 1000;
            window.localStorage.setItem(PWA_SNOOZE_STORAGE_KEY, String(until));
        } catch {
            // Private browsing / quota restrictions — still hide in memory via state.
        }
    }
    notifyListeners();
}

export function clearInstallSnooze() {
    if (typeof window !== 'undefined') {
        try {
            window.localStorage.removeItem(PWA_SNOOZE_STORAGE_KEY);
        } catch {
            // Ignore storage errors.
        }
    }
    notifyListeners();
}

const onBeforeInstallPrompt = (event) => {
    event.preventDefault();
    deferredPrompt = event;
    notifyListeners();
};

const onAppInstalled = () => {
    deferredPrompt = null;
    notifyListeners();
};

export function initPwaInstallStore() {
    if (initialized || typeof window === 'undefined') return;
    initialized = true;
    window.addEventListener('beforeinstallprompt', onBeforeInstallPrompt);
    window.addEventListener('appinstalled', onAppInstalled);
    const mq = window.matchMedia && window.matchMedia('(display-mode: standalone)');
    if (mq) {
        if (typeof mq.addEventListener === 'function') {
            mq.addEventListener('change', notifyListeners);
        } else if (typeof mq.addListener === 'function') {
            mq.addListener(notifyListeners);
        }
    }
}

export async function triggerPwaInstall() {
    if (!deferredPrompt) {
        return isIosInstallableBrowser() ? 'ios' : 'unavailable';
    }
    const promptEvent = deferredPrompt;
    deferredPrompt = null;
    notifyListeners();
    try {
        await promptEvent.prompt();
        const choice = await promptEvent.userChoice;
        notifyListeners();
        return choice?.outcome || 'dismissed';
    } catch {
        notifyListeners();
        return 'dismissed';
    }
}

function getSnapshot() {
    const installed = isStandaloneApp();
    const inTelegram = isTelegramInAppBrowser();
    const canNativeInstall = Boolean(deferredPrompt) && !installed && !inTelegram;
    const isIos = isIosInstallableBrowser();
    const snoozed = isBannerSnoozed();
    return {
        installed,
        inTelegram,
        canNativeInstall,
        isIos,
        snoozed,
        canShowInstallUi: canNativeInstall || isIos,
        shouldShowBanner: !snoozed && (canNativeInstall || isIos),
    };
}

export function usePwaInstall() {
    initPwaInstallStore();
    const [state, setState] = useState(getSnapshot);
    const [memoryDismissed, setMemoryDismissed] = useState(false);

    useEffect(() => {
        const sync = () => setState(getSnapshot());
        listeners.add(sync);
        sync();
        return () => {
            listeners.delete(sync);
        };
    }, []);

    const snoozeBanner = useCallback((days = DEFAULT_SNOOZE_DAYS) => {
        setMemoryDismissed(true);
        snoozeInstallBanner(days);
    }, []);

    const triggerInstall = useCallback(async () => triggerPwaInstall(), []);

    return {
        ...state,
        shouldShowBanner: state.shouldShowBanner && !memoryDismissed,
        snoozeBanner,
        triggerInstall,
    };
}

// Test-only helper to reset singleton state between Jest runs.
export function _resetPwaInstallForTests() {
    deferredPrompt = null;
    if (typeof window !== 'undefined') {
        try {
            window.localStorage.removeItem(PWA_SNOOZE_STORAGE_KEY);
        } catch {
            // Ignore storage errors.
        }
    }
    notifyListeners();
}

// Auto-attach listeners immediately in browser environments so early
// `beforeinstallprompt` events fired before inner routes mount are captured.
initPwaInstallStore();
