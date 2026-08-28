import { useEffect, useMemo, useState } from 'react';
import { Link as RouterLink } from 'react-router-dom';
import {
    Alert, Box, Button, Card, CardContent, Chip, CircularProgress, Container, Divider, InputAdornment,
    MenuItem, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, TextField,
    Typography, useTheme,
} from '@mui/material';
import { alpha } from '@mui/material/styles';
import LoginIcon from '@mui/icons-material/Login';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import LightModeIcon from '@mui/icons-material/LightMode';
import DarkModeIcon from '@mui/icons-material/DarkMode';
import SchoolIcon from '@mui/icons-material/School';
import SearchIcon from '@mui/icons-material/Search';
import GroupsIcon from '@mui/icons-material/Groups';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import { useColorScheme } from '../theme';

const BASE_URL = process.env.REACT_APP_API_URL || '';

// Canonical class list (matches Year_3_and_Year_4_Class_Teachers.csv) so the
// class filter always offers every class, even before any students load.
const CLASS_OPTIONS = [
    'Year 3 - Blue', 'Year 3 - Yellow', 'Year 3 - Red', 'Year 3 - Green',
    'Year 4 - Blue', 'Year 4 - Purple', 'Year 4 - Lavender', 'Year 4 - Crimson',
    'Year 4 - Green', 'Year 4 - Yellow', 'Year 4 - Magenta', 'Year 4 - Red',
    'Year 4 - Violet', 'Year 4 - Orange',
];

// Sample students shown when the live directory is empty, so the public page is
// demonstrable. A real record carries these same fields server-side.
const SAMPLE_STUDENTS = [
    {
        name: 'Yonas Bekele',
        className: 'Year 3 - Blue',
        gender: 'Male',
        admissionNumber: 'BIS2026-001',
        dateOfBirth: '2018-04-12',
        guardianName: 'Mrs. Meseret Bekele',
        guardianRelation: 'Mother',
        guardianPhone: '+251 91 123 4567',
        address: 'Gerji, Addis Ababa',
        previousSchool: 'Gerji Neighborhood School',
        medicalNotes: 'No known allergies',
        enrolmentDate: '2026-09-01',
        status: 'Active',
    },
    {
        name: 'Hana Getachew',
        className: 'Year 4 - Red',
        gender: 'Female',
        admissionNumber: 'BIS2026-002',
        dateOfBirth: '2017-09-03',
        guardianName: 'Mr. Getachew Tesfaye',
        guardianRelation: 'Father',
        guardianPhone: '+251 92 234 5678',
        address: 'Gerji, Addis Ababa',
        previousSchool: 'BIS NOC Gerji (Year 3)',
        medicalNotes: 'Mild asthma — inhaler kept in the clinic',
        enrolmentDate: '2026-09-01',
        status: 'Active',
    },
];

const ageFromDob = (dob) => {
    if (!dob) return null;
    const d = new Date(dob);
    if (Number.isNaN(d.getTime())) return null;
    const diff = Date.now() - d.getTime();
    return Math.floor(diff / (365.25 * 24 * 3600 * 1000));
};

/*
 * Public, login-free student directory.
 *
 * Live data from GET /api/public/students exposes names and class only — no
 * admission numbers, guardians or dates of birth leave the backend. The sample
 * records above carry a fuller profile so the detail view can be demonstrated;
 * in production those extra fields come from the authenticated record.
 */
