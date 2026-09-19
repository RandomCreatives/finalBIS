import { Link as RouterLink } from 'react-router-dom';
import {
    Box,
    Button,
    Container,
    Typography,
    useTheme,
} from '@mui/material';
import { styled, alpha } from '@mui/material/styles';
import LoginIcon from '@mui/icons-material/Login';
import LightModeIcon from '@mui/icons-material/LightMode';
import DarkModeIcon from '@mui/icons-material/DarkMode';
import SchoolIcon from '@mui/icons-material/School';
import AdminPanelSettingsIcon from '@mui/icons-material/AdminPanelSettings';
import EventAvailableIcon from '@mui/icons-material/EventAvailable';
import CalendarMonthIcon from '@mui/icons-material/CalendarMonth';
import AssignmentIcon from '@mui/icons-material/Assignment';
import GradeIcon from '@mui/icons-material/Grade';
import MenuBookIcon from '@mui/icons-material/MenuBook';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';
import { useAuth } from '../auth/AuthContext';
import { useColorScheme } from '../theme';
import heroCampus from '../assets/hero-campus.jpg';

/* ── styled primitives ───────────────────────────────────── */
const NavLink = styled(Typography)(({ theme }) => ({
    fontSize: 14,
    fontWeight: 600,
    textDecoration: 'none',
    color: theme.palette.text.secondary,
    cursor: 'pointer',
    transition: 'color .15s',
    '&:hover': { color: theme.palette.primary.main },
    '@media (pointer: coarse)': { padding: '8px 0' },
}));

const Pill = styled(Box)(({ theme }) => ({
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
    padding: '5px 12px',
    borderRadius: 999,
    background: alpha(theme.palette.primary.main, 0.1),
    color: theme.palette.primary.main,
    fontWeight: 700,
    fontSize: 11,
    letterSpacing: 1,
    textTransform: 'uppercase',
}));

/* ── data ────────────────────────────────────────────────── */
const modules = [
    { label: 'Classes',      icon: SchoolIcon },
    { label: 'Students',     icon: SchoolIcon },
    { label: 'Attendance',   icon: EventAvailableIcon },
    { label: 'Timetable',    icon: CalendarMonthIcon },
    { label: 'Lesson Plans', icon: MenuBookIcon },
    { label: 'Assignments',  icon: AssignmentIcon },
    { label: 'Marksheets',   icon: GradeIcon },
    { label: 'Calendar',     icon: CalendarMonthIcon },
    // Dormant in v1.0, revived with their versions:
    // Notices · Messages · Library · Clinic · Store · Data Center
];

const roles = [
    { label: 'Administrator',   icon: AdminPanelSettingsIcon, desc: 'Full system access',                 to: '/login' },
    { label: 'Main Teacher',    icon: SchoolIcon,             desc: 'Sign in with your class card',       to: '/classes' },
    { label: 'Subject Teacher', icon: MenuBookIcon,           desc: 'Sign in with your teacher card',     to: '/teacher-login' },
    // Assistant teachers have no public sign-in yet; Clinic, Store Manager
    // and Library roles return with their modules.
];

