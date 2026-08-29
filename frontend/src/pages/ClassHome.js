import { Link as RouterLink, useNavigate, useParams, Navigate } from 'react-router-dom';
import {
    Box, Button, Card, CardContent, Chip, Container, Grid, Typography, useTheme,
} from '@mui/material';
import { alpha } from '@mui/material/styles';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import LogoutIcon from '@mui/icons-material/Logout';
import LightModeIcon from '@mui/icons-material/LightMode';
import DarkModeIcon from '@mui/icons-material/DarkMode';
import SchoolIcon from '@mui/icons-material/School';
import GroupsIcon from '@mui/icons-material/Groups';
import PersonIcon from '@mui/icons-material/Person';
import FactCheckIcon from '@mui/icons-material/FactCheck';
import CalendarMonthIcon from '@mui/icons-material/CalendarMonth';
import GradeIcon from '@mui/icons-material/Grade';
import MenuBookOutlinedIcon from '@mui/icons-material/MenuBookOutlined';
import { useColorScheme } from '../theme';
import {
    classBySlug, readClassLogin, clearClassLogin,
} from '../data/classes';

/*
 * Per-class main-teacher home — where the class-card login lands.
 *
 * Guarded by the demo-stage class session saved at login time. This gate is
 * intentionally simple while the real sign-in system is redesigned; it gives
 * each main teacher their own door (password = class name) and a place that
 * will grow into their class workspace.
 */

function InfoRow({ icon, label, value }) {
    return (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.2 }}>
            {icon}
            <Box>
                <Typography sx={{ fontSize: 11, fontWeight: 700, color: 'text.secondary',
                    textTransform: 'uppercase', letterSpacing: .5 }}>
                    {label}
                </Typography>
                <Typography sx={{ fontSize: 14, fontWeight: 600 }}>{value}</Typography>
            </Box>
        </Box>
    );
}

function ToolCard({ icon, title, desc, href, soon }) {
    const theme = useTheme();
    const dark = theme.palette.mode === 'dark';
    const surface = dark ? theme.palette.background.paper : '#ffffff';
    const border = dark ? theme.palette.divider : '#e2e8f0';

    const inner = (
        <CardContent sx={{ p: 2.5, height: '100%', opacity: soon ? 0.72 : 1 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.2, mb: 1.2 }}>
                <Box sx={{ width: 38, height: 38, borderRadius: 1,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    bgcolor: alpha(theme.palette.primary.main, 0.1), color: 'primary.main' }}>
                    {icon}
                </Box>
                <Typography sx={{ fontWeight: 800, fontSize: 15 }}>{title}</Typography>
                {soon && (
                    <Chip label="Coming soon" size="small"
                        sx={{ ml: 'auto', fontWeight: 700, borderRadius: 1, fontSize: 10.5,
                            bgcolor: alpha(theme.palette.warning.main, 0.14), color: 'warning.main' }} />
                )}
            </Box>
            <Typography sx={{ fontSize: 13, color: 'text.secondary' }}>{desc}</Typography>
        </CardContent>
    );

    const sx = { height: '100%', borderRadius: 1, bgcolor: surface, borderColor: border,
        textDecoration: 'none', color: 'inherit', display: 'block',
        transition: 'transform .18s, border-color .18s',
        ...(soon ? {} : { '&:hover': { transform: 'translateY(-3px)', borderColor: 'primary.main' } }) };

    return soon
        ? <Card variant="outlined" sx={sx}>{inner}</Card>
        : <Card variant="outlined" component={RouterLink} to={href} sx={sx}>{inner}</Card>;
}