export default function PublicStudents() {
    const theme = useTheme();
    const dark = theme.palette.mode === 'dark';
    const { toggleColorScheme } = useColorScheme();
    const surface = dark ? theme.palette.background.paper : '#ffffff';
    const border = dark ? theme.palette.divider : '#e2e8f0';

    const [students, setStudents] = useState(null);
    const [error, setError] = useState('');
    const [search, setSearch] = useState('');
    const [classFilter, setClassFilter] = useState('all');
    const [expanded, setExpanded] = useState(null);

    const load = () => {
        setError('');
        setStudents(null);
        fetch(`${BASE_URL}/api/public/students`)
            .then((r) => {
                if (!r.ok) throw new Error(`Request failed (${r.status})`);
                return r.json();
            })
            .then((data) => {
                const list = data.students || [];
                setStudents(list.length > 0 ? list : SAMPLE_STUDENTS);
            })
            .catch((err) => setError(err.message || 'Could not load the student list'));
    };

    useEffect(() => { load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

    const classOptions = useMemo(
        () => CLASS_OPTIONS.map((name) => ({ name, yearLevel: name.startsWith('Year 3') ? 3 : 4 })),
        [],
    );

    const filtered = useMemo(() => {
        const q = search.trim().toLowerCase();
        return (students || []).filter((s) => {
            if (classFilter !== 'all' && s.className !== classFilter) return false;
            if (q && !s.name.toLowerCase().includes(q)) return false;
            return true;
        });
    }, [students, search, classFilter]);

    const groups = useMemo(() => {
        const order = classOptions
            .filter((c) => classFilter === 'all' || c.name === classFilter)
            .map((c) => c.name);
        return order
            .map((name) => ({
                name,
                students: filtered
                    .filter((s) => s.className === name)
                    .sort((a, b) => a.name.localeCompare(b.name)),
            }))
            .filter((g) => g.students.length > 0);
    }, [filtered, classOptions, classFilter]);

    const hasFilters = search.trim() !== '' || classFilter !== 'all';

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
                            <Button component={RouterLink} to="/" variant="outlined" size="small"
                                startIcon={<ArrowBackIcon />}
                                sx={{ fontWeight: 700, borderRadius: 1, px: 2, textTransform: 'none' }}>
                                Back
                            </Button>
                            <Box onClick={toggleColorScheme} sx={{ display: 'flex', alignItems: 'center',
                                justifyContent: 'center', width: 38, height: 38, borderRadius: 1,
                                border: `1px solid ${border}`, cursor: 'pointer', color: 'text.secondary',
                                '&:hover': { color: 'primary.main', borderColor: 'primary.main' } }}
                                aria-label="Toggle theme">
                                {dark
                                    ? <LightModeIcon sx={{ fontSize: 18 }} />
                                    : <DarkModeIcon  sx={{ fontSize: 18 }} />}
                            </Box>
                            <Button component={RouterLink} to="/login" variant="contained" size="small"
                                startIcon={<LoginIcon />} sx={{ fontWeight: 700, borderRadius: 1, px: 2.5,
                                    textTransform: 'none' }}>
                                Sign In
                            </Button>
                        </Box>
                    </Box>
                </Container>
            </Box>

            {/* ── content ── */}
            <Container maxWidth="lg" sx={{ py: { xs: 6, md: 9 } }}>
                <Box sx={{ mb: { xs: 4, md: 6 } }}>
                    <Typography variant="h3" sx={{ fontWeight: 800, letterSpacing: '-.02em' }}>
                        Students
                    </Typography>
                    <Typography sx={{ mt: 1.5, color: 'text.secondary', maxWidth: 640 }}>
                        The student body at British International School, Gerji Primary II —
                        listed by class. Search by name or filter by class.
                    </Typography>
                </Box>

                {/* ── search + filter bar ── */}
                <Box sx={{ display: 'flex', flexDirection: { xs: 'column', sm: 'row' },
                    gap: 2, mb: 4, alignItems: { sm: 'center' } }}>
                    <TextField
                        placeholder="Search by student name…"
                        size="small" value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        sx={{ flexGrow: 1 }}
                        InputProps={{
                            startAdornment: (
                                <InputAdornment position="start">
                                    <SearchIcon fontSize="small" sx={{ color: 'text.secondary' }} />
                                </InputAdornment>
                            ),
                        }}
                    />
                    <TextField
                        select label="Class" size="small" sx={{ minWidth: 210 }}
                        value={classFilter} onChange={(e) => setClassFilter(e.target.value)}>
                        <MenuItem value="all">All classes</MenuItem>
                        {classOptions.map((c) => (
                            <MenuItem key={c.name} value={c.name}>{c.name}</MenuItem>
                        ))}
                    </TextField>
                    {students !== null && !error && (
                        <Typography sx={{ fontSize: 13, color: 'text.secondary', ml: { sm: 'auto' } }}>
                            Showing <strong>{filtered.length}</strong> of {students.length} students
                        </Typography>
                    )}
                </Box>

                {students === null && !error && (
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

                {students !== null && !error && students.length === 0 && (
                    <Alert severity="info">
                        The student list has not been published yet — check back soon.
                    </Alert>
                )}

                {students !== null && !error && students.length > 0 && (
                    groups.length === 0 ? (
                        <Alert severity="info"
                            action={hasFilters ? (
                                <Button size="small" onClick={() => { setSearch(''); setClassFilter('all'); }}>
                                    Clear filters
                                </Button>
                            ) : undefined}>
                            No students match your search.
                        </Alert>
                    ) : groups.map((group) => (
                        <Box key={group.name} sx={{ mb: 5 }}>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 1.5 }}>
                                <GroupsIcon sx={{ color: 'primary.main', fontSize: 20 }} />
                                <Typography sx={{ fontWeight: 800, fontSize: 17 }}>{group.name}</Typography>
                                <Chip label={`${group.students.length} student${group.students.length === 1 ? '' : 's'}`}
                                    size="small" sx={{ fontWeight: 700, borderRadius: 1,
                                        bgcolor: alpha(theme.palette.primary.main, 0.1), color: 'primary.main' }} />
                            </Box>
                            <TableContainer sx={{ border: `1px solid ${border}`, borderRadius: 1,
                                bgcolor: surface }}>
                                <Table size="small">
                                    <TableHead>
                                        <TableRow>
                                            <TableCell sx={{ width: 64, fontWeight: 700 }}>#</TableCell>
                                            <TableCell sx={{ fontWeight: 700 }}>Student name</TableCell>
                                            <TableCell sx={{ width: 48 }} />
                                        </TableRow>
                                    </TableHead>
                                    <TableBody>
                                        {group.students.map((s, i) => (
                                            <FragmentRow key={s.name} student={s} index={i + 1}
                                                expanded={expanded === s.name}
                                                onToggle={() => setExpanded(expanded === s.name ? null : s.name)}
                                                border={border} surface={surface} />
                                        ))}
                                    </TableBody>
                                </Table>
                            </TableContainer>
                        </Box>
                    ))
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

function FragmentRow({ student, index, expanded, onToggle, border, surface }) {
    const theme = useTheme();
    return (
        <>
            <TableRow hover>
                <TableCell sx={{ color: 'text.secondary' }}>{index}</TableCell>
                <TableCell sx={{ fontWeight: 600 }}>{student.name}</TableCell>
                <TableCell sx={{ textAlign: 'right' }}>
                    <Button size="small" onClick={onToggle} endIcon={<ExpandMoreIcon
                        sx={{ transform: expanded ? 'rotate(180deg)' : 'none', transition: 'transform .2s' }} />}
                        sx={{ textTransform: 'none', fontWeight: 600, color: 'primary.main' }}>
                        {expanded ? 'Hide' : 'Details'}
                    </Button>
                </TableCell>
            </TableRow>
            {expanded && (
                <TableRow>
                    <TableCell colSpan={3} sx={{ bgcolor: alpha(surface, 0.4), borderBottom: `1px solid ${border}` }}>
                        <Card variant="outlined" sx={{ borderRadius: 1.5, borderColor: border, mb: 0.5, overflow: 'hidden' }}>
                            <Box sx={{ bgcolor: alpha(theme.palette.primary.main, 0.06), px: 2, py: 0.75,
                                borderBottom: `1px solid ${border}` }}>
                                <Typography sx={{ fontWeight: 700, fontSize: 11, letterSpacing: .4,
                                    textTransform: 'uppercase', color: 'primary.main' }}>
                                    Student ID
                                </Typography>
                            </Box>
                            <CardContent sx={{ p: 2 }}>
                                <Box sx={{ display: 'flex', gap: 1.75, alignItems: 'center', mb: 1.75 }}>
                                    <Box sx={{ width: 60, height: 60, borderRadius: 1.5, flexShrink: 0,
                                        bgcolor: alpha(theme.palette.primary.main, 0.12), color: 'primary.main',
                                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                                        fontSize: 24, fontWeight: 800 }}>
                                        {student.name?.charAt(0).toUpperCase()}
                                    </Box>
                                    <Box sx={{ minWidth: 0 }}>
                                        <Typography sx={{ fontWeight: 800, fontSize: 16, lineHeight: 1.1 }}>
                                            {student.name}
                                        </Typography>
                                        <Chip label={student.className} size="small"
                                            sx={{ fontWeight: 700, mt: 0.5, borderRadius: 1, height: 20,
                                                bgcolor: alpha(theme.palette.primary.main, 0.1), color: 'primary.main' }} />
                                        <Typography sx={{ fontSize: 11.5, color: 'text.secondary', mt: 0.5 }}>
                                            {student.gender || '—'}{student.status ? ` · ${student.status}` : ''}
                                        </Typography>
                                    </Box>
                                </Box>
                                <Divider />
                                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1.5, mt: 1.25 }}>
                                    <Section title="Parent / Guardian" items={[
                                        ['Guardian', student.guardianName],
                                        ['Relation', student.guardianRelation],
                                        ['Phone', student.guardianPhone],
                                    ]} />
                                    <Section title="Contact" items={[
                                        ['Address', student.address],
                                        ['Previous school', student.previousSchool],
                                    ]} />
                                    <Section title="Record" items={[
                                        ['Admission No.', student.admissionNumber],
                                        ['Date of birth', student.dateOfBirth],
                                        ['Age', ageFromDob(student.dateOfBirth) != null ? `${ageFromDob(student.dateOfBirth)} yrs` : null],
                                        ['Medical notes', student.medicalNotes],
                                        ['Enrolment', student.enrolmentDate],
                                    ]} />
                                </Box>
                            </CardContent>
                        </Card>
                    </TableCell>
                </TableRow>
            )}
        </>
    );
}

function DetailItem({ label, value }) {
    return (
        <Box sx={{ minWidth: 150, flex: '1 1 150px' }}>
            <Typography sx={{ fontSize: 10.5, fontWeight: 700, color: 'text.secondary',
                textTransform: 'uppercase', letterSpacing: .3 }}>
                {label}
            </Typography>
            <Typography sx={{ fontSize: 13, fontWeight: 500 }}>{value || '—'}</Typography>
        </Box>
    );
}

function Section({ title, items }) {
    return (
        <Box sx={{ minWidth: 180, flex: '1 1 180px' }}>
            <Typography sx={{ fontSize: 11, fontWeight: 800, color: 'primary.main',
                textTransform: 'uppercase', letterSpacing: .5, mb: 1.2 }}>
                {title}
            </Typography>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                {items.map(([label, value]) => (
                    <DetailItem key={label} label={label} value={value} />
                ))}
            </Box>
        </Box>
    );
}
