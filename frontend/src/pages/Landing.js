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
import { styled } from '@mui/material/styles';
import LoginIcon from '@mui/icons-material/Login';
import LightModeIcon from '@mui/icons-material/LightMode';
import DarkModeIcon from '@mui/icons-material/DarkMode';
import AdminPanelSettingsIcon from '@mui/icons-material/AdminPanelSettings';
import SchoolIcon from '@mui/icons-material/School';
import LocalHospitalIcon from '@mui/icons-material/LocalHospital';
import StorefrontIcon from '@mui/icons-material/Storefront';
import LocalLibraryIcon from '@mui/icons-material/LocalLibrary';
import StorageIcon from '@mui/icons-material/Storage';
import { useAuth } from '../auth/AuthContext';
import { useColorScheme } from '../theme';

const MorphButton = styled(Box)(({ theme }) => ({
    position: 'relative',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '8px',
    padding: '12px 24px',
    borderRadius: '16px',
    fontWeight: 600,
    fontSize: '14px',
    cursor: 'pointer',
    transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
    backdropFilter: 'blur(10px)',
    border: '1px solid rgba(255, 255, 255, 0.12)',
    boxShadow: '0 8px 32px rgba(0, 0, 0, 0.1)',
    color: theme.palette.text.primary,
    backgroundColor: theme.palette.mode === 'dark' 
        ? 'rgba(15, 23, 42, 0.6)' 
        : 'rgba(255, 255, 255, 0.7)',
    '&:hover': {
        transform: 'translateY(-2px)',
        boxShadow: '0 12px 40px rgba(0, 0, 0, 0.15)',
        borderColor: 'rgba(255, 255, 255, 0.25)',
        backgroundColor: theme.palette.mode === 'dark' 
            ? 'rgba(30, 41, 59, 0.7)' 
            : 'rgba(248, 250, 252, 0.9)',
    },
    '&:active': {
        transform: 'translateY(0)',
    },
}));

const floatingButtons = [
    { label: 'Admin', icon: AdminPanelSettingsIcon, href: '/login' },
    { label: 'Teachers', icon: SchoolIcon, href: '/login' },
    { label: 'Clinic', icon: LocalHospitalIcon, href: '/login' },
    { label: 'Store', icon: StorefrontIcon, href: '/login' },
    { label: 'Library', icon: LocalLibraryIcon, href: '/login' },
];

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

            {/* Floating Quick Access Buttons */}
            <Box
                sx={{
                    display: 'flex',
                    justifyContent: 'center',
                    gap: 2,
                    flexWrap: 'wrap',
                    px: 2,
                    mb: 4,
                }}
            >
                {floatingButtons.map((btn) => {
                    const Icon = btn.icon;
                    return (
                    <MorphButton
                        key={btn.label}
                        component={RouterLink}
                        to={btn.href}
                    >
                        <Icon sx={{ fontSize: 18, opacity: 0.8 }} />
                        {btn.label}
                    </MorphButton>
                    );
                })}
            </Box>

            {/* Public Access Section */}
            <Box
                sx={{
                    display: 'flex',
                    justifyContent: 'center',
                    gap: 2,
                    flexWrap: 'wrap',
                    px: 2,
                    mb: 4,
                }}
            >
                <MorphButton component={RouterLink} to="/data-center">
                    <StorageIcon sx={{ fontSize: 18, opacity: 0.8 }} />
                    Data Center (Public)
                </MorphButton>
            </Box>

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
