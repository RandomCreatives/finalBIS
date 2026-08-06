import { createTheme } from '@mui/material/styles';

const theme = createTheme({
    palette: {
        primary: { main: '#1e40af', light: '#3b82f6', dark: '#1e3a8a' },
        secondary: { main: '#0f766e' },
        background: { default: '#f6f7f9', paper: '#ffffff' },
        success: { main: '#15803d' },
        warning: { main: '#b45309' },
        error: { main: '#b91c1c' },
    },
    shape: { borderRadius: 10 },
    typography: {
        fontFamily: '"Inter", "Segoe UI", system-ui, -apple-system, sans-serif',
        h4: { fontWeight: 700, letterSpacing: '-0.02em' },
        h5: { fontWeight: 700, letterSpacing: '-0.01em' },
        h6: { fontWeight: 600 },
        button: { textTransform: 'none', fontWeight: 600 },
    },
    components: {
        MuiPaper: { styleOverrides: { root: { backgroundImage: 'none' } } },
        MuiCard: {
            defaultProps: { elevation: 0 },
            styleOverrides: { root: { border: '1px solid #e5e7eb' } },
        },
        MuiTableCell: {
            styleOverrides: {
                head: { fontWeight: 600, backgroundColor: '#f9fafb', color: '#374151' },
            },
        },
    },
});

export default theme;
