import { useEffect, useState } from 'react';
import { Link as RouterLink } from 'react-router-dom';
import {
    Alert, Box, Button, Chip, CircularProgress, Container, Table, TableBody,
    TableCell, TableContainer, TableHead, TableRow, Typography, useTheme,
} from '@mui/material';
import { alpha } from '@mui/material/styles';
import LoginIcon from '@mui/icons-material/Login';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import LightModeIcon from '@mui/icons-material/LightMode';
import DarkModeIcon from '@mui/icons-material/DarkMode';
import SchoolIcon from '@mui/icons-material/School';
import PersonIcon from '@mui/icons-material/Person';
import MenuBookIcon from '@mui/icons-material/MenuBook';
import { useColorScheme } from '../theme';

const BASE_URL = process.env.REACT_APP_API_URL || '';

/*
 * Public, login-free staff directory.
 *
 * Main teachers are sourced from Year_3_and_Year_4_Class_Teachers.csv (the
 * authoritative class → teacher mapping), listed as a table. Subject teachers
 * come live from GET /api/public/teachers and list the subjects they carry,
 * sorted alphabetically by name.
 */

const MAIN_TEACHERS = [
    { className: 'Year 3 - Blue',    teacher: 'Ms. Yeabsira A.' },
    { className: 'Year 3 - Yellow',  teacher: 'Ms. Meron A.' },
    { className: 'Year 3 - Red',     teacher: null },
    { className: 'Year 3 - Green',   teacher: 'Mr. Deginet' },
    { className: 'Year 4 - Blue',    teacher: 'Mr. Mulugeta J.' },
    { className: 'Year 4 - Purple',  teacher: 'Ms. Mekdelawit A.' },
    { className: 'Year 4 - Lavender', teacher: 'Ms. Selam G.' },
    { className: 'Year 4 - Crimson', teacher: 'Ms. Simegn Y.' },
    { className: 'Year 4 - Green',   teacher: null },
    { className: 'Year 4 - Yellow',  teacher: 'Ms. Mariamawait B.' },
    { className: 'Year 4 - Magenta', teacher: 'Ms. Abigail A.' },
    { className: 'Year 4 - Red',     teacher: 'Ms. Denebe A.' },
    { className: 'Year 4 - Violet',  teacher: 'Ms. Abigiya T.' },
    { className: 'Year 4 - Orange',  teacher: 'Ms. Mekdelawit N.' },
];

// Skip obvious seed/test placeholders so the subject list stays meaningful.
const PLACEHOLDER = /(^|[^a-z])teacher$|^test\b|^clinic\s*nurse$|^main\s*teacher$/i;

