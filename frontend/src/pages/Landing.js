import { Link as RouterLink } from 'react-router-dom';
import {
    Box,
    Button,
    Container,
    Typography,
    useTheme,
    Grid,
    Card,
    CardActionArea,
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
import { useAuth } from '../auth/AuthContext';
import { useColorScheme } from '../theme';

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
    { label: 'Classes',        icon: SchoolIcon,             desc: 'Homerooms, staffing and rosters' },
    { label: 'Students',       icon: SchoolIcon,             desc: 'Enrolment, placement and records' },
    { label: 'Attendance',     icon: EventAvailableIcon,     desc: 'Daily attendance and registers' },
    { label: 'Timetable',      icon: CalendarMonthIcon,      desc: 'Period schedules and swaps' },
    { label: 'Lesson Plans',   icon: MenuBookIcon,           desc: 'Plan and share curriculum' },
    { label: 'Assignments',    icon: AssignmentIcon,         desc: 'Set and track coursework' },
    { label: 'Marksheets',     icon: GradeIcon,              desc: 'Record and review grades' },
    { label: 'Calendar',       icon: CalendarMonthIcon,      desc: 'Events and term dates' },
    // Dormant in v1.0, revived with their versions:
    // Notices · Messages · Library · Clinic · Store · Data Center
];

