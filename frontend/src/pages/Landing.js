import { Link as RouterLink } from 'react-router-dom';
import { Box, Button, Container, Typography, useTheme } from '@mui/material';
import { styled, keyframes } from '@mui/material/styles';
import LoginIcon from '@mui/icons-material/Login';
import AdminPanelSettingsIcon from '@mui/icons-material/AdminPanelSettings';
import SchoolIcon from '@mui/icons-material/School';
import LocalHospitalIcon from '@mui/icons-material/LocalHospital';
import StorefrontIcon from '@mui/icons-material/Storefront';
import LocalLibraryIcon from '@mui/icons-material/LocalLibrary';
import StorageIcon from '@mui/icons-material/Storage';
import LightModeIcon from '@mui/icons-material/LightMode';
import DarkModeIcon from '@mui/icons-material/DarkMode';
import { useAuth } from '../auth/AuthContext';
import { useColorScheme } from '../theme';

/* ── palette ─────────────────────────────────────────────── */
const C = {
    magenta: '#FF2E93',
    purple:  '#7A20DF',
    teal:    '#00F0A8',
    offWhite:'#F7F6F2',
    charcoal:'#1E1E24',
    dark2:   '#14141A',
};

/* ── keyframes ───────────────────────────────────────────── */
const marqueeAnim = keyframes`from{transform:translateX(0)}to{transform:translateX(-50%)}`;
const fadeUp      = keyframes`from{opacity:0;transform:translateY(28px)}to{opacity:1;transform:translateY(0)}`;
const wiggle      = keyframes`0%,100%{transform:rotate(-3deg)}50%{transform:rotate(3deg)}`;
const pulse       = keyframes`0%,100%{opacity:1}50%{opacity:.5}`;

/* ── reusable styled bits ────────────────────────────────── */
const Squiggle = styled('svg')({ flexShrink: 0 });

const Tag = styled(Box)(({ accent }) => ({
    display: 'inline-flex',
    alignItems: 'center',
    fontFamily: '"Courier New", monospace',
    fontWeight: 700,
    fontSize: 11,
    letterSpacing: 1,
    padding: '3px 10px',
    border: `1.5px solid ${accent === 'teal' ? C.teal : accent === 'purple' ? C.purple : C.magenta}`,
    color:  accent === 'teal' ? C.teal : accent === 'purple' ? C.purple : C.magenta,
    borderRadius: 4,
    textTransform: 'uppercase',
    whiteSpace: 'nowrap',
}));

const FeatureCard = styled(Box)(({ theme, accent }) => ({
    position: 'relative',
    borderRadius: 16,
    padding: '28px 24px',
    border: `2px solid ${accent === 'teal' ? C.teal : accent === 'purple' ? C.purple : C.magenta}`,
    background: theme.palette.mode === 'dark' ? 'rgba(30,30,38,0.85)' : '#fff',
    transition: 'transform .25s ease, box-shadow .25s ease',
    cursor: 'default',
    overflow: 'hidden',
    '&:hover': {
        transform: 'scale(1.025)',
        boxShadow: `0 12px 40px ${
            accent === 'teal' ? 'rgba(0,240,168,.25)' :
            accent === 'purple' ? 'rgba(122,32,223,.25)' :
            'rgba(255,46,147,.25)'
        }`,
    },
}));

const RoleChip = styled(Box)(({ theme }) => ({
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    padding: '10px 18px',
    borderRadius: 12,
    border: `1.5px solid ${theme.palette.mode === 'dark' ? 'rgba(255,255,255,.12)' : 'rgba(0,0,0,.1)'}`,
    background: theme.palette.mode === 'dark' ? 'rgba(255,255,255,.05)' : 'rgba(0,0,0,.03)',
    fontWeight: 600,
    fontSize: 13,
    cursor: 'pointer',
    transition: 'all .2s',
    textDecoration: 'none',
    color: 'inherit',
    '&:hover': {
        borderColor: C.magenta,
        background: 'rgba(255,46,147,.08)',
        transform: 'translateY(-2px)',
    },
}));

