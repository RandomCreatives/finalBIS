import { Link as RouterLink } from 'react-router-dom';
import { Box, Button, Container, Typography, useTheme } from '@mui/material';
import { styled, keyframes } from '@mui/material/styles';
import LoginIcon from '@mui/icons-material/Login';
import AdminPanelSettingsIcon from '@mui/icons-material/AdminPanelSettings';
import SchoolIcon from '@mui/icons-material/School';
import LocalHospitalIcon from '@mui/icons-material/LocalHospital';
import StorefrontIcon from '@mui/icons-material/Storefront';
import LocalLibraryIcon from '@mui/icons-material/LocalLibrary';
import LightModeIcon from '@mui/icons-material/LightMode';
import DarkModeIcon from '@mui/icons-material/DarkMode';
import { useAuth } from '../auth/AuthContext';
import { useColorScheme } from '../theme';

/* ── palette ─────────────────────────────────────────────── */
const C = {
    green:   '#39FF14',   // neon green
    navy:    '#0A1F6B',   // navy blue
    cyan:    '#00E5FF',   // electric cyan accent
    offWhite:'#F4F7F4',
    charcoal:'#050D1A',
    dark2:   '#020810',
};

/* ── keyframes ───────────────────────────────────────────── */
const marqueeAnim = keyframes`from{transform:translateX(0)}to{transform:translateX(-50%)}`;
const fadeUp = keyframes`from{opacity:0;transform:translateY(20px)}to{opacity:1;transform:translateY(0)}`;
const wiggle = keyframes`0%,100%{transform:rotate(-2deg)}50%{transform:rotate(2deg)}`;

/* ── styled primitives ───────────────────────────────────── */
const Tag = styled(Box)({
    display: 'inline-flex',
    alignItems: 'center',
    fontFamily: '"Courier New", monospace',
    fontWeight: 700,
    fontSize: 11,
    letterSpacing: 1.5,
    padding: '3px 10px',
    border: `1.5px solid ${C.green}`,
    color: C.green,
    borderRadius: 4,
    textTransform: 'uppercase',
    whiteSpace: 'nowrap',
});

const RoleChip = styled(Box)(({ theme }) => ({
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    padding: '10px 18px',
    borderRadius: 10,
    border: `1.5px solid ${theme.palette.mode === 'dark' ? 'rgba(255,255,255,.1)' : 'rgba(0,0,0,.1)'}`,
    background: 'transparent',
    fontWeight: 600,
    fontSize: 13,
    cursor: 'pointer',
    transition: 'all .18s',
    textDecoration: 'none',
    color: 'inherit',
    '&:hover': {
        borderColor: C.green,
        color: C.green,
        transform: 'translateY(-2px)',
    },
}));

const DotGrid = styled(Box)(({ theme }) => ({
    position: 'absolute', inset: 0, pointerEvents: 'none',
    backgroundImage: `radial-gradient(${
        theme.palette.mode === 'dark' ? 'rgba(255,255,255,.05)' : 'rgba(0,0,0,.06)'
    } 1px, transparent 1px)`,
    backgroundSize: '22px 22px',
}));

/* ── data ────────────────────────────────────────────────── */
const roles = [
    { label: 'Admin',           icon: AdminPanelSettingsIcon },
    { label: 'Main Teacher',    icon: SchoolIcon },
    { label: 'Asst. Teacher',   icon: SchoolIcon },
    { label: 'Subject Teacher', icon: SchoolIcon },
    { label: 'Clinic',          icon: LocalHospitalIcon },
    { label: 'Store Manager',   icon: StorefrontIcon },
    { label: 'Library',         icon: LocalLibraryIcon },
];

const stats = [
    { n: '17',  label: 'Modules' },
    { n: '174', label: 'Tests passing' },
    { n: '7',   label: 'Staff roles' },
    { n: '∞',   label: 'Student records' },
];

const ticker = '★ ATTENDANCE  ·  TIMETABLE  ·  LESSON PLANS  ·  LIBRARY  ·  CLINIC  ·  MARKSHEETS  ·  NOTICES  ·  STORE  ·  CALENDAR  ·  ASSIGNMENTS  ·  MESSAGES  ·  DATA CENTER  ·  ';

/* ── component ───────────────────────────────────────────── */
export default function Landing() {
    const { isAuthenticated } = useAuth();
    const { toggleColorScheme } = useColorScheme();
    const theme = useTheme();
    const dark = theme.palette.mode === 'dark';

    const border = dark ? 'rgba(255,255,255,.08)' : 'rgba(0,0,0,.08)';
    const bg     = dark ? C.charcoal : C.offWhite;
    const fg     = dark ? '#F0F0F0'  : C.charcoal;

    return (
        <Box sx={{ minHeight: '100vh', display: 'flex', flexDirection: 'column',
            bgcolor: bg, color: fg,
            fontFamily: '"Inter","Plus Jakarta Sans",sans-serif', overflowX: 'hidden' }}>

            {/* ── NAV ─────────────────────────────────────── */}
            <Box component="nav" sx={{
                position: 'sticky', top: 0, zIndex: 100,
                borderBottom: `1.5px solid ${border}`,
                bgcolor: dark ? 'rgba(5,13,26,.94)' : 'rgba(244,247,244,.94)',
                backdropFilter: 'blur(14px)',
            }}>
                <Container maxWidth="xl">
                    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                        minHeight: 62, gap: 2 }}>
                        {/* logo */}
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                            <Box sx={{ width: 6, height: 28, borderRadius: 1, bgcolor: C.green }} />
                            <Box>
                                <Typography sx={{ fontWeight: 900, fontSize: 14, lineHeight: 1.1,
                                    letterSpacing: '-.01em' }}>BIS NOC</Typography>
                                <Typography sx={{ fontSize: 9, fontWeight: 700, color: C.cyan,
                                    letterSpacing: 2.5, textTransform: 'uppercase' }}>Gerji Campus</Typography>
                            </Box>
                        </Box>

                        {/* nav links */}
                        <Box sx={{ display: { xs: 'none', md: 'flex' }, gap: 3 }}>
                            {[['#access', 'Staff Access'], ['/data-center', 'Data Center']].map(([href, label]) => (
                                <Typography key={label} component={RouterLink} to={href}
                                    sx={{ fontSize: 13, fontWeight: 600, textDecoration: 'none',
                                        color: 'inherit', opacity: .6,
                                        '&:hover': { opacity: 1, color: C.green }, transition: 'color .15s' }}>
                                    {label}
                                </Typography>
                            ))}
                        </Box>

                        {/* right controls */}
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                            <Box onClick={toggleColorScheme} sx={{
                                display: 'flex', alignItems: 'center', gap: .5,
                                px: 1.5, py: .7, borderRadius: 20,
                                border: `1.5px solid ${border}`,
                                cursor: 'pointer', fontSize: 12, fontWeight: 600,
                                '&:hover': { borderColor: C.green, color: C.green },
                                transition: 'all .15s',
                            }}>
                                {dark
                                    ? <LightModeIcon sx={{ fontSize: 14 }} />
                                    : <DarkModeIcon  sx={{ fontSize: 14 }} />}
                                {dark ? 'Light' : 'Dark'}
                            </Box>
                            <Button component={RouterLink} to={isAuthenticated ? '/app' : '/login'}
                                variant="contained" size="small" startIcon={<LoginIcon />}
                                sx={{ fontWeight: 700, borderRadius: 20, px: 2.5,
                                    bgcolor: C.navy, color: '#fff',
                                    '&:hover': { bgcolor: C.green, color: C.charcoal } }}>
                                {isAuthenticated ? 'Dashboard' : 'Sign In'}
                            </Button>
                        </Box>
                    </Box>
                </Container>
            </Box>

            {/* ── TICKER ──────────────────────────────────── */}
            <Box sx={{ overflow: 'hidden', bgcolor: C.navy, py: .55, userSelect: 'none' }}>
                <Box sx={{ display: 'flex', animation: `${marqueeAnim} 24s linear infinite`,
                    width: 'max-content' }}>
                    {[ticker, ticker].map((t, i) => (
                        <Typography key={i} sx={{ whiteSpace: 'nowrap', fontSize: 11, fontWeight: 700,
                            letterSpacing: 2, color: C.green, px: 2 }}>{t}</Typography>
                    ))}
                </Box>
            </Box>

            {/* ── HERO ────────────────────────────────────── */}
            <Box sx={{ position: 'relative', overflow: 'hidden',
                pt: { xs: 10, md: 16 }, pb: { xs: 10, md: 16 } }}>
                <DotGrid />

                {/* zigzag accent */}
                <svg width="140" height="26" viewBox="0 0 140 26" style={{
                    position: 'absolute', top: 28, left: 28, opacity: .4,
                    display: 'block',
                }}>
                    <polyline points="0,13 18,0 36,13 54,0 72,13 90,0 108,13 126,0 144,13"
                        fill="none" stroke={C.green} strokeWidth="2.5" strokeLinecap="round"/>
                </svg>

                <Container maxWidth="lg" sx={{ position: 'relative' }}>
                    <Box sx={{ maxWidth: 680, animation: `${fadeUp} .65s ease both` }}>
                        <Tag sx={{ mb: 3 }}>Est. 1998 · NOC Gerji Campus</Tag>

                        <Typography component="h1" sx={{
                            fontFamily: '"Syne","Impact","Arial Black",sans-serif',
                            fontSize: { xs: '2.8rem', sm: '4rem', md: '5.2rem' },
                            fontWeight: 900, lineHeight: 1.0, letterSpacing: '-.03em', mb: 3,
                        }}>
                            School Life{' '}
                            <Box component="span" sx={{ color: C.green }}>in Full Color</Box>
                        </Typography>

                        <Typography sx={{ fontSize: { xs: '1rem', md: '1.1rem' }, lineHeight: 1.8,
                            opacity: .65, maxWidth: 520, mb: 6 }}>
                            The all-in-one staff portal for British International School — covering
                            teaching, attendance, planning, health, library, and more.
                        </Typography>

                        <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
                            <Button component={RouterLink} to={isAuthenticated ? '/app' : '/login'}
                                variant="contained" size="large"
                                sx={{ fontWeight: 800, px: 4, py: 1.5, borderRadius: 2, fontSize: 15,
                                    bgcolor: C.navy, color: '#fff',
                                    border: `2px solid ${C.navy}`,
                                    '&:hover': { bgcolor: C.green, color: C.charcoal, borderColor: C.green } }}>
                                {isAuthenticated ? 'Go to Dashboard' : 'Staff Sign In'} →
                            </Button>
                            <Button component={RouterLink} to="/data-center" variant="outlined"
                                size="large"
                                sx={{ fontWeight: 700, px: 3, py: 1.5, borderRadius: 2, fontSize: 15,
                                    borderColor: border, color: 'inherit',
                                    '&:hover': { borderColor: C.cyan, color: C.cyan, bgcolor: 'transparent' } }}>
                                Data Center
                            </Button>
                        </Box>
                    </Box>
                </Container>
            </Box>

            {/* ── STATS STRIP ─────────────────────────────── */}
            <Box sx={{ borderTop: `1.5px solid ${border}`, borderBottom: `1.5px solid ${border}`,
                py: 5, bgcolor: dark ? 'rgba(255,255,255,.02)' : 'rgba(0,0,0,.02)' }}>
                <Container maxWidth="lg">
                    <Box sx={{ display: 'grid',
                        gridTemplateColumns: 'repeat(auto-fit,minmax(130px,1fr))', gap: 4 }}>
                        {stats.map(s => (
                            <Box key={s.label} sx={{ textAlign: 'center' }}>
                                <Typography sx={{ fontFamily: '"Syne","Impact",sans-serif',
                                    fontWeight: 900, fontSize: '2.6rem', color: C.green, lineHeight: 1 }}>
                                    {s.n}
                                </Typography>
                                <Typography sx={{ fontSize: 11, fontWeight: 700, opacity: .5,
                                    letterSpacing: 1.5, textTransform: 'uppercase', mt: .75 }}>
                                    {s.label}
                                </Typography>
                            </Box>
                        ))}
                    </Box>
                </Container>
            </Box>

            {/* ── ROLE ACCESS ─────────────────────────────── */}
            <Box id="access" sx={{ py: { xs: 8, md: 12 }, position: 'relative', overflow: 'hidden' }}>
                <DotGrid />
                {/* ghost watermark */}
                <Typography sx={{ position: 'absolute', top: '50%', left: '-2%',
                    transform: 'translateY(-50%)',
                    fontFamily: '"Syne","Impact",sans-serif', fontWeight: 900,
                    fontSize: '18vw', opacity: .03, lineHeight: 1,
                    pointerEvents: 'none', userSelect: 'none', color: C.navy }}>07</Typography>

                <Container maxWidth="lg" sx={{ position: 'relative' }}>
                    <Box sx={{ mb: 5 }}>
                        <Tag sx={{ mb: 2 }}>Staff Access</Tag>
                        <Typography sx={{ fontFamily: '"Syne","Impact",sans-serif', fontWeight: 900,
                            fontSize: { xs: '1.8rem', md: '2.6rem' }, letterSpacing: '-.02em' }}>
                            Who signs in?
                        </Typography>
                        <Typography sx={{ mt: 1.5, opacity: .55, fontSize: 14 }}>
                            Accounts are issued by the system administrator — no self-registration.
                        </Typography>
                    </Box>

                    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1.5 }}>
                        {roles.map((r, i) => {
                            const Icon = r.icon;
                            return (
                                <RoleChip key={r.label} component={RouterLink} to="/login"
                                    sx={{ animation: `${fadeUp} .4s ease ${i * .06}s both` }}>
                                    <Icon sx={{ fontSize: 16, opacity: .7 }} />
                                    <Typography sx={{ fontSize: 13, fontWeight: 700 }}>{r.label}</Typography>
                                </RoleChip>
                            );
                        })}
                    </Box>

                    {/* CTA card — flat, dashed border, no gradient */}
                    <Box sx={{ mt: 8, p: { xs: 4, md: 6 }, borderRadius: 3,
                        border: `2px dashed ${dark ? 'rgba(255,255,255,.12)' : 'rgba(0,0,0,.12)'}`,
                        position: 'relative', overflow: 'hidden' }}>
                        {/* sticker */}
                        <Box sx={{ position: 'absolute', top: -13, right: 28,
                            bgcolor: C.green, color: C.charcoal, fontWeight: 900,
                            fontSize: 10, px: 1.5, py: .4, borderRadius: 1,
                            fontFamily: '"Courier New",monospace', letterSpacing: 1.5,
                            textTransform: 'uppercase',
                            animation: `${wiggle} 3s ease-in-out infinite` }}>
                            Staff Only
                        </Box>
                        <Box sx={{ display: 'grid',
                            gridTemplateColumns: { xs: '1fr', md: '1fr auto' },
                            gap: 3, alignItems: 'center' }}>
                            <Box>
                                <Typography sx={{ fontFamily: '"Syne","Impact",sans-serif',
                                    fontWeight: 900, fontSize: { xs: '1.4rem', md: '1.9rem' },
                                    letterSpacing: '-.02em', mb: 1 }}>
                                    Ready to sign in?
                                </Typography>
                                <Typography sx={{ opacity: .6, fontSize: 14, lineHeight: 1.7 }}>
                                    Use your school-issued email and password, your linked Telegram
                                    account, or your verified Gmail address.
                                </Typography>
                            </Box>
                            <Button component={RouterLink} to={isAuthenticated ? '/app' : '/login'}
                                variant="contained" size="large"
                                sx={{ fontWeight: 800, px: 4, py: 1.75, borderRadius: 2,
                                    whiteSpace: 'nowrap', fontSize: 15,
                                    bgcolor: C.navy, color: '#fff',
                                    border: `2px solid ${C.navy}`,
                                    '&:hover': { bgcolor: C.green, color: C.charcoal, borderColor: C.green } }}>
                                {isAuthenticated ? 'Dashboard' : 'Sign In'} →
                            </Button>
                        </Box>
                    </Box>
                </Container>
            </Box>

            {/* ── FOOTER ──────────────────────────────────── */}
            <Box sx={{ py: 4, borderTop: `1.5px solid ${border}`,
                bgcolor: dark ? C.dark2 : '#fff' }}>
                <Container maxWidth="lg">
                    <Box sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center',
                        justifyContent: 'space-between', gap: 2 }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                            <Box sx={{ width: 5, height: 22, borderRadius: 1, bgcolor: C.green }} />
                            <Typography sx={{ fontWeight: 800, fontSize: 13 }}>BIS NOC Gerji</Typography>
                        </Box>
                        <Typography sx={{ fontSize: 12, opacity: .4, textAlign: 'center' }}>
                            &copy; {new Date().getFullYear()} British International School, NOC Gerji Campus
                            &nbsp;·&nbsp; Internal Staff Use Only
                        </Typography>
                        <Button component={RouterLink} to="/data-center" size="small"
                            sx={{ fontSize: 12, color: C.cyan, fontWeight: 700,
                                '&:hover': { color: C.green, bgcolor: 'transparent' } }}>
                            Public Data Center →
                        </Button>
                    </Box>
                </Container>
            </Box>

        </Box>
    );
}
