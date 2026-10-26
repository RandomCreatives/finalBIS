import { createContext, useContext, useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { getWebApp, isDarkColorScheme } from '../auth/auth';

export type ThemeMode = 'light' | 'dark';

interface ThemeContextValue {
    theme: ThemeMode;
    isDark: boolean;
    toggleTheme: () => void;
    setTheme: (mode: ThemeMode) => void;
}

const STORAGE_KEY = 'tma_theme_override';

const ThemeContext = createContext<ThemeContextValue | null>(null);

function resolveInitialTheme(): ThemeMode {
    try {
        const saved = localStorage.getItem(STORAGE_KEY);
        if (saved === 'light' || saved === 'dark') return saved;
    } catch {
        // Ignore storage restrictions in embedded webviews.
    }
    return isDarkColorScheme() ? 'dark' : 'light';
}

function applyThemeToDom(mode: ThemeMode): void {
    const root = document.documentElement;
    if (mode === 'dark') {
        root.classList.add('dark');
    } else {
        root.classList.remove('dark');
    }

    const webApp = getWebApp();
    try {
        const surface = mode === 'dark' ? '#060d1d' : '#eaf2ff';
        webApp?.setHeaderColor?.(surface);
        webApp?.setBackgroundColor?.(surface);
    } catch {
        // Older Telegram clients may not support custom hex header colors.
    }
}

export function ThemeProvider({ children }: { children: ReactNode }) {
    const [theme, setThemeState] = useState<ThemeMode>(() => resolveInitialTheme());

    useEffect(() => {
        applyThemeToDom(theme);
    }, [theme]);

    useEffect(() => {
        const webApp = getWebApp();
        const handleTelegramTheme = () => {
            try {
                if (localStorage.getItem(STORAGE_KEY)) return;
            } catch {
                // ignore
            }
            setThemeState(isDarkColorScheme() ? 'dark' : 'light');
        };
        webApp?.onEvent?.('themeChanged', handleTelegramTheme);
        return () => {
            webApp?.offEvent?.('themeChanged', handleTelegramTheme);
        };
    }, []);

    const setTheme = (mode: ThemeMode) => {
        try {
            localStorage.setItem(STORAGE_KEY, mode);
        } catch {
            // ignore
        }
        setThemeState(mode);
    };

    const toggleTheme = () => {
        setTheme(theme === 'dark' ? 'light' : 'dark');
    };

    return (
        <ThemeContext.Provider value={{ theme, isDark: theme === 'dark', toggleTheme, setTheme }}>
            {children}
        </ThemeContext.Provider>
    );
}

export function useTheme(): ThemeContextValue {
    const ctx = useContext(ThemeContext);
    if (!ctx) throw new Error('useTheme must be used within a ThemeProvider');
    return ctx;
}