export default function PublicTeachers() {
    const theme = useTheme();
    const dark = theme.palette.mode === 'dark';
    const { toggleColorScheme } = useColorScheme();
    const surface = dark ? theme.palette.background.paper : '#ffffff';
    const border = dark ? theme.palette.divider : '#e2e8f0';

    const [subjectTeachers, setSubjectTeachers] = useState(null);
    const [error, setError] = useState('');

    const load = () => {
        setError('');
        setSubjectTeachers(null);
        fetch(`${BASE_URL}/api/public/teachers`)
            .then((r) => {
                if (!r.ok) throw new Error(`Request failed (${r.status})`);
                return r.json();
            })
            .then((data) => {
                const list = (data.teachers || [])
                    .filter((t) => t.role === 'subject_teacher' && !PLACEHOLDER.test(t.name))
                    .sort((a, b) => a.name.localeCompare(b.name));
                setSubjectTeachers(list);
            })
            .catch((err) => setError(err.message || 'Could not load the staff directory'));
    };

    useEffect(() => { load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

    const mainTeachers = [...MAIN_TEACHERS].sort((a, b) => a.className.localeCompare(b.className));

    const renderTable = (title, icon, headers, rows) => (
        <Box sx={{ mb: { xs: 6, md: 8 } }}>
            <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 1.5, mb: 3 }}>
                {icon}
                <Typography variant="h5" sx={{ fontWeight: 800, letterSpacing: '-.02em' }}>
                    {title}
                </Typography>
                <Chip label={`${rows.length}`} size="small"
                    sx={{ fontWeight: 700, borderRadius: 1, bgcolor: alpha(theme.palette.primary.main, 0.1),
                        color: 'primary.main' }} />
            </Box>
            <TableContainer sx={{ borderRadius: 1, border: `1px solid ${border}`, bgcolor: surface,
                overflow: 'hidden' }}>
                <Table sx={{ minWidth: 420 }}>
                    <TableHead>
                        <TableRow sx={{ bgcolor: alpha(theme.palette.primary.main, 0.06) }}>
                            {headers.map((h) => (
                                <TableCell key={h} sx={{ fontWeight: 800, fontSize: 12,
                                    textTransform: 'uppercase', letterSpacing: .5, color: 'text.secondary' }}>
                                    {h}
                                </TableCell>
                            ))}
                        </TableRow>
                    </TableHead>
                    <TableBody>
                        {rows.map((cells, i) => (
                            <TableRow key={i} sx={{ '&:last-child td, &:last-child th': { border: 0 },
                                '&:hover': { bgcolor: alpha(theme.palette.primary.main, 0.04) } }}>
                                {cells.map((c, j) => (
                                    <TableCell key={j} sx={{ fontSize: 14, py: 1.6 }}>{c}</TableCell>
                                ))}
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </TableContainer>
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
                                startIcon={<ArrowBackIcon />}
                                sx={{ fontWeight: 700, borderRadius: 1, px: 2, textTransform: 'none' }}>
                                Back
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
                        {mainTeachers.length} homeroom main teachers and the subject teachers who
                        carry their lessons across the classes.
                    </Typography>
                </Box>

                {renderTable('Year 3 — Main Teachers',
                    <PersonIcon sx={{ color: 'primary.main' }} />,
                    ['Main Teacher', 'Class'],
                    mainTeachers.filter((m) => m.className.startsWith('Year 3')).map((m) => [
                        m.teacher || <Box component="span" sx={{ fontStyle: 'italic', color: 'text.secondary' }}>To be Assigned</Box>,
                        <Chip key="c" label={m.className} size="small" sx={{ fontWeight: 600, borderRadius: 1 }} />,
                    ]))}

                {renderTable('Year 4 — Main Teachers',
                    <PersonIcon sx={{ color: 'primary.main' }} />,
                    ['Main Teacher', 'Class'],
                    mainTeachers.filter((m) => m.className.startsWith('Year 4')).map((m) => [
                        m.teacher || <Box component="span" sx={{ fontStyle: 'italic', color: 'text.secondary' }}>To be Assigned</Box>,
                        <Chip key="c" label={m.className} size="small" sx={{ fontWeight: 600, borderRadius: 1 }} />,
                    ]))}

                {subjectTeachers === null && !error && (
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

                {subjectTeachers !== null && !error && subjectTeachers.length === 0 && (
                    <Alert severity="info">
                        The subject teachers have not been published yet — check back soon.
                    </Alert>
                )}

                {subjectTeachers !== null && !error && subjectTeachers.length > 0 && (
                    renderTable('Subject Teachers',
                        <MenuBookIcon sx={{ color: 'primary.main' }} />,
                        ['Subject Teacher', 'Subjects'],
                        subjectTeachers.map((t) => [
                            t.name,
                            t.subjects.length > 0
                                ? t.subjects
                                    .map((s) => `${s.name} — ${s.classCount} class${s.classCount === 1 ? '' : 'es'}`)
                                    .join('  ·  ')
                                : <Box component="span" sx={{ fontStyle: 'italic', color: 'text.secondary' }}>Subject assignments pending</Box>,
                        ]))
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
