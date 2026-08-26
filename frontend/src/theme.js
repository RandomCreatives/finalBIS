import { createContext, useContext, useMemo, useState } from 'react';
import { createTheme, ThemeProvider as MuiThemeProvider } from '@mui/material';

const ThemeModeContext = createContext({ toggleColorScheme: () => null, mode: 'dark' });

export function ThemeProvider({ children }) {
    const [mode, setMode] = useState(() => {
        if (typeof window !== 'undefined') {
            return localStorage.getItem('colorScheme') || 'light';
        }
        return 'light';
    });

    const theme = useMemo(
        () => createTheme(getDesignTokens(mode)),
        [mode]
    );

    const colorScheme = useMemo(
        () => ({
            mode,
            toggleColorScheme: () => {
                setMode((prevMode) => {
                    const next = prevMode === 'light' ? 'dark' : 'light';
                    if (typeof window !== 'undefined') {
                        localStorage.setItem('colorScheme', next);
                    }
                    return next;
                });
            },
        }),
        [mode]
    );

    return (
        <ThemeModeContext.Provider value={colorScheme}>
            <MuiThemeProvider theme={theme}>{children}</MuiThemeProvider>
        </ThemeModeContext.Provider>
    );
}

export const useColorScheme = () => useContext(ThemeModeContext);

function getDesignTokens(mode) {
    const brand = {
        blue: '#1e40af',
        blueDark: '#1e3a8a',
        blueLight: '#3b82f6',
        teal: '#0f766e',
        slate: '#0f172a',
    };

    const base = {
        primary: { main: brand.blue, light: brand.blueLight, dark: brand.blueDark },
        secondary: { main: brand.teal },
        success: { main: '#15803d' },
        warning: { main: '#b45309' },
        error: { main: '#b91c1c' },
        shape: { borderRadius: 14 },
        typography: {
            fontFamily: '"Inter", "Segoe UI", system-ui, -apple-system, sans-serif',
            h4: { fontWeight: 800, letterSpacing: '-0.03em' },
            h5: { fontWeight: 800, letterSpacing: '-0.02em' },
            h6: { fontWeight: 700 },
            subtitle1: { fontWeight: 700 },
            button: { textTransform: 'none', fontWeight: 700 },
        },
        components: {
            MuiCssBaseline: {
                styleOverrides: {
                    body: {
                        background: mode === 'dark'
                            ? 'radial-gradient(circle at top left, rgba(59,130,246,0.10), transparent 28rem), #0f172a'
                            : 'radial-gradient(circle at top left, rgba(59,130,246,0.10), transparent 28rem), #f4f7fb',
                    },
                },
            },
            MuiPaper: { styleOverrides: { root: { backgroundImage: 'none' } } },
            MuiCard: {
                defaultProps: { elevation: 0 },
                styleOverrides: {
                    root: {
                        border: mode === 'dark' ? '1px solid #1e293b' : '1px solid #e2e8f0',
                        boxShadow: mode === 'dark' ? '0 18px 45px rgba(0,0,0,0.3)' : '0 18px 45px rgba(15, 23, 42, 0.06)',
                    },
                },
            },
            MuiButton: {
                styleOverrides: {
                    root: { borderRadius: 12 },
                },
            },
            MuiChip: {
                styleOverrides: {
                    root: { fontWeight: 700 },
                },
            },
            MuiOutlinedInput: {
                styleOverrides: {
                    root: {
                        borderRadius: 12,
                        backgroundColor: mode === 'dark' ? '#1e293b' : '#ffffff',
                    },
                },
            },
            MuiTableCell: {
                styleOverrides: {
                    head: { fontWeight: 700, backgroundColor: '#f8fafc', color: '#334155' },
                },
            },
            MuiAppBar: {
                styleOverrides: {
                    root: { backgroundImage: 'none' },
                },
            },
        },
    };

    if (mode === 'dark') {
        return {
            ...base,
            palette: {
                mode: 'dark',
                primary: { main: brand.blue, light: brand.blueLight, dark: brand.blueDark },
                secondary: { main: brand.teal },
                background: { default: '#0f172a', paper: '#1e293b' },
                divider: '#334155',
                text: { primary: '#f8fafc', secondary: '#94a3b8' },
                success: { main: '#22c55e' },
                warning: { main: '#fb923c' },
                error: { main: '#ef4444' },
            },
        };
    }

    return {
        ...base,
        palette: {
            mode: 'light',
            primary: { main: brand.blue, light: brand.blueLight, dark: brand.blueDark },
            secondary: { main: brand.teal },
            background: { default: '#f4f7fb', paper: '#ffffff' },
            divider: '#e2e8f0',
            text: { primary: '#111827', secondary: '#64748b' },
            success: { main: '#15803d' },
            warning: { main: '#b45309' },
            error: { main: '#b91c1c' },
        },
    };
}