const roles = [
    { label: 'Administrator',  icon: AdminPanelSettingsIcon, desc: 'Full system management' },
    { label: 'Main Teacher',   icon: SchoolIcon,            desc: 'Class and lesson leadership' },
    { label: 'Assistant Teacher', icon: SchoolIcon,         desc: 'Support teaching duties' },
    { label: 'Subject Teacher',icon: SchoolIcon,            desc: 'Specialist instruction' },
    // Clinic, Store Manager and Library roles return with their modules.
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
                    ? `radial-gradient(1200px 400px at 50% -10%, ${alpha(theme.palette.primary.main, 0.18)}, transparent 60%)`
                    : `radial-gradient(1200px 400px at 50% -10%, ${alpha(theme.palette.primary.main, 0.12)}, transparent 60%)`,
                pt: { xs: 8, md: 12 }, pb: { xs: 8, md: 12 },
            }}>
                <Container maxWidth="lg">
                    <Box sx={{ maxWidth: 760, mx: 'auto', textAlign: 'center' }}>
                        <Typography component="h1" sx={{
                            fontWeight: 800,
                            fontSize: { xs: '2.2rem', sm: '3.2rem', md: '3.8rem' },
                            lineHeight: 1.1, letterSpacing: '-.02em', mb: 2.5,
                        }}>
                            Welcome to British International School, Gerji Primary II.
                        </Typography>

                        <Typography sx={{ fontSize: { xs: '1rem', md: '1.15rem' }, lineHeight: 1.7,
                            color: 'text.secondary', maxWidth: 600, mx: 'auto', mb: 4 }}>
                            The official staff portal for British International School, NOC Gerji Campus —
                            attendance, timetables, lesson plans, grades, health, library and more, all in
                            a single secure workspace.
                        </Typography>

                        <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', justifyContent: 'center' }}>
                            <Button component={RouterLink} to={homeTo}
                                variant="contained" size="large"
                                sx={{ fontWeight: 700, px: 4, py: 1.5, borderRadius: 2, fontSize: 15,
                                    textTransform: 'none' }}>
                                {signInLabel} →
                            </Button>
                        </Box>
                    </Box>
                </Container>
            </Box>

            {/* ── MODULES ─────────────────────────────────── */}
            <Box id="modules" sx={{ py: { xs: 7, md: 10 }, bgcolor: surface,
                borderTop: `1px solid ${border}`, borderBottom: `1px solid ${border}` }}>
                <Container maxWidth="lg">
                    <Box sx={{ textAlign: 'center', mb: { xs: 5, md: 7 } }}>
                        <Typography variant="h4" sx={{ fontWeight: 800, letterSpacing: '-.02em' }}>
                            Everything your campus needs
                        </Typography>
                        <Typography sx={{ mt: 1.5, color: 'text.secondary', maxWidth: 560, mx: 'auto' }}>
                            A connected set of tools built for teachers, administrators and support staff.
                        </Typography>
                    </Box>

                    <Grid container spacing={2.5}>
                        {modules.map((m) => {
                            const Icon = m.icon;
                            return (
                                <Grid item xs={6} sm={4} md={3} key={m.label}>
                                    <Card variant="outlined" sx={{ height: '100%', borderRadius: 3,
                                        transition: 'transform .18s, box-shadow .18s, border-color .18s',
                                        '&:hover': {
                                            transform: 'translateY(-4px)',
                                            borderColor: 'primary.main',
                                            boxShadow: dark
                                                ? '0 16px 40px rgba(0,0,0,.4)'
                                                : '0 16px 40px rgba(15,23,42,.08)',
                                        } }}>
                                        <CardActionArea component={RouterLink}
                                            to="/login"
                                            sx={{ p: 2.5, height: '100%',
                                                display: 'flex', flexDirection: 'column',
                                                alignItems: 'flex-start', gap: 1 }}>
                                            <Box sx={{ width: 42, height: 42, borderRadius: 2,
                                                display: 'flex', alignItems: 'center',
                                                justifyContent: 'center',
                                                bgcolor: alpha(theme.palette.primary.main, 0.1),
                                                color: 'primary.main', mb: .5 }}>
                                                <Icon />
                                            </Box>
                                            <Typography sx={{ fontWeight: 700, fontSize: 15 }}>
                                                {m.label}
                                            </Typography>
                                            <Typography sx={{ fontSize: 12.5, color: 'text.secondary',
                                                lineHeight: 1.5 }}>
                                                {m.desc}
                                            </Typography>
                                        </CardActionArea>
                                    </Card>
                                </Grid>
                            );
                        })}
                    </Grid>
                </Container>
            </Box>

            {/* ── ROLE ACCESS ─────────────────────────────── */}
            <Box id="roles" sx={{ py: { xs: 7, md: 10 }, position: 'relative' }}>
                <Container maxWidth="lg">
                    <Box sx={{ mb: { xs: 5, md: 7 }, maxWidth: 640 }}>
                        <Pill sx={{ mb: 2 }}>Staff Access</Pill>
                        <Typography variant="h4" sx={{ fontWeight: 800, letterSpacing: '-.02em' }}>
                            Who signs in?
                        </Typography>
                        <Typography sx={{ mt: 1.5, color: 'text.secondary', fontSize: 14 }}>
                            Accounts are issued by the school administrator — there is no self-registration.
                            Select your role to continue to sign in.
                        </Typography>
                    </Box>

                    <Grid container spacing={2}>
                        {roles.map((r) => {
                            const Icon = r.icon;
                            return (
                                <Grid item xs={6} sm={4} md={3} key={r.label}>
                                    <Card variant="outlined" sx={{ height: '100%', borderRadius: 3,
                                        transition: 'transform .18s, border-color .18s, background .18s',
                                        '&:hover': {
                                            transform: 'translateY(-3px)',
                                            borderColor: 'primary.main',
                                            bgcolor: alpha(theme.palette.primary.main, 0.04),
                                        } }}>
                                        <CardActionArea component={RouterLink} to="/login"
                                            sx={{ p: 2.5, height: '100%',
                                                display: 'flex', flexDirection: 'column',
                                                alignItems: 'flex-start', gap: 1 }}>
                                            <Box sx={{ width: 40, height: 40, borderRadius: 2,
                                                display: 'flex', alignItems: 'center',
                                                justifyContent: 'center',
                                                bgcolor: alpha(theme.palette.secondary.main, 0.12),
                                                color: 'secondary.main' }}>
                                                <Icon />
                                            </Box>
                                            <Typography sx={{ fontWeight: 700, fontSize: 14 }}>
                                                {r.label}
                                            </Typography>
                                            <Typography sx={{ fontSize: 12, color: 'text.secondary',
                                                lineHeight: 1.5 }}>
                                                {r.desc}
                                            </Typography>
                                        </CardActionArea>
                                    </Card>
                                </Grid>
                            );
                        })}
                    </Grid>
                </Container>
            </Box>

            {/* ── CTA ─────────────────────────────────────── */}
            <Box sx={{ pb: { xs: 7, md: 10 } }}>
                <Container maxWidth="lg">
                    <Box sx={{ p: { xs: 4, md: 6 }, borderRadius: 4,
                        background: dark
                            ? alpha(theme.palette.primary.main, 0.12)
                            : alpha(theme.palette.primary.main, 0.06),
                        border: `1px solid ${border}`,
                        display: 'flex', flexDirection: { xs: 'column', md: 'row' },
                        alignItems: { xs: 'flex-start', md: 'center' },
                        justifyContent: 'space-between', gap: 3 }}>
                        <Box>
                            <Typography variant="h5" sx={{ fontWeight: 800, letterSpacing: '-.02em', mb: 1 }}>
                                Ready to sign in?
                            </Typography>
                            <Typography sx={{ color: 'text.secondary', fontSize: 14, lineHeight: 1.7,
                                maxWidth: 520 }}>
                                Use your school-issued email and password, your linked Telegram account,
                                or your verified Gmail address to access the portal.
                            </Typography>
                        </Box>
                        <Button component={RouterLink} to={homeTo}
                            variant="contained" size="large"
                            sx={{ fontWeight: 700, px: 4, py: 1.5, borderRadius: 2, whiteSpace: 'nowrap',
                                fontSize: 15, textTransform: 'none' }}>
                            {signInLabel} →
                        </Button>
                    </Box>
                </Container>
            </Box>

            {/* ── FOOTER ──────────────────────────────────── */}
            <Box sx={{ py: 4, borderTop: `1px solid ${border}`, bgcolor: surface, mt: 'auto' }}>
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