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
    { label: 'Administrator',   icon: AdminPanelSettingsIcon, desc: 'Full system access',             to: '/login' },
    { label: 'Main Teacher',    icon: SchoolIcon,             desc: 'Sign in with your class card',   to: '/classes' },
    { label: 'Subject Teacher', icon: MenuBookIcon,           desc: 'Sign in with your staff email',  to: '/login' },
    // Assistant teachers have no public sign-in yet; Clinic, Store Manager
    // and Library roles return with their modules.
];

/* ── decorative shape-circle with an icon ────────────────── */
const IconCircle = ({ bg, size, icon, desktopOnly = false }) => (
    <Box sx={{
        display: desktopOnly ? { xs: 'none', sm: 'flex' } : 'flex',
        width: { xs: size[0], md: size[1] }, height: { xs: size[0], md: size[1] },
        borderRadius: '50%', bgcolor: bg, flexShrink: 0,
        alignItems: 'center', justifyContent: 'center',
    }}>
        {icon}
    </Box>
);

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

    // Siddhi-style playful accents on top of the brand palette.
    const accent = {
        blue: dark ? '#60a5fa' : '#3b82f6',
        teal: dark ? '#2dd4bf' : '#0d9488',
        amber: dark ? '#fbbf24' : '#f59e0b',
        yellow: '#fde68a',
        pink: dark ? '#f9a8d4' : '#f9a8d4',
        pinkSoft: '#fbcfe8',
        navy: '#1e3a8a',
    };

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
                                sx={{ fontWeight: 700, borderRadius: 999, px: 2.5, textTransform: 'none' }}>
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
                        `radial-gradient(900px 420px at -10% -10%, ${alpha(theme.palette.primary.main, 0.22)}, transparent 55%)`,
                        `radial-gradient(760px 360px at 110% 0%, ${alpha('#f9a8d4', 0.08)}, transparent 55%)`,
                        `radial-gradient(700px 340px at 50% 110%, ${alpha('#fbbf24', 0.07)}, transparent 55%)`,
                      ].join(',')
                    : [
                        `radial-gradient(900px 420px at -10% -10%, ${alpha(theme.palette.primary.main, 0.08)}, transparent 55%)`,
                        `radial-gradient(760px 360px at 110% 0%, ${alpha('#f9a8d4', 0.12)}, transparent 55%)`,
                        `radial-gradient(700px 340px at 50% 110%, ${alpha('#fbbf24', 0.10)}, transparent 55%)`,
                      ].join(','),
                pt: { xs: 6, md: 9 }, pb: { xs: 5, md: 7 },
            }}>
                <Container maxWidth="lg">
                    <Box sx={{
                        display: 'grid', gap: { xs: 4, md: 6 },
                        gridTemplateColumns: { xs: '1fr', md: '1.05fr 0.95fr' },
                        alignItems: 'center', mb: { xs: 4, md: 6 },
                    }}>
                        {/* left — identity */}
                        <Box>
                            <Typography sx={{
                                fontSize: 12, fontWeight: 800, letterSpacing: '.14em',
                                textTransform: 'uppercase', mb: 2.5,
                                display: 'flex', alignItems: 'center', gap: 0.75,
                            }}>
                                <Box component="span" sx={{ color: accent.blue }}>Gerji</Box>
                                <Box component="span" sx={{ color: 'text.disabled' }}>·</Box>
                                <Box component="span" sx={{ color: accent.teal }}>Primary II</Box>
                                <Box component="span" sx={{ color: 'text.disabled' }}>·</Box>
                                <Box component="span" sx={{ color: accent.amber }}>Staff Portal</Box>
                            </Typography>
                            <Typography component="h1" sx={{
                                fontWeight: 800,
                                fontSize: { xs: '2.2rem', sm: '3.2rem', md: '3.7rem' },
                                lineHeight: 1.05, letterSpacing: '-.03em', mb: 2.5,
                                color: dark ? '#f8fafc' : '#0f172a',
                            }}>
                                Run the whole school day, from{' '}
                                <Box component="span" sx={{ color: 'primary.main' }}>one place</Box>.
                            </Typography>
                            <Typography sx={{ fontSize: { xs: '1rem', md: '1.1rem' }, lineHeight: 1.7,
                                color: 'text.secondary', maxWidth: 520, mb: 3 }}>
                                The official staff workspace of British International School, NOC Gerji
                                Campus — attendance, timetables, marksheets, lesson plans and calendars
                                in one secure portal.
                            </Typography>
                            <Box sx={{
                                display: 'inline-flex', alignItems: 'center', gap: 1,
                                px: 1.75, py: 1, borderRadius: 999,
                                border: `1px solid ${border}`,
                                bgcolor: alpha(theme.palette.success.main, dark ? 0.14 : 0.1),
                                color: 'success.main',
                                fontWeight: 700, fontSize: 13,
                            }}>
                                <EventAvailableIcon sx={{ fontSize: 17 }} />
                                Term 1 begins Monday, 21 September 2026
                            </Box>
                        </Box>

                        {/* right — sign-in card */}
                        <Box sx={{
                            p: { xs: 2.5, md: 3 }, borderRadius: 5,
                            border: `1px solid ${border}`,
                            bgcolor: alpha(surface, dark ? 0.8 : 0.95),
                            backdropFilter: 'blur(10px)',
                            boxShadow: dark
                                ? '0 30px 70px -30px rgba(15,23,42,.9)'
                                : '0 30px 70px -34px rgba(15,23,42,.28)',
                        }}>
                            <Typography component="h2" sx={{ fontWeight: 800, fontSize: 20,
                                letterSpacing: '-.01em', mb: 0.5,
                                color: dark ? '#f8fafc' : '#0f172a' }}>
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
                                                p: 1.75, borderRadius: 3,
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
                                                width: 42, height: 42, borderRadius: 2, flexShrink: 0,
                                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                bgcolor: '#0f172a', color: '#fff',
                                                border: dark ? '1px solid #334155' : 'none',
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

                    {/* playful shape strip (Siddhi-style collage, icons instead of photos) */}
                    <Box
                        data-testid="hero-shape-strip"
                        aria-hidden="true"
                        sx={{
                            display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
                            gap: { xs: 1.25, sm: 2 }, userSelect: 'none',
                        }}
                    >
                        <Box sx={{
                            display: { xs: 'none', sm: 'block' },
                            width: { sm: 44, md: 58 }, height: { sm: 88, md: 116 },
                            bgcolor: accent.amber, borderRadius: '0 999px 999px 0',
                        }} />
                        <IconCircle bg={accent.blue} size={[84, 116]} desktopOnly
                            icon={<CalendarMonthIcon sx={{ fontSize: { sm: 38, md: 52 }, color: '#fff' }} />} />
                        <Box sx={{
                            width: { xs: 60, md: 96 }, height: { xs: 60, md: 96 },
                            bgcolor: accent.pink,
                            borderRadius: '999px 999px 999px 20px',
                        }} />
                        <IconCircle bg={accent.yellow} size={[92, 124]}
                            icon={<GradeIcon sx={{ fontSize: { xs: 42, md: 56 }, color: accent.navy }} />} />
                        <Box sx={{
                            display: { xs: 'none', sm: 'block' },
                            width: { sm: 84, md: 116 }, height: { sm: 42, md: 58 },
                            bgcolor: accent.teal, borderRadius: '999px 999px 0 0',
                        }} />
                        <IconCircle bg={accent.pinkSoft} size={[76, 104]} desktopOnly
                            icon={<EventAvailableIcon sx={{ fontSize: { sm: 34, md: 46 }, color: accent.navy }} />} />
                        <Box sx={{
                            display: { xs: 'none', sm: 'block' },
                            width: { sm: 44, md: 58 }, height: { sm: 88, md: 116 },
                            bgcolor: accent.blue, borderRadius: '999px 0 0 999px',
                        }} />
                    </Box>
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
                                    px: 1.75, py: 1, borderRadius: 999,
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