/* ── component ───────────────────────────────────────────── */
export default function Landing() {
    const { isAuthenticated } = useAuth();
    const { toggleColorScheme } = useColorScheme();
    const theme = useTheme();
    const dark = theme.palette.mode === 'dark';

    const surface = dark ? theme.palette.background.paper : '#ffffff';
    const border = dark ? theme.palette.divider : '#e2e8f0';
    const homeTo = isAuthenticated ? '/app' : '/login';
    const signInLabel = isAuthenticated ? 'Dashboard' : 'Sign In';

    return (
        <Box sx={{ minHeight: '100vh', display: 'flex', flexDirection: 'column',
            bgcolor: 'background.default', color: 'text.primary' }}>

            {/* ── NAV ─────────────────────────────────────── */}
            <Box component="nav" sx={{
                position: 'sticky', top: 0, zIndex: 100,
                borderBottom: `1px solid ${border}`,
                bgcolor: alpha(surface, 0.9),
                backdropFilter: 'blur(12px)',
            }}>
                <Container maxWidth="lg">
                    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                        minHeight: 68, gap: 2 }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                            <Box sx={{ width: 38, height: 38, borderRadius: 2,
                                bgcolor: 'primary.main', color: '#fff',
                                display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                <SchoolIcon />
                            </Box>
                            <Box>
                                <Typography sx={{ fontWeight: 800, fontSize: 16, lineHeight: 1.1 }}>
                                    BIS NOC Gerji
                                </Typography>
                                <Typography sx={{ fontSize: 11, fontWeight: 600,
                                    color: 'text.secondary', letterSpacing: .5 }}>
                                    British International School
                                </Typography>
                            </Box>
                        </Box>

                        <Box sx={{ display: { xs: 'none', md: 'flex' }, gap: 3 }}>
                            <NavLink component={RouterLink} to="/classes">Classes</NavLink>
                            <NavLink component={RouterLink} to="/teachers">Teachers</NavLink>
                            <NavLink component={RouterLink} to="/students">Students</NavLink>
                            <NavLink component={RouterLink} to="/calendar">Calendar</NavLink>
                        </Box>

                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                            <Box onClick={toggleColorScheme} sx={{
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                width: 38, height: 38, borderRadius: 2,
                                border: `1px solid ${border}`, cursor: 'pointer', color: 'text.secondary',
                                '&:hover': { color: 'primary.main', borderColor: 'primary.main' },
                                transition: 'all .15s',
                            }} aria-label="Toggle theme">
                                {dark ? <LightModeIcon sx={{ fontSize: 18 }} />
                                       : <DarkModeIcon  sx={{ fontSize: 18 }} />}
                            </Box>
                            <Button component={RouterLink} to={homeTo}
                                variant="contained" size="small" startIcon={<LoginIcon />}
                                sx={{ fontWeight: 700, borderRadius: 2, px: 2.5, textTransform: 'none' }}>
                                {signInLabel}
                            </Button>
                        </Box>
                    </Box>
                </Container>
            </Box>

            {/* ── HERO ────────────────────────────────────── */}
            <Box sx={{
                position: 'relative', overflow: 'hidden',
                background: dark
                    ? [
                        `radial-gradient(900px 420px at -10% -10%, ${alpha(theme.palette.primary.main, 0.28)}, transparent 55%)`,
                        `radial-gradient(800px 380px at 110% 0%, ${alpha(theme.palette.secondary.main, 0.20)}, transparent 55%)`,
                      ].join(',')
                    : [
                        `radial-gradient(900px 420px at -10% -10%, ${alpha(theme.palette.primary.main, 0.12)}, transparent 55%)`,
                        `radial-gradient(800px 380px at 110% 0%, ${alpha(theme.palette.secondary.main, 0.10)}, transparent 55%)`,
                      ].join(','),
                pt: { xs: 6, md: 9 }, pb: { xs: 6, md: 8 },
            }}>
                <Container maxWidth="lg">
                    <Box sx={{
                        display: 'grid', gap: { xs: 4, md: 6 },
                        gridTemplateColumns: { xs: '1fr', md: '1.05fr 0.95fr' },
                        alignItems: 'center', mb: { xs: 4, md: 6 },
                    }}>
                        {/* left — identity */}
                        <Box>
                            <Pill sx={{ mb: 2.5 }}>Gerji · Primary II — Staff Portal</Pill>
                            <Typography component="h1" sx={{
                                fontWeight: 800,
                                fontSize: { xs: '2.1rem', sm: '3rem', md: '3.5rem' },
                                lineHeight: 1.08, letterSpacing: '-.02em', mb: 2.5,
                            }}>
                                Run the whole school day, from one place.
                            </Typography>
                            <Typography sx={{ fontSize: { xs: '1rem', md: '1.1rem' }, lineHeight: 1.7,
                                color: 'text.secondary', maxWidth: 520, mb: 3 }}>
                                The official staff workspace of British International School, NOC Gerji
                                Campus — attendance, timetables, marksheets, lesson plans and calendars
                                in one secure portal.
                            </Typography>
                            <Box sx={{
                                display: 'inline-flex', alignItems: 'center', gap: 1,
                                px: 1.75, py: 1, borderRadius: 2,
                                border: `1px solid ${border}`,
                                bgcolor: alpha(theme.palette.success.main, dark ? 0.14 : 0.1),
                                color: dark ? 'success.main' : 'success.main',
                                fontWeight: 700, fontSize: 13,
                            }}>
                                <EventAvailableIcon sx={{ fontSize: 17 }} />
                                Term 1 begins Monday, 21 September 2026
                            </Box>
                        </Box>

                        {/* right — sign-in card */}
                        <Box sx={{
                            p: { xs: 2.5, md: 3 }, borderRadius: 3,
                            border: `1px solid ${border}`,
                            bgcolor: alpha(surface, dark ? 0.75 : 0.9),
                            backdropFilter: 'blur(10px)',
                            boxShadow: dark
                                ? '0 24px 60px -24px rgba(15,23,42,.9)'
                                : '0 24px 60px -32px rgba(30,64,175,.35)',
                        }}>
                            <Typography component="h2" sx={{ fontWeight: 800, fontSize: 20,
                                letterSpacing: '-.01em', mb: 0.5 }}>
                                Sign in
                            </Typography>
                            <Typography variant="body2" color="text.secondary" sx={{ mb: 2.5 }}>
                                Choose your role to continue.
                            </Typography>

                            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.25 }}>
                                {roles.map((r) => {
                                    const Icon = r.icon;
                                    return (
                                        <Box
                                            key={r.label}
                                            component={RouterLink}
                                            to={r.to}
                                            sx={{
                                                display: 'flex', alignItems: 'center', gap: 2,
                                                p: 1.75, borderRadius: 2,
                                                border: `1px solid ${border}`,
                                                textDecoration: 'none', color: 'inherit',
                                                bgcolor: dark ? 'background.paper' : '#ffffff',
                                                transition: 'all .15s ease',
                                                '&:hover': {
                                                    borderColor: 'primary.main',
                                                    transform: 'translateY(-1px)',
                                                    boxShadow: dark ? 3 : 1,
                                                    '& .role-arrow': {
                                                        transform: 'translateX(3px)',
                                                        color: 'primary.main',
                                                    },
                                                },
                                            }}
                                        >
                                            <Box sx={{
                                                width: 42, height: 42, borderRadius: 1.5, flexShrink: 0,
                                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                bgcolor: alpha(theme.palette.primary.main, 0.1),
                                                color: 'primary.main',
                                            }}>
                                                <Icon sx={{ fontSize: 21 }} />
                                            </Box>
                                            <Box sx={{ minWidth: 0, flexGrow: 1 }}>
                                                <Typography sx={{ fontWeight: 800, fontSize: 15, lineHeight: 1.2 }}>
                                                    {r.label}
                                                </Typography>
                                                <Typography variant="caption" color="text.secondary"
                                                    sx={{ fontWeight: 500 }}>
                                                    {r.desc}
                                                </Typography>
                                            </Box>
                                            <ArrowForwardIcon className="role-arrow"
                                                sx={{ fontSize: 19, color: 'text.disabled',
                                                    transition: 'all .15s ease', flexShrink: 0 }} />
                                        </Box>
                                    );
                                })}
                            </Box>

                            <Typography variant="caption" color="text.secondary"
                                sx={{ display: 'block', mt: 2.25, lineHeight: 1.5 }}>
                                Accounts are issued by the school — there is no self-registration.
                            </Typography>
                        </Box>
                    </Box>

                    {/* illustration */}
                    <Box
                        component="img"
                        src={heroCampus}
                        alt="Illustration of the BIS NOC Gerji school campus in the morning"
                        sx={{
                            display: 'block', width: '100%',
                            aspectRatio: { xs: '16 / 10', sm: '21 / 9' },
                            objectFit: 'cover', objectPosition: 'center 55%',
                            borderRadius: 4, border: `1px solid ${border}`,
                            boxShadow: dark
                                ? '0 32px 80px -32px rgba(15,23,42,.9)'
                                : '0 32px 80px -40px rgba(30,64,175,.35)',
                            filter: dark ? 'saturate(.92) brightness(.8)' : 'none',
                        }}
                    />
                </Container>
            </Box>

            {/* ── MODULES STRIP ───────────────────────────── */}
            <Box sx={{ py: { xs: 5, md: 7 }, bgcolor: surface,
                borderTop: `1px solid ${border}`, borderBottom: `1px solid ${border}` }}>
                <Container maxWidth="lg">
                    <Box sx={{ display: 'flex', alignItems: 'baseline', flexWrap: 'wrap',
                        gap: 1.5, mb: 3 }}>
                        <Typography component="h2" sx={{ fontWeight: 800, fontSize: 17,
                            letterSpacing: '-.01em' }}>
                            Everything your campus needs
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                            — one workspace, inside the portal.
                        </Typography>
                    </Box>
                    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1.25 }}>
                        {modules.map((m) => {
                            const Icon = m.icon;
                            return (
                                <Box key={m.label} sx={{
                                    display: 'inline-flex', alignItems: 'center', gap: 1,
                                    px: 1.75, py: 1, borderRadius: 2,
                                    border: `1px solid ${border}`,
                                    bgcolor: dark ? 'background.default' : alpha(theme.palette.primary.main, 0.03),
                                    fontWeight: 600, fontSize: 13,
                                }}>
                                    <Icon sx={{ fontSize: 16, color: 'primary.main' }} />
                                    {m.label}
                                </Box>
                            );
                        })}
                    </Box>
                </Container>
            </Box>

            {/* ── FOOTER ──────────────────────────────────── */}
            <Box sx={{ py: 4, bgcolor: surface, mt: 'auto' }}>
                <Container maxWidth="lg">
                    <Box sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center',
                        justifyContent: 'space-between', gap: 2 }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                            <Box sx={{ width: 30, height: 30, borderRadius: 1.5,
                                bgcolor: 'primary.main', color: '#fff',
                                display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                <SchoolIcon sx={{ fontSize: 18 }} />
                            </Box>
                            <Typography sx={{ fontWeight: 800, fontSize: 13 }}>BIS NOC Gerji</Typography>
                        </Box>
                        <Typography sx={{ fontSize: 12, color: 'text.secondary', textAlign: 'center' }}>
                            &copy; {new Date().getFullYear()} British International School, NOC Gerji Campus
                            &nbsp;·&nbsp; Internal Staff Use Only
                        </Typography>
                    </Box>
                </Container>
            </Box>

        </Box>
    );
}
