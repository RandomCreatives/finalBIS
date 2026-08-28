import { useEffect, useState } from 'react';
import { Link as RouterLink } from 'react-router-dom';
import {
    Alert, Box, Button, Card, CardContent, Chip, CircularProgress, Container,
    Grid, Typography, useTheme,
} from '@mui/material';
import { alpha } from '@mui/material/styles';
import LoginIcon from '@mui/icons-material/Login';
import LightModeIcon from '@mui/icons-material/LightMode';
import DarkModeIcon from '@mui/icons-material/DarkMode';
import SchoolIcon from '@mui/icons-material/School';
import PersonIcon from '@mui/icons-material/Person';
import MenuBookIcon from '@mui/icons-material/MenuBook';
import ClassIcon from '@mui/icons-material/Class';
import { useColorScheme } from '../theme';

const BASE_URL = process.env.REACT_APP_API_URL || '';

/*
 * Public, login-free staff directory: main teachers and subject teachers.
 *
 * Data comes live from GET /api/public/teachers, which exposes safe fields
 * only (names, homeroom classes, subjects taught) — no emails or account
 * details ever leave the backend.
 */

function TeacherCard({ teacher }) {
    const theme = useTheme();
    const dark = theme.palette.mode === 'dark';
    const surface = dark ? theme.palette.background.paper : '#ffffff';
    const border = dark ? theme.palette.divider : '#e2e8f0';
    const isMain = teacher.role === 'main_teacher';

    return (
        <Card variant="outlined" sx={{ height: '100%', borderRadius: 3, bgcolor: surface,
            borderColor: border,
            transition: 'transform .18s, border-color .18s, box-shadow .18s',
            '&:hover': {
                transform: 'translateY(-4px)', borderColor: 'primary.main',
                boxShadow: dark ? '0 16px 40px rgba(0,0,0,.4)' : '0 16px 40px rgba(15,23,42,.08)',
            } }}>
            <CardContent sx={{ p: 3 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 2.5 }}>
                    <Box sx={{ width: 42, height: 42, borderRadius: '50%',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        bgcolor: alpha(theme.palette.primary.main, 0.1), color: 'primary.main',
                        fontWeight: 800, fontSize: 16 }}>
                        {(teacher.name || '?').trim().charAt(0).toUpperCase()}
                    </Box>
                    <Box sx={{ minWidth: 0 }}>
                        <Typography sx={{ fontWeight: 800, fontSize: 16, lineHeight: 1.2 }} noWrap>
                            {teacher.name}
                        </Typography>
                        <Typography sx={{ fontSize: 11, fontWeight: 700, color: 'text.secondary',
                            textTransform: 'uppercase', letterSpacing: .5 }}>
                            {isMain ? 'Main Teacher' : 'Subject Teacher'}
                        </Typography>
                    </Box>
                </Box>

                {isMain ? (
                    teacher.classes.length > 0 ? (
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.2 }}>
                            <ClassIcon sx={{ fontSize: 18, color: 'text.secondary' }} />
                            <Box sx={{ display: 'flex', gap: 0.75, flexWrap: 'wrap' }}>
                                {teacher.classes.map((c) => (
                                    <Chip key={c} label={c} size="small" sx={{ fontWeight: 600 }} />
                                ))}
                            </Box>
                        </Box>
                    ) : (
                        <Typography sx={{ fontSize: 13, color: 'text.secondary', fontStyle: 'italic' }}>
                            Class assignment pending
                        </Typography>
                    )
                ) : (
                    teacher.subjects.length > 0 ? (
                        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.2 }}>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.2 }}>
                                <MenuBookIcon sx={{ fontSize: 18, color: 'text.secondary' }} />
                                <Box sx={{ display: 'flex', gap: 0.75, flexWrap: 'wrap' }}>
                                    {teacher.subjects.map((s) => (
                                        <Chip key={s.name} label={s.name} size="small" sx={{ fontWeight: 600 }} />
                                    ))}
                                </Box>
                            </Box>
                            {teacher.subjects.length > 0 && (
                                <Typography sx={{ fontSize: 12, color: 'text.secondary', pl: 3.8 }}>
                                    {teacher.subjects
                                        .map((s) => `${s.name} — ${s.classCount} class${s.classCount === 1 ? '' : 'es'}`)
                                        .join('  ·  ')}
                                </Typography>
                            )}
                        </Box>
                    ) : (
                        <Typography sx={{ fontSize: 13, color: 'text.secondary', fontStyle: 'italic' }}>
                            Subject assignments pending
                        </Typography>
                    )
                )}
            </CardContent>
        </Card>
    );
}

