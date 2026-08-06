import { Link as RouterLink } from 'react-router-dom';
import {
    AppBar,
    Toolbar,
    Box,
    Button,
    Container,
    Typography,
    Switch,
    FormControlLabel,
    useTheme,
} from '@mui/material';
import LoginIcon from '@mui/icons-material/Login';
import LightModeIcon from '@mui/icons-material/LightMode';
import DarkModeIcon from '@mui/icons-material/DarkMode';
import { useAuth } from '../auth/AuthContext';
import { useColorScheme } from '../theme';

export default function Landing() {
    const { isAuthenticated } = useAuth();
    const { toggleColorScheme } = useColorScheme();
    const theme = useTheme();

    return (
        <Box
            sx={{
                minHeight: '100vh',
                display: 'flex',
                flexDirection: 'column',
                backgroundColor: 'background.default',
                color: 'text.primary',
                fontFamily: '"Inter", "Poppins", -apple-system, BlinkMacSystemFont, sans-serif',
            }}
        >
            <AppBar
                position="sticky"
                elevation={0}
                sx={{
                    backgroundColor: 'background.paper',
                    borderBottom: '1px solid',
                    borderColor: 'divider',
                    color: 'text.primary',
                    zIndex: (t) => t.zIndex.drawer + 1,
                }}
            >
                <Container maxWidth="xl">
                    <Toolbar disableGutters sx={{ justifyContent: 'space-between', minHeight: 72 }}>
                        <Box sx={{ display: 'flex', alignItems: 'center' }}>
                            <Typography
                                variant="h6"
                                sx={{ fontWeight: 800, lineHeight: 1.15, color: 'primary.main', mr: 1 }}
                            >
                                BIS NOC Gerji
                            </Typography>
                        </Box>

                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                            <FormControlLabel
                                control={
                                    <Switch
                                        checked={theme.palette.mode === 'dark'}
                                        onChange={toggleColorScheme}
                                        icon={<LightModeIcon sx={{ fontSize: 20 }} />}
                                        checkedIcon={<DarkModeIcon sx={{ fontSize: 20 }} />}
                                    />
                                }
                                label=""
                                sx={{ m: 0 }}
                                aria-label="Toggle dark mode"
                            />

                            <Button
                                variant="contained"
                                component={RouterLink}
                                to={isAuthenticated ? '/app' : '/login'}
                                startIcon={<LoginIcon />}
                                sx={{
                                    fontWeight: 700,
                                    px: 2.5,
                                    py: 1,
                                    borderRadius: 2,
                                }}
                            >
                                {isAuthenticated ? 'Dashboard' : 'Sign In'}
                            </Button>
                        </Box>
                    </Toolbar>
                </Container>
            </AppBar>

            <Container
                maxWidth="md"
                sx={{
                    flex: 1,
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'center',
                    alignItems: 'center',
                    textAlign: 'center',
                    px: { xs: 2, sm: 3 },
                    pb: 8,
                }}
            >
                <Typography
                    variant="h1"
                    component="h1"
                    sx={{
                        fontSize: { xs: '2rem', sm: '2.8rem' },
                        fontWeight: 800,
                        letterSpacing: '-0.03em',
                        mb: 2,
                    }}
                >
                    British International School
                </Typography>

                <Typography
                    variant="h2"
                    component="h2"
                    sx={{
                        fontSize: { xs: '1.3rem', sm: '1.6rem' },
                        fontWeight: 300,
                        color: 'text.secondary',
                        mb: 4,
                    }}
                >
                    NOC Gerji Campus
                </Typography>

                <Typography
                    variant="body1"
                    sx={{
                        fontSize: '1.05rem',
                        color: 'text.secondary',
                        mb: 5,
                        maxWidth: 520,
                        lineHeight: 1.7,
                    }}
                >
                    Staff Portal — manage teaching assignments, attendance,
                    lessons and student records.
                </Typography>
            </Container>

            <Box
                sx={{
                    py: 3,
                    textAlign: 'center',
                    borderTop: '1px solid',
                    borderColor: 'divider',
                    mt: 'auto',
                }}
            >
                <Typography variant="caption" sx={{ color: 'text.secondary', fontSize: '0.8rem' }}>
                    &copy; {new Date().getFullYear()} British International School, NOC Gerji Campus.
                    &nbsp;|&nbsp; Internal Staff Use Only
                </Typography>
            </Box>
        </Box>
    );
}