/* dot-grid background pattern */
const DotGrid = styled(Box)(({ theme }) => ({
    position: 'absolute', inset: 0, pointerEvents: 'none',
    backgroundImage: `radial-gradient(${
        theme.palette.mode === 'dark' ? 'rgba(255,255,255,.06)' : 'rgba(0,0,0,.07)'
    } 1px, transparent 1px)`,
    backgroundSize: '22px 22px',
}));

/* ── data ────────────────────────────────────────────────── */
const features = [
    {
        tag: '[01] Academics', accent: 'magenta',
        title: 'Classes & Timetable',
        body: 'Manage homeroom classes, subject assignments, and the full weekly timetable grid with clash detection.',
        icon: SchoolIcon,
    },
    {
        tag: '[02] People', accent: 'purple',
        title: 'Students & Staff',
        body: 'Full student profiles, guardian records, special-needs flags, class placement and staff workload reports.',
        icon: AdminPanelSettingsIcon,
    },
    {
        tag: '[03] Health', accent: 'teal',
        title: 'Clinic & Attendance',
        body: 'Medical visit logs, leave approvals, per-subject and homeroom attendance registers in one place.',
        icon: LocalHospitalIcon,
    },
    {
        tag: '[04] Resources', accent: 'magenta',
        title: 'Library & Store',
        body: 'Book loans, overdue fines, and class resource requisitions with a full approval workflow.',
        icon: LocalLibraryIcon,
    },
    {
        tag: '[05] Planning', accent: 'purple',
        title: 'Lessons & Calendar',
        body: 'Termly schemes of work, weekly lesson plans, exam dates, holidays and school events.',
        icon: StorageIcon,
    },
    {
        tag: '[06] Communication', accent: 'teal',
        title: 'Notices & Messages',
        body: 'Targeted announcements with read receipts, threaded staff messages, and assignable action tasks.',
        icon: StorefrontIcon,
    },
];

const roles = [
    { label: 'Admin',         icon: AdminPanelSettingsIcon },
    { label: 'Main Teacher',  icon: SchoolIcon },
    { label: 'Asst. Teacher', icon: SchoolIcon },
    { label: 'Subject Teacher', icon: SchoolIcon },
    { label: 'Clinic',        icon: LocalHospitalIcon },
    { label: 'Store Manager', icon: StorefrontIcon },
    { label: 'Library',       icon: LocalLibraryIcon },
];

const ticker = '★ ATTENDANCE  ·  TIMETABLE  ·  LESSON PLANS  ·  LIBRARY  ·  CLINIC  ·  MARKSHEETS  ·  NOTICES  ·  STORE  ·  CALENDAR  ·  ASSIGNMENTS  ·  MESSAGES  ·  DATA CENTER  ·  ';