export default function ClassHome() {
    const { slug } = useParams();
    const theme = useTheme();
    const dark = theme.palette.mode === 'dark';
    const { toggleColorScheme } = useColorScheme();
    const navigate = useNavigate();
    const surface = dark ? theme.palette.background.paper : '#ffffff';
    const border = dark ? theme.palette.divider : '#e2e8f0';

    const klass = classBySlug(slug);
    const session = readClassLogin();

    // No session, or a session for a different class — back to the directory.
    if (!klass || !session || session.slug !== slug) {
        return <Navigate to="/classes" replace />;
    }

    const signOut = () => {
        clearClassLogin();
        navigate('/classes');
    };

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
                            <Button component={RouterLink} to="/classes" size="small"
                                startIcon={<ArrowBackIcon />}
                                sx={{ fontWeight: 700, borderRadius: 1, textTransform: 'none',
                                    color: 'text.secondary', '&:hover': { color: 'primary.main' } }}>
                                Classes
                            </Button>
                            <Box sx={{ width: 1, height: 26, bgcolor: border }} />
                            <Box sx={{ width: 38, height: 38, borderRadius: 1, bgcolor: 'primary.main',
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
                            <Box onClick={toggleColorScheme} sx={{ display: 'flex', alignItems: 'center',
                                justifyContent: 'center', width: 38, height: 38, borderRadius: 1,
                                border: `1px solid ${border}`, cursor: 'pointer', color: 'text.secondary',
                                '&:hover': { color: 'primary.main', borderColor: 'primary.main' } }}
                                aria-label="Toggle theme">
                                {dark
                                    ? <LightModeIcon sx={{ fontSize: 18 }} />
                                    : <DarkModeIcon  sx={{ fontSize: 18 }} />}
                            </Box>
                            <Button onClick={signOut} variant="outlined" size="small"
                                startIcon={<LogoutIcon />}
                                sx={{ fontWeight: 700, borderRadius: 1, px: 2.5, textTransform: 'none' }}>
                                Sign Out
                            </Button>
                        </Box>
                    </Box>
                </Container>
            </Box>

            {/* ── content ── */}
            <Container maxWidth="lg" sx={{ py: { xs: 6, md: 8 } }}>
                {/* welcome */}
                <Box sx={{ mb: { xs: 5, md: 6 } }}>
                    <Chip label={`Year ${klass.yearLevel} homeroom`} size="small"
                        sx={{ fontWeight: 700, borderRadius: 1, mb: 1.5,
                            bgcolor: alpha(theme.palette.primary.main, 0.1), color: 'primary.main' }} />
                    <Typography variant="h3" sx={{ fontWeight: 800, letterSpacing: '-.02em' }}>
                        Welcome, {klass.mainTeacher}
                    </Typography>
                    <Typography sx={{ mt: 1, color: 'text.secondary' }}>
                        Main Teacher · {klass.name} — this is your class space. More of your
                        classroom tools arrive here as the year rolls out.
                    </Typography>
                </Box>

                <Grid container spacing={2.5}>
                    {/* class overview */}
                    <Grid item xs={12} md={4}>
                        <Card variant="outlined" sx={{ height: '100%', borderRadius: 1, bgcolor: surface,
                            borderColor: border }}>
                            <CardContent sx={{ p: 3, display: 'flex', flexDirection: 'column', gap: 2 }}>
                                <Typography sx={{ fontWeight: 800, fontSize: 16 }}>Your class</Typography>
                                <InfoRow icon={<SchoolIcon sx={{ fontSize: 18, color: 'text.secondary' }} />}
                                    label="Class" value={klass.name} />
                                <InfoRow icon={<GroupsIcon sx={{ fontSize: 18, color: 'text.secondary' }} />}
                                    label="Students" value={`${klass.studentCount} enrolled`} />
                                <InfoRow icon={<PersonIcon sx={{ fontSize: 18, color: 'text.secondary' }} />}
                                    label="Assistant Teacher" value={klass.assistantTeacher || 'Not assigned'} />
                            </CardContent>
                        </Card>
                    </Grid>

                    {/* tools */}
                    <Grid item xs={12} md={8}>
                        <Typography sx={{ fontWeight: 800, fontSize: 16, mb: 1.5 }}>
                            Your classroom tools
                        </Typography>
                        <Grid container spacing={2}>
                            <Grid item xs={12} sm={6}>
                                <ToolCard icon={<GroupsIcon />} title="Students"
                                    desc="The student directory — find your learners by class."
                                    href="/students" />
                            </Grid>
                            <Grid item xs={12} sm={6}>
                                <ToolCard icon={<FactCheckIcon />} title="Attendance" soon
                                    desc="Take your daily homeroom register right from this page." />
                            </Grid>
                            <Grid item xs={12} sm={6}>
                                <ToolCard icon={<CalendarMonthIcon />} title="Timetable" soon
                                    desc="Your class's weekly schedule, period by period." />
                            </Grid>
                            <Grid item xs={12} sm={6}>
                                <ToolCard icon={<GradeIcon />} title="Marksheets" soon
                                    desc="Record marks for your subjects — grades computed for you." />
                            </Grid>
                            <Grid item xs={12} sm={6}>
                                <ToolCard icon={<MenuBookOutlinedIcon />} title="Lesson Planning" soon
                                    desc="Schemes of work and weekly lesson plans for your class." />
                            </Grid>
                        </Grid>
                    </Grid>
                </Grid>
            </Container>

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
