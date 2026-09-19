import { useState } from 'react';
import { Link as RouterLink } from 'react-router-dom';
import {
    Box, Button, Container, Typography, useTheme, Grid, Chip,
} from '@mui/material';
import { alpha } from '@mui/material/styles';
import LoginIcon from '@mui/icons-material/Login';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import LightModeIcon from '@mui/icons-material/LightMode';
import DarkModeIcon from '@mui/icons-material/DarkMode';
import SchoolIcon from '@mui/icons-material/School';
import { useColorScheme } from '../theme';
import { CLASSES } from '../data/classes';
import { ClassCard, ClassLoginDialog } from '../components/ClassLoginCard';

/*
 * Public, login-free view of the school's classes.
 *
 * The roster mirrors Year_3_and_Year_4_Class_Teachers.csv and lives in
 * src/data/classes.js. Each class card carries a main-teacher login: a
 * popup dialog welcomes the teacher by name, and — for now, while the real
 * sign-in is being redesigned — the password is the class name itself
 * (e.g. "year 3 blue"). A correct password opens the class's teacher home.
 */

export default function PublicClasses() {
    const theme = useTheme();
    const dark = theme.palette.mode === 'dark';
    const { toggleColorScheme } = useColorScheme();
    const surface = dark ? theme.palette.background.paper : '#ffffff';
    const border = dark ? theme.palette.divider : '#e2e8f0';

    // Per-class sign-in dialog; the shared dialog owns password + submit.
    const [loginClass, setLoginClass] = useState(null);
    const openLogin = (klass) => setLoginClass(klass);
    const closeLogin = () => setLoginClass(null);

    const year3 = CLASSES.filter((c) => c.yearLevel === 3);
    const year4 = CLASSES.filter((c) => c.yearLevel === 4);

    const renderGroup = (title, list) => (
        <Box sx={{ mb: { xs: 6, md: 8 } }}>
            <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 1.5, mb: 3 }}>
                <Typography variant="h5" sx={{ fontWeight: 800, letterSpacing: '-.02em' }}>
                    {title}
                </Typography>
                <Chip label={`${list.length} classes`} size="small"
                    sx={{ fontWeight: 700, bgcolor: alpha(theme.palette.primary.main, 0.1),
                        color: 'primary.main' }} />
            </Box>
            <Grid container spacing={2.5}>
                {list.map((klass) => (
                    <Grid item xs={12} sm={6} md={4} lg={3} key={klass.id}>
                        <ClassCard klass={klass} onLogin={openLogin} />
                    </Grid>
                ))}
            </Grid>
        </Box>
    );

    return (
        <Box sx={{ minHeight: '100vh', display: 'flex', flexDirection: 'column',
            bgcolor: 'background.default', color: 'text.primary' }}>
            {/* ── header ── */}
            <Box component="header" sx={{ position: 'sticky', top: 0, zIndex: 100,
                borderBottom: `1px solid ${border}`, bgcolor: alpha(surface, 0.9),
                backdropFilter: 'blur(12px)' }}>
                <Container maxWidth="lg">
                    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                        minHeight: 68, gap: 2 }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                            <Box sx={{ width: 38, height: 38, borderRadius: 2, bgcolor: 'primary.main',
                                color: '#fff', display: 'flex', alignItems: 'center',
                                justifyContent: 'center' }}>
                                <SchoolIcon />
                            </Box>
                            <Box>
                                <Typography sx={{ fontWeight: 800, fontSize: 16, lineHeight: 1.1 }}>
                                    BIS NOC Gerji
                                </Typography>
                                <Typography sx={{ fontSize: 11, fontWeight: 600, color: 'text.secondary',
                                    letterSpacing: .5 }}>
                                    British International School
                                </Typography>
                            </Box>
                        </Box>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                            <Button component={RouterLink} to="/" variant="outlined" size="small"
                                startIcon={<ArrowBackIcon />} sx={{ fontWeight: 700, borderRadius: 1,
                                    px: 2, textTransform: 'none' }}>
                                Back
                            </Button>
                            <Box onClick={toggleColorScheme} sx={{ display: 'flex', alignItems: 'center',
                                justifyContent: 'center', width: 38, height: 38, borderRadius: 2,
                                border: `1px solid ${border}`, cursor: 'pointer', color: 'text.secondary',
                                '&:hover': { color: 'primary.main', borderColor: 'primary.main' } }}
                                aria-label="Toggle theme">
                                {dark
                                    ? <LightModeIcon sx={{ fontSize: 18 }} />
                                    : <DarkModeIcon  sx={{ fontSize: 18 }} />}
                            </Box>
                            <Button component={RouterLink} to="/login" variant="contained" size="small"
                                startIcon={<LoginIcon />} sx={{ fontWeight: 700, borderRadius: 2, px: 2.5,
                                    textTransform: 'none' }}>
                                Sign In
                            </Button>
                        </Box>
                    </Box>
                </Container>
            </Box>

            {/* ── content ── */}
            <Container maxWidth="lg" sx={{ py: { xs: 6, md: 9 } }}>
                <Box sx={{ mb: { xs: 5, md: 7 } }}>
                    <Typography variant="h3" sx={{ fontWeight: 800, letterSpacing: '-.02em' }}>
                        Classes
                    </Typography>
                    <Typography sx={{ mt: 1.5, color: 'text.secondary', maxWidth: 600 }}>
                        The {CLASSES.length} homeroom groups at British International School, Gerji
                        Primary II — {year3.length} in Year 3 and {year4.length} in Year 4.
                    </Typography>
                </Box>

                {renderGroup('Year 3', year3)}
                {renderGroup('Year 4', year4)}
            </Container>

            {/* ── main-teacher login dialog ── */}
            <ClassLoginDialog
                key={loginClass?.id || 'none'}
                loginClass={loginClass}
                onClose={closeLogin}
            />

            {/* ── footer ── */}
            <Box sx={{ py: 4, borderTop: `1px solid ${border}`, bgcolor: surface, mt: 'auto' }}>
                <Container maxWidth="lg">
                    <Typography sx={{ fontSize: 12, color: 'text.secondary', textAlign: 'center' }}>
                        &copy; {new Date().getFullYear()} British International School, Gerji Primary II
                        &nbsp;·&nbsp; Internal Staff Use Only
                    </Typography>
                </Container>
            </Box>
        </Box>
    );
}