/* ── component ───────────────────────────────────────────── */
export default function Landing() {
    const { isAuthenticated } = useAuth();
    const { toggleColorScheme } = useColorScheme();
    const theme = useTheme();
    const dark = theme.palette.mode === 'dark';

    return (
        <Box sx={{ minHeight: '100vh', display: 'flex', flexDirection: 'column',
            bgcolor: dark ? C.charcoal : C.offWhite, color: dark ? '#F7F6F2' : C.charcoal,
            fontFamily: '"Inter", "Plus Jakarta Sans", sans-serif', overflowX: 'hidden' }}>

            {/* ── NAV ─────────────────────────────────────────── */}
            <Box component="nav" sx={{
                position: 'sticky', top: 0, zIndex: 100,
                borderBottom: `2px solid ${dark ? 'rgba(255,255,255,.07)' : 'rgba(0,0,0,.08)'}`,
                bgcolor: dark ? 'rgba(20,20,26,.92)' : 'rgba(247,246,242,.92)',
                backdropFilter: 'blur(12px)',
            }}>
                <Container maxWidth="xl">
                    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                        minHeight: 64, gap: 2 }}>
                        {/* logo */}
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <Box sx={{ width: 8, height: 32, borderRadius: 1,
                                background: `linear-gradient(180deg,${C.magenta},${C.purple})` }} />
                            <Box>
                                <Typography sx={{ fontWeight: 900, fontSize: 15, lineHeight: 1.1,
                                    letterSpacing: '-.01em' }}>BIS NOC</Typography>
                                <Typography sx={{ fontSize: 10, fontWeight: 600, color: C.teal,
                                    letterSpacing: 2, textTransform: 'uppercase' }}>Gerji Campus</Typography>
                            </Box>
                        </Box>
                        {/* links */}
                        <Box sx={{ display: { xs: 'none', md: 'flex' }, gap: 3, alignItems: 'center' }}>
                            {['Features', 'Modules', 'Access'].map(l => (
                                <Typography key={l} component="a" href={`#${l.toLowerCase()}`}
                                    sx={{ fontSize: 13, fontWeight: 600, textDecoration: 'none',
                                        color: 'inherit', opacity: .7,
                                        '&:hover': { opacity: 1, color: C.magenta }, transition: 'all .2s' }}>
                                    {l}
                                </Typography>
                            ))}
                        </Box>
                        {/* right controls */}
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                            <Box onClick={toggleColorScheme} sx={{
                                display: 'flex', alignItems: 'center', gap: .5,
                                px: 1.5, py: .75, borderRadius: 20,
                                border: `1.5px solid ${dark ? 'rgba(255,255,255,.15)' : 'rgba(0,0,0,.12)'}`,
                                cursor: 'pointer', fontSize: 12, fontWeight: 600,
                                '&:hover': { borderColor: C.magenta },
                            }}>
                                {dark ? <LightModeIcon sx={{ fontSize: 15 }} /> : <DarkModeIcon sx={{ fontSize: 15 }} />}
                                {dark ? 'Light' : 'Dark'}
                            </Box>
                            <Button component={RouterLink} to={isAuthenticated ? '/app' : '/login'}
                                variant="contained" size="small" startIcon={<LoginIcon />}
                                sx={{ fontWeight: 700, borderRadius: 20, px: 2.5,
                                    background: `linear-gradient(135deg,${C.magenta},${C.purple})`,
                                    '&:hover': { background: `linear-gradient(135deg,${C.purple},${C.magenta})` } }}>
                                {isAuthenticated ? 'Dashboard' : 'Sign In'}
                            </Button>
                        </Box>
                    </Box>
                </Container>
            </Box>

            {/* ── TICKER ──────────────────────────────────────── */}
            <Box sx={{ overflow: 'hidden', bgcolor: C.magenta, py: .6, userSelect: 'none' }}>
                <Box sx={{ display: 'flex', animation: `${marqueeAnim} 22s linear infinite`, width: 'max-content' }}>
                    {[ticker, ticker].map((t, i) => (
                        <Typography key={i} sx={{ whiteSpace: 'nowrap', fontSize: 11, fontWeight: 700,
                            letterSpacing: 2, color: '#fff', px: 2 }}>{t}</Typography>
                    ))}
                </Box>
            </Box>

            {/* ── HERO ────────────────────────────────────────── */}
            <Box sx={{ position: 'relative', overflow: 'hidden',
                pt: { xs: 8, md: 12 }, pb: { xs: 8, md: 14 } }}>
                <DotGrid />

                {/* decorative blobs */}
                <Box sx={{ position: 'absolute', top: -80, right: -80, width: 400, height: 400,
                    borderRadius: '50%', background: `radial-gradient(circle,${C.purple}33,transparent 70%)`,
                    pointerEvents: 'none' }} />
                <Box sx={{ position: 'absolute', bottom: -60, left: -60, width: 300, height: 300,
                    borderRadius: '50%', background: `radial-gradient(circle,${C.teal}22,transparent 70%)`,
                    pointerEvents: 'none' }} />

                {/* zigzag accent top-left */}
                <Squiggle width="120" height="24" viewBox="0 0 120 24"
                    sx={{ position: 'absolute', top: 28, left: 32, opacity: .5,
                        display: { xs: 'none', md: 'block' } }}>
                    <polyline points="0,12 15,0 30,12 45,0 60,12 75,0 90,12 105,0 120,12"
                        fill="none" stroke={C.magenta} strokeWidth="3" strokeLinecap="round"/>
                </Squiggle>

                <Container maxWidth="lg" sx={{ position: 'relative' }}>
                    <Box sx={{ maxWidth: 720, animation: `${fadeUp} .7s ease both` }}>
                        <Tag accent="teal" sx={{ mb: 3 }}>Est. 1998 · NOC Gerji Campus</Tag>
                        <Typography component="h1" sx={{
                            fontFamily: '"Syne","Righteous","Impact","Arial Black",sans-serif',
                            fontSize: { xs: '2.6rem', sm: '3.8rem', md: '5rem' },
                            fontWeight: 900, lineHeight: 1.0, letterSpacing: '-.03em', mb: 3,
                        }}>
                            School Life{' '}
                            <Box component="span" sx={{
                                background: `linear-gradient(135deg,${C.magenta},${C.purple})`,
                                WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
                            }}>
                                in Full Color
                            </Box>
                        </Typography>
                        <Typography sx={{ fontSize: { xs: '1rem', md: '1.15rem' }, lineHeight: 1.75,
                            opacity: .7, maxWidth: 540, mb: 5 }}>
                            The all-in-one staff portal for British International School — covering
                            teaching, attendance, planning, health, library, and more.
                        </Typography>
                        <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
                            <Button component={RouterLink} to={isAuthenticated ? '/app' : '/login'}
                                variant="contained" size="large"
                                sx={{ fontWeight: 800, px: 4, py: 1.5, borderRadius: 20, fontSize: 15,
                                    background: `linear-gradient(135deg,${C.magenta},${C.purple})`,
                                    boxShadow: `0 8px 32px ${C.magenta}55`,
                                    '&:hover': { transform: 'translateY(-2px)',
                                        boxShadow: `0 14px 40px ${C.magenta}77` } }}>
                                {isAuthenticated ? 'Go to Dashboard' : 'Staff Sign In'} →
                            </Button>
                            <Button component={RouterLink} to="/data-center" variant="outlined"
                                size="large" sx={{ fontWeight: 700, px: 3, py: 1.5, borderRadius: 20,
                                    fontSize: 15, borderColor: C.teal, color: C.teal,
                                    '&:hover': { borderColor: C.teal, bgcolor: `${C.teal}15` } }}>
                                Data Center (Public)
                            </Button>
                        </Box>
                    </Box>
                </Container>
            </Box>

            {/* ── STATS STRIP ─────────────────────────────────── */}
            <Box sx={{ borderTop: `2px solid ${dark?'rgba(255,255,255,.07)':'rgba(0,0,0,.07)'}`,
                borderBottom: `2px solid ${dark?'rgba(255,255,255,.07)':'rgba(0,0,0,.07)'}`,
                py: 4, bgcolor: dark ? 'rgba(255,255,255,.03)' : 'rgba(0,0,0,.02)' }}>
                <Container maxWidth="lg">
                    <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(140px,1fr))', gap: 3 }}>
                        {[
                            { n: '17', label: 'Modules', accent: C.magenta },
                            { n: '174', label: 'Backend Tests', accent: C.purple },
                            { n: '7', label: 'Staff Roles', accent: C.teal },
                            { n: '∞', label: 'Student Records', accent: C.magenta },
                        ].map(s => (
                            <Box key={s.label} sx={{ textAlign: 'center' }}>
                                <Typography sx={{ fontFamily: '"Syne","Impact",sans-serif', fontWeight: 900,
                                    fontSize: '2.4rem', color: s.accent, lineHeight: 1 }}>{s.n}</Typography>
                                <Typography sx={{ fontSize: 12, fontWeight: 600, opacity: .6,
                                    letterSpacing: 1, textTransform: 'uppercase', mt: .5 }}>{s.label}</Typography>
                            </Box>
                        ))}
                    </Box>
                </Container>
            </Box>

            {/* ── FEATURE GRID ────────────────────────────────── */}
            <Box id="features" sx={{ py: { xs: 8, md: 12 }, position: 'relative', overflow: 'hidden' }}>
                <DotGrid />
                <Container maxWidth="lg" sx={{ position: 'relative' }}>
                    <Box sx={{ mb: 6 }}>
                        <Tag accent="purple" sx={{ mb: 2 }}>Platform Modules</Tag>
                        <Typography sx={{ fontFamily: '"Syne","Impact",sans-serif', fontWeight: 900,
                            fontSize: { xs: '1.8rem', md: '2.8rem' }, letterSpacing: '-.02em' }}>
                            Everything a school needs.
                        </Typography>
                    </Box>
                    <Box sx={{ display: 'grid',
                        gridTemplateColumns: { xs: '1fr', sm: 'repeat(2,1fr)', md: 'repeat(3,1fr)' },
                        gap: 3 }}>
                        {features.map((f, i) => {
                            const Icon = f.icon;
                            return (
                                <FeatureCard key={f.tag} accent={f.accent}
                                    sx={{ animation: `${fadeUp} .5s ease ${i * .08}s both` }}>
                                    {/* corner dot grid */}
                                    <Box sx={{ position: 'absolute', top: 12, right: 14, opacity: .25 }}>
                                        {[0,1,2].map(r => (
                                            <Box key={r} sx={{ display: 'flex', gap: '5px', mb: '5px' }}>
                                                {[0,1,2].map(c => (
                                                    <Box key={c} sx={{ width: 3, height: 3, borderRadius: '50%',
                                                        bgcolor: f.accent === 'teal' ? C.teal : f.accent === 'purple' ? C.purple : C.magenta }} />
                                                ))}
                                            </Box>
                                        ))}
                                    </Box>
                                    <Tag accent={f.accent} sx={{ mb: 2 }}>{f.tag}</Tag>
                                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 1.5 }}>
                                        <Icon sx={{ fontSize: 22, color: f.accent === 'teal' ? C.teal : f.accent === 'purple' ? C.purple : C.magenta }} />
                                        <Typography sx={{ fontWeight: 800, fontSize: '1.05rem' }}>{f.title}</Typography>
                                    </Box>
                                    <Typography sx={{ fontSize: 13.5, lineHeight: 1.65, opacity: .65 }}>{f.body}</Typography>
                                </FeatureCard>
                            );
                        })}
                    </Box>
                </Container>
            </Box>

            {/* ── VISION SPLIT ────────────────────────────────── */}
            <Box id="modules" sx={{
                borderTop: `2px solid ${dark?'rgba(255,255,255,.07)':'rgba(0,0,0,.07)'}`,
                py: { xs: 8, md: 12 },
                background: dark
                    ? `linear-gradient(135deg,${C.dark2} 0%,rgba(122,32,223,.12) 100%)`
                    : `linear-gradient(135deg,#fff 0%,rgba(122,32,223,.05) 100%)`,
            }}>
                <Container maxWidth="lg">
                    <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' },
                        gap: { xs: 6, md: 10 }, alignItems: 'center' }}>
                        {/* left — bold typographic block */}
                        <Box>
                            <Box sx={{ display: 'inline-block', p: 4,
                                border: `3px solid ${C.magenta}`, borderRadius: 4,
                                position: 'relative' }}>
                                {/* zigzag corner */}
                                <Squiggle width="60" height="14" viewBox="0 0 60 14"
                                    sx={{ position: 'absolute', top: -8, right: 16 }}>
                                    <polyline points="0,7 10,0 20,7 30,0 40,7 50,0 60,7"
                                        fill="none" stroke={C.teal} strokeWidth="3" strokeLinecap="round"/>
                                </Squiggle>
                                <Typography sx={{ fontFamily: '"Syne","Impact",sans-serif', fontWeight: 900,
                                    fontSize: { xs: '2.2rem', md: '3rem' }, lineHeight: 1.1,
                                    letterSpacing: '-.02em' }}>
                                    Built for
                                    <Box component="span" sx={{ display: 'block', color: C.magenta }}>
                                        every role.
                                    </Box>
                                </Typography>
                                <Typography sx={{ mt: 2, fontSize: 13, fontFamily: '"Courier New",monospace',
                                    color: C.teal, fontWeight: 700, letterSpacing: 1 }}>
                                    ADMIN · TEACHER · CLINIC · STORE
                                </Typography>
                            </Box>
                        </Box>
                        {/* right — prose */}
                        <Box>
                            <Typography sx={{ fontSize: '1.4rem', fontWeight: 800, lineHeight: 1.3,
                                mb: 2, letterSpacing: '-.01em' }}>
                                One portal. Every person on campus.
                            </Typography>
                            <Typography sx={{ fontSize: '1rem', lineHeight: 1.8, opacity: .7, mb: 3 }}>
                                From the system administrator down to the store manager, every staff
                                member gets a role-specific view of exactly what they need — nothing
                                more, nothing less. Row-level security enforces this right at the
                                database level.
                            </Typography>
                            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                                {['Role-based access on every route', 'Real-time data from Supabase Postgres',
                                  'Secure JWT sessions · Telegram sign-in', 'Gmail OTP passwordless login'].map(t => (
                                    <Box key={t} sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                                        <Box sx={{ width: 8, height: 8, borderRadius: '50%',
                                            bgcolor: C.teal, flexShrink: 0,
                                            animation: `${pulse} 2s ease infinite` }} />
                                        <Typography sx={{ fontSize: 13.5, fontWeight: 500 }}>{t}</Typography>
                                    </Box>
                                ))}
                            </Box>
                        </Box>
                    </Box>
                </Container>
            </Box>

            {/* ── ROLE ACCESS GRID ─────────────────────────────── */}
            <Box id="access" sx={{ py: { xs: 8, md: 12 }, position: 'relative', overflow: 'hidden' }}>
                <DotGrid />
                {/* large decorative number */}
                <Typography sx={{ position: 'absolute', top: '50%', left: '-3%', transform: 'translateY(-50%)',
                    fontFamily: '"Syne","Impact",sans-serif', fontWeight: 900, fontSize: '20vw',
                    opacity: .03, lineHeight: 1, pointerEvents: 'none', userSelect: 'none' }}>07</Typography>
                <Container maxWidth="lg" sx={{ position: 'relative' }}>
                    <Box sx={{ mb: 6 }}>
                        <Tag accent="magenta" sx={{ mb: 2 }}>Staff Access</Tag>
                        <Typography sx={{ fontFamily: '"Syne","Impact",sans-serif', fontWeight: 900,
                            fontSize: { xs: '1.8rem', md: '2.8rem' }, letterSpacing: '-.02em' }}>
                            Who signs in?
                        </Typography>
                        <Typography sx={{ mt: 1.5, opacity: .6, fontSize: 14, maxWidth: 460 }}>
                            Accounts are issued by the system administrator — no self-registration.
                        </Typography>
                    </Box>
                    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2 }}>
                        {roles.map((r, i) => {
                            const Icon = r.icon;
                            const colors = [C.magenta, C.purple, C.teal];
                            const c = colors[i % 3];
                            return (
                                <RoleChip key={r.label} component={RouterLink} to="/login"
                                    sx={{ animation: `${fadeUp} .4s ease ${i * .06}s both`,
                                        '&:hover': { borderColor: c, background: `${c}15` } }}>
                                    <Icon sx={{ fontSize: 17, color: c }} />
                                    <Typography sx={{ fontSize: 13, fontWeight: 700 }}>{r.label}</Typography>
                                </RoleChip>
                            );
                        })}
                    </Box>
                    {/* CTA card */}
                    <Box sx={{ mt: 8, p: { xs: 4, md: 6 }, borderRadius: 4,
                        background: `linear-gradient(135deg,${C.magenta}22,${C.purple}22)`,
                        border: `2px dashed ${C.purple}66`, position: 'relative', overflow: 'hidden' }}>
                        {/* sticker */}
                        <Box sx={{ position: 'absolute', top: -14, right: 32,
                            bgcolor: C.teal, color: C.charcoal, fontWeight: 900,
                            fontSize: 11, px: 2, py: .4, borderRadius: 1,
                            fontFamily: '"Courier New",monospace', letterSpacing: 1,
                            textTransform: 'uppercase',
                            animation: `${wiggle} 3s ease-in-out infinite` }}>
                            Staff Only
                        </Box>
                        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr auto' },
                            gap: 3, alignItems: 'center' }}>
                            <Box>
                                <Typography sx={{ fontFamily: '"Syne","Impact",sans-serif', fontWeight: 900,
                                    fontSize: { xs: '1.5rem', md: '2rem' }, letterSpacing: '-.02em', mb: 1 }}>
                                    Ready to sign in?
                                </Typography>
                                <Typography sx={{ opacity: .65, fontSize: 14, lineHeight: 1.7 }}>
                                    Use your school-issued email and password, your linked Telegram account,
                                    or your verified Gmail address.
                                </Typography>
                            </Box>
                            <Button component={RouterLink} to={isAuthenticated ? '/app' : '/login'}
                                variant="contained" size="large"
                                sx={{ fontWeight: 800, px: 4, py: 1.75, borderRadius: 20,
                                    whiteSpace: 'nowrap', fontSize: 15,
                                    background: `linear-gradient(135deg,${C.magenta},${C.purple})`,
                                    boxShadow: `0 8px 32px ${C.magenta}55`,
                                    '&:hover': { transform: 'translateY(-2px)',
                                        boxShadow: `0 16px 40px ${C.magenta}77` } }}>
                                {isAuthenticated ? 'Go to Dashboard' : 'Sign In'} →
                            </Button>
                        </Box>
                    </Box>
                </Container>
            </Box>

            {/* ── FOOTER ──────────────────────────────────────── */}
            <Box sx={{ py: 4, borderTop: `2px solid ${dark?'rgba(255,255,255,.07)':'rgba(0,0,0,.08)'}`,
                bgcolor: dark ? C.dark2 : '#fff' }}>
                <Container maxWidth="lg">
                    <Box sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center',
                        justifyContent: 'space-between', gap: 2 }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <Box sx={{ width: 6, height: 24, borderRadius: 1,
                                background: `linear-gradient(180deg,${C.magenta},${C.purple})` }} />
                            <Typography sx={{ fontWeight: 800, fontSize: 13 }}>BIS NOC Gerji</Typography>
                        </Box>
                        <Typography sx={{ fontSize: 12, opacity: .45, textAlign: 'center' }}>
                            &copy; {new Date().getFullYear()} British International School, NOC Gerji Campus
                            &nbsp;·&nbsp; Internal Staff Use Only
                        </Typography>
                        <Button component={RouterLink} to="/data-center" size="small"
                            sx={{ fontSize: 12, color: C.teal, fontWeight: 700,
                                '&:hover': { background: `${C.teal}15` } }}>
                            Public Data Center →
                        </Button>
                    </Box>
                </Container>
            </Box>

        </Box>
    );
}
