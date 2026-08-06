import { createTheme, alpha } from '@mui/material/styles';

const brand = {
    blue: '#1e40af',
    blueDark: '#1e3a8a',
    blueLight: '#3b82f6',
    teal: '#0f766e',
    slate: '#0f172a',
};

const theme = createTheme({
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
                    background:
                        'radial-gradient(circle at top left, rgba(59,130,246,0.10), transparent 28rem), #f4f7fb',
                },
            },
        },
        MuiPaper: { styleOverrides: { root: { backgroundImage: 'none' } } },
        MuiCard: {
            defaultProps: { elevation: 0 },
            styleOverrides: {
                root: {
                    border: '1px solid #e2e8f0',
                    boxShadow: '0 18px 45px rgba(15, 23, 42, 0.06)',
                },
            },
        },
        MuiButton: {
            styleOverrides: {
                root: { borderRadius: 12 },
                contained: { boxShadow: `0 12px 24px ${alpha(brand.blue, 0.20)}` },
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
                    backgroundColor: '#ffffff',
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
});

export default theme;