export default function PublicTeachers() {
    const theme = useTheme();
    const dark = theme.palette.mode === 'dark';
    const { toggleColorScheme } = useColorScheme();
    const surface = dark ? theme.palette.background.paper : '#ffffff';
    const border = dark ? theme.palette.divider : '#e2e8f0';

    const [teachers, setTeachers] = useState(null);
    const [error, setError] = useState('');

    const load = () => {
        setError('');
        setTeachers(null);
        fetch(`${BASE_URL}/api/public/teachers`)
            .then((r) => {
                if (!r.ok) throw new Error(`Request failed (${r.status})`);
                return r.json();
            })
            .then((data) => setTeachers(data.teachers || []))
            .catch((err) => setError(err.message || 'Could not load the staff directory'));
    };

    useEffect(() => { load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

    const mains = (teachers || []).filter((t) => t.role === 'main_teacher');
    const subjectTeachers = (teachers || []).filter((t) => t.role === 'subject_teacher');

    const renderGroup = (title, icon, list) => (
        <Box sx={{ mb: { xs: 6, md: 8 } }}>
            <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 1.5, mb: 3 }}>
                {icon}
                <Typography variant="h5" sx={{ fontWeight: 800, letterSpacing: '-.02em' }}>
                    {title}
                </Typography>
                <Chip label={`${list.length} teacher${list.length === 1 ? '' : 's'}`} size="small"
                    sx={{ fontWeight: 700, bgcolor: alpha(theme.palette.primary.main, 0.1),
                        color: 'primary.main' }} />
            </Box>
            <Grid container spacing={2.5}>
                {list.map((t) => (
                    <Grid item xs={12} sm={6} md={4} lg={3} key={t.name}>
                        <TeacherCard teacher={t} />
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
                            <Box onClick={toggleColorScheme} sx={{ display: 'flex', alignItems: 'center',
                                justifyContent: 'center', width: 38, height: 38, borderRadius: 2,
                                border: `1px solid ${border}`, cursor: 'pointer', color: 'text.secondary',
                                '&:hover': { color: 'primary.main', borderColor: 'primary.main' } }}
                                aria-label="Toggle theme">
                                {dark
                                    ? <LightModeIcon sx={{ fontSize: 18 }} />
                                    : <DarkModeIcon  sx={{ fontSize: 18 }} />}
                            </Box>
                            <Button component={RouterLink} to="/" variant="outlined" size="small"
                                sx={{ fontWeight: 700, borderRadius: 2, px: 2.5, textTransform: 'none' }}>
                                Home
                            </Button>
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
                        Our Teachers
                    </Typography>
                    <Typography sx={{ mt: 1.5, color: 'text.secondary', maxWidth: 620 }}>
                        The teaching team at British International School, Gerji Primary II —
                        main teachers lead a homeroom class; subject teachers carry their subject
                        across several classes.
                    </Typography>
                </Box>

                {teachers === null && !error && (
                    <Box sx={{ display: 'flex', justifyContent: 'center', py: 10 }}>
                        <CircularProgress />
                    </Box>
                )}

                {error && (
                    <Alert severity="error" sx={{ mb: 3 }}
                        action={<Button size="small" onClick={load}>Retry</Button>}>
                        {error}
                    </Alert>
                )}

                {teachers !== null && !error && teachers.length === 0 && (
                    <Alert severity="info">
                        The teaching team has not been published yet — check back soon.
                    </Alert>
                )}

                {teachers !== null && !error && teachers.length > 0 && (
                    <>
                        {renderGroup('Main Teachers',
                            <PersonIcon sx={{ color: 'primary.main' }} />, mains)}
                        {renderGroup('Subject Teachers',
                            <MenuBookIcon sx={{ color: 'primary.main' }} />, subjectTeachers)}
                    </>
                )}
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
