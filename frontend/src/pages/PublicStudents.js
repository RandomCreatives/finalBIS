import { useEffect, useMemo, useState } from 'react';
import { Link as RouterLink } from 'react-router-dom';
import {
    Alert, Box, Button, Chip, CircularProgress, Container, InputAdornment, MenuItem,
    Table, TableBody, TableCell, TableContainer, TableHead, TableRow, TextField,
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
import { useColorScheme } from '../theme';

const BASE_URL = process.env.REACT_APP_API_URL || '';

/*
 * Public, login-free student directory.
 *
 * Live data from GET /api/public/students, which exposes names and class
 * only — no admission numbers, guardians or dates of birth. Students are
 * listed per class; the search box and class filter narrow the view.
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

    const load = () => {
        setError('');
        setStudents(null);
        fetch(`${BASE_URL}/api/public/students`)
            .then((r) => {
                if (!r.ok) throw new Error(`Request failed (${r.status})`);
                return r.json();
            })
            .then((data) => setStudents(data.students || []))
            .catch((err) => setError(err.message || 'Could not load the student list'));
    };

    useEffect(() => { load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

    // Classes present in the roster, Year 3 before Year 4, then by name.
    const classOptions = useMemo(() => {
        const byName = new Map();
        (students || []).forEach((s) => byName.set(s.className, s.yearLevel ?? 99));
        return [...byName.entries()]
            .map(([name, yearLevel]) => ({ name, yearLevel }))
            .sort((a, b) => a.yearLevel - b.yearLevel || a.name.localeCompare(b.name));
    }, [students]);

    // Apply the class filter and the search box.
    const filtered = useMemo(() => {
        const q = search.trim().toLowerCase();
        return (students || []).filter((s) => {
            if (classFilter !== 'all' && s.className !== classFilter) return false;
            if (q && !s.name.toLowerCase().includes(q)) return false;
            return true;
        });
    }, [students, search, classFilter]);

    // Group the filtered list by class, keeping the year-then-name order.
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
                            <Button component={RouterLink} to="/" size="small"
                                startIcon={<ArrowBackIcon />}
                                sx={{ fontWeight: 700, borderRadius: 1, textTransform: 'none',
                                    color: 'text.secondary', '&:hover': { color: 'primary.main' } }}>
                                Back
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
                    <>
                        {/* ── search + filter bar ── */}
                        <Box sx={{ display: 'flex', flexDirection: { xs: 'column', sm: 'row' },
                            gap: 2, mb: 4, alignItems: { sm: 'center' } }}>
                            <TextField
                                placeholder="Search by student name…"
                                size="small" value={search}
                                onChange={(e) => setSearch(e.target.value)}
                                sx={{ flexGrow: 1, maxWidth: { sm: 420 } }}
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
                            <Typography sx={{ fontSize: 13, color: 'text.secondary', ml: { sm: 'auto' } }}>
                                Showing <strong>{filtered.length}</strong> of {students.length} students
                            </Typography>
                        </Box>

                        {/* ── results grouped by class ── */}
                        {groups.length === 0 ? (
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
                                            </TableRow>
                                        </TableHead>
                                        <TableBody>
                                            {group.students.map((s, i) => (
                                                <TableRow key={s.name} hover>
                                                    <TableCell sx={{ color: 'text.secondary' }}>{i + 1}</TableCell>
                                                    <TableCell sx={{ fontWeight: 600 }}>{s.name}</TableCell>
                                                </TableRow>
                                            ))}
                                        </TableBody>
                                    </Table>
                                </TableContainer>
                            </Box>
                        ))}
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
