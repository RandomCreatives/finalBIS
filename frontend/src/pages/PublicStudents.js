import { useEffect, useMemo, useState } from 'react';
import { Link as RouterLink } from 'react-router-dom';
import {
    Alert, Box, Button, Chip, CircularProgress, Container, Dialog, Divider, IconButton,
    InputAdornment, MenuItem, Snackbar, Table, TableBody, TableCell, TableContainer,
    TableHead, TableRow, TextField, Typography, useTheme,
} from '@mui/material';
import { alpha } from '@mui/material/styles';
import LoginIcon from '@mui/icons-material/Login';
import LightModeIcon from '@mui/icons-material/LightMode';
import DarkModeIcon from '@mui/icons-material/DarkMode';
import SchoolIcon from '@mui/icons-material/School';
import SearchIcon from '@mui/icons-material/Search';
import GroupsIcon from '@mui/icons-material/Groups';
import BadgeIcon from '@mui/icons-material/Badge';
import EditIcon from '@mui/icons-material/Edit';
import SwapHorizIcon from '@mui/icons-material/SwapHoriz';
import CloseIcon from '@mui/icons-material/Close';
import { useColorScheme } from '../theme';
import { readClassLogin } from '../data/classes';

const BASE_URL = process.env.REACT_APP_API_URL || '';

// Canonical class list (matches Year_3_and_Year_4_Class_Teachers.csv) so the
// class filter and transfers always offer every class.
const CLASS_OPTIONS = [
    'Year 3 - Blue', 'Year 3 - Yellow', 'Year 3 - Red', 'Year 3 - Green',
    'Year 4 - Blue', 'Year 4 - Purple', 'Year 4 - Lavender', 'Year 4 - Crimson',
    'Year 4 - Green', 'Year 4 - Yellow', 'Year 4 - Magenta', 'Year 4 - Red',
    'Year 4 - Violet', 'Year 4 - Orange',
];

// Sample students shown when the live directory is empty, so the page is
// demonstrable. Real records carry the same fields server-side.
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
    return Math.floor((Date.now() - d.getTime()) / (365.25 * 24 * 3600 * 1000));
};

/* ── dense field primitives for the ID card ───────────────── */

function Field({ label, value, span }) {
    return (
        <Box sx={{ gridColumn: span ? 'span 2' : undefined, minWidth: 0 }}>
            <Typography sx={{ fontSize: 9.5, fontWeight: 800, color: 'text.secondary',
                textTransform: 'uppercase', letterSpacing: .6, lineHeight: 1.4 }}>
                {label}
            </Typography>
            <Typography sx={{ fontSize: 12.5, fontWeight: 600, lineHeight: 1.35 }} noWrap={!span}>
                {value || '—'}
            </Typography>
        </Box>
    );
}

function EditField({ label, value, onChange, span, type = 'text', options }) {
    return (
        <Box sx={{ gridColumn: span ? 'span 2' : undefined }}>
            <TextField
                label={label} size="small" fullWidth select={Boolean(options)} type={type}
                value={value ?? ''} onChange={(e) => onChange(e.target.value)}
                InputLabelProps={type === 'date' ? { shrink: true } : undefined}
                sx={{ '& .MuiInputBase-input': { fontSize: 13 }, '& .MuiInputLabel-root': { fontSize: 12 } }}>
                {options && options.map((o) => <MenuItem key={o} value={o}>{o}</MenuItem>)}
            </TextField>
        </Box>
    );
}

/* ── the ID card dialog ───────────────────────────────────── */

function IdCardDialog({ student, canManage, classes, onClose, onSave, onTransfer }) {
    const theme = useTheme();
    const [editing, setEditing] = useState(false);
    const [draft, setDraft] = useState(null);
    const [transferOpen, setTransferOpen] = useState(false);
    const [targetClass, setTargetClass] = useState('');
    const [reason, setReason] = useState('');
    const [transferError, setTransferError] = useState('');

    if (!student) return null;

    const startEdit = () => {
        setDraft({
            name: student.name || '',
            gender: student.gender || '',
            dateOfBirth: student.dateOfBirth || '',
            guardianName: student.guardianName || '',
            guardianRelation: student.guardianRelation || '',
            guardianPhone: student.guardianPhone || '',
            address: student.address || '',
            previousSchool: student.previousSchool || '',
            medicalNotes: student.medicalNotes || '',
            status: student.status || 'Active',
        });
        setTransferOpen(false);
        setEditing(true);
    };

    const saveEdit = () => {
        if (!draft.name.trim()) return;
        onSave(student.name, draft);
        setEditing(false);
    };

    const confirmTransfer = () => {
        if (!targetClass || targetClass === student.className) {
            setTransferError('Choose a different class to transfer to.');
            return;
        }
        onTransfer(student.name, targetClass, reason.trim());
        setTransferOpen(false);
        setTargetClass('');
        setReason('');
        setTransferError('');
    };

    const set = (key) => (value) => setDraft((d) => ({ ...d, [key]: value }));

    return (
        <Dialog open onClose={onClose} maxWidth="sm" fullWidth PaperProps={{ sx: { borderRadius: 2, overflow: 'hidden' } }}>
            {/* card stripe */}
            <Box sx={{ px: 2.5, py: 1.25, display: 'flex', alignItems: 'center', gap: 1.25,
                bgcolor: 'primary.main', color: '#fff' }}>
                <SchoolIcon sx={{ fontSize: 18 }} />
                <Typography sx={{ fontWeight: 800, fontSize: 12.5, letterSpacing: 1, textTransform: 'uppercase' }}>
                    BIS NOC Gerji · Student ID
                </Typography>
                <Typography sx={{ ml: 'auto', fontSize: 11, fontWeight: 700, opacity: .85 }}>
                    2026/27
                </Typography>
                <IconButton size="small" onClick={onClose} sx={{ color: '#fff', ml: .5 }} aria-label="Close">
                    <CloseIcon sx={{ fontSize: 16 }} />
                </IconButton>
            </Box>

            <Box sx={{ p: 2.5 }}>
                {!editing ? (
                    <>
                        {/* photo + identity */}
                        <Box sx={{ display: 'flex', gap: 2, alignItems: 'center', mb: 2 }}>
                            <Box sx={{ width: 72, height: 88, borderRadius: 1.25, flexShrink: 0,
                                border: '1px solid', borderColor: 'divider',
                                bgcolor: alpha(theme.palette.primary.main, 0.1), color: 'primary.main',
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                fontSize: 30, fontWeight: 800 }}>
                                {(student.name || '?').trim().charAt(0).toUpperCase()}
                            </Box>
                            <Box sx={{ minWidth: 0 }}>
                                <Typography sx={{ fontWeight: 800, fontSize: 18, lineHeight: 1.15 }}>
                                    {student.name}
                                </Typography>
                                <Typography sx={{ fontFamily: 'monospace', fontSize: 12.5, fontWeight: 700,
                                    color: 'text.secondary', letterSpacing: .8, mt: .25 }}>
                                    {student.admissionNumber || '—'}
                                </Typography>
                                <Box sx={{ display: 'flex', gap: .75, mt: 1, flexWrap: 'wrap' }}>
                                    <Chip label={student.className} size="small"
                                        sx={{ fontWeight: 700, borderRadius: 1, height: 22, fontSize: 11.5,
                                            bgcolor: alpha(theme.palette.primary.main, 0.1), color: 'primary.main' }} />
                                    {student.status && (
                                        <Chip label={student.status} size="small"
                                            sx={{ fontWeight: 700, borderRadius: 1, height: 22, fontSize: 11.5,
                                                bgcolor: alpha(theme.palette.success.main, 0.12), color: 'success.main' }} />
                                    )}
                                </Box>
                            </Box>
                        </Box>

                        <Divider sx={{ mb: 1.5 }} />

                        {/* dense record grid */}
                        <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', columnGap: 2, rowGap: 1.1 }}>
                            <Field label="Date of birth" value={student.dateOfBirth} />
                            <Field label="Age" value={ageFromDob(student.dateOfBirth) != null ? `${ageFromDob(student.dateOfBirth)} yrs` : null} />
                            <Field label="Gender" value={student.gender} />
                            <Field label="Enrolled" value={student.enrolmentDate} />
                            <Field label="Guardian" value={student.guardianName} />
                            <Field label="Relation" value={student.guardianRelation} />
                            <Field label="Guardian phone" value={student.guardianPhone} span />
                            <Field label="Address" value={student.address} span />
                            <Field label="Previous school" value={student.previousSchool} span />
                            <Field label="Medical notes" value={student.medicalNotes} span />
                        </Box>

                        {/* actions */}
                        <Box sx={{ display: 'flex', gap: 1, mt: 2.5 }}>
                            {canManage && (
                                <>
                                    <Button size="small" variant="outlined" startIcon={<EditIcon sx={{ fontSize: 15 }} />}
                                        onClick={startEdit}
                                        sx={{ fontWeight: 700, textTransform: 'none', borderRadius: 1 }}>
                                        Edit
                                    </Button>
                                    <Button size="small" variant="outlined" startIcon={<SwapHorizIcon sx={{ fontSize: 16 }} />}
                                        onClick={() => { setTransferOpen((v) => !v); setEditing(false); setTransferError(''); }}
                                        sx={{ fontWeight: 700, textTransform: 'none', borderRadius: 1 }}>
                                        Transfer
                                    </Button>
                                </>
                            )}
                            <Button size="small" onClick={onClose} sx={{ ml: 'auto', fontWeight: 700,
                                textTransform: 'none', color: 'text.secondary' }}>
                                Close
                            </Button>
                        </Box>

                        {!canManage && (
                            <Typography sx={{ fontSize: 11, color: 'text.secondary', mt: 1.25 }}>
                                Sign in from your class card to edit or transfer students.
                            </Typography>
                        )}

                        {/* transfer panel */}
                        {transferOpen && canManage && (
                            <Box sx={{ mt: 2, p: 2, borderRadius: 1.25, border: '1px dashed',
                                borderColor: 'divider', bgcolor: alpha(theme.palette.primary.main, 0.03) }}>
                                <Typography sx={{ fontWeight: 800, fontSize: 13, mb: 1.5 }}>
                                    Transfer {student.name.split(' ')[0]} to another class
                                </Typography>
                                <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1.5 }}>
                                    <TextField select label="New class" size="small"
                                        value={targetClass} onChange={(e) => { setTargetClass(e.target.value); setTransferError(''); }}
                                        sx={{ '& .MuiInputBase-input': { fontSize: 13 } }}>
                                        {classes.filter((c) => c !== student.className).map((c) => (
                                            <MenuItem key={c} value={c}>{c}</MenuItem>
                                        ))}
                                    </TextField>
                                    <TextField label="Reason (optional)" size="small"
                                        value={reason} onChange={(e) => setReason(e.target.value)}
                                        sx={{ '& .MuiInputBase-input': { fontSize: 13 } }} />
                                </Box>
                                {transferError && (
                                    <Typography sx={{ fontSize: 12, color: 'error.main', mt: 1 }}>{transferError}</Typography>
                                )}
                                <Box sx={{ display: 'flex', gap: 1, mt: 1.5 }}>
                                    <Button size="small" variant="contained" disableElevation
                                        onClick={confirmTransfer}
                                        sx={{ fontWeight: 700, textTransform: 'none', borderRadius: 1 }}>
                                        Confirm transfer
                                    </Button>
                                    <Button size="small" onClick={() => setTransferOpen(false)}
                                        sx={{ fontWeight: 700, textTransform: 'none', color: 'text.secondary' }}>
                                        Cancel
                                    </Button>
                                </Box>
                            </Box>
                        )}
                    </>
                ) : (
                    <>
                        <Typography sx={{ fontWeight: 800, fontSize: 14, mb: 1.75 }}>
                            Edit student record
                        </Typography>
                        <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1.5 }}>
                            <EditField label="Full name" value={draft.name} onChange={set('name')} span />
                            <EditField label="Gender" value={draft.gender} onChange={set('gender')} options={['Male', 'Female']} />
                            <EditField label="Date of birth" type="date" value={draft.dateOfBirth} onChange={set('dateOfBirth')} />
                            <EditField label="Guardian" value={draft.guardianName} onChange={set('guardianName')} />
                            <EditField label="Relation" value={draft.guardianRelation} onChange={set('guardianRelation')} options={['Mother', 'Father', 'Guardian', 'Other']} />
                            <EditField label="Guardian phone" value={draft.guardianPhone} onChange={set('guardianPhone')} span />
                            <EditField label="Address" value={draft.address} onChange={set('address')} span />
                            <EditField label="Previous school" value={draft.previousSchool} onChange={set('previousSchool')} span />
                            <EditField label="Medical notes" value={draft.medicalNotes} onChange={set('medicalNotes')} span />
                        </Box>
                        <Box sx={{ display: 'flex', gap: 1, mt: 2.25 }}>
                            <Button size="small" variant="contained" disableElevation onClick={saveEdit}
                                disabled={!draft.name.trim()}
                                sx={{ fontWeight: 700, textTransform: 'none', borderRadius: 1 }}>
                                Save changes
                            </Button>
                            <Button size="small" onClick={() => setEditing(false)}
                                sx={{ fontWeight: 700, textTransform: 'none', color: 'text.secondary' }}>
                                Cancel
                            </Button>
                        </Box>
                    </>
                )}
            </Box>
        </Dialog>
    );
}

/* ── page ─────────────────────────────────────────────────── */

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
    const [selectedName, setSelectedName] = useState(null);
    const [toast, setToast] = useState('');

    // The class-teacher session (from the class-card login) decides who may
    // edit/transfer: only for students of the signed-in teacher's own class.
    const session = readClassLogin();

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

    const selectedStudent = (students || []).find((s) => s.name === selectedName) ?? null;
    const canManageSelected = Boolean(
        session && selectedStudent && session.className === selectedStudent.className
    );

    const handleSave = (originalName, patch) => {
        setStudents((prev) => prev.map((s) => (s.name === originalName ? { ...s, ...patch } : s)));
        if (patch.name && patch.name !== originalName) setSelectedName(patch.name);
        setToast('Student record saved');
    };

    const handleTransfer = (name, toClass, reason) => {
        setStudents((prev) => prev.map((s) => (s.name === name ? { ...s, className: toClass } : s)));
        setToast(`${name} transferred to ${toClass}${reason ? ` — ${reason}` : ''}`);
    };

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
                                sx={{ fontWeight: 700, borderRadius: 1, textTransform: 'none',
                                    color: 'text.secondary', '&:hover': { color: 'primary.main' } }}>
                                ← Back
                            </Button>
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
                        listed by class. Open a student's ID card for details, editing and transfers.
                    </Typography>
                </Box>

                {session && (
                    <Alert severity="success" icon={<BadgeIcon />} sx={{ mb: 3, borderRadius: 1.25 }}>
                        Signed in as <strong>{session.teacher || 'class teacher'}</strong> ({session.className}) —
                        you can edit and transfer the students of your class.
                    </Alert>
                )}

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
                                                <TableCell sx={{ width: 110 }} />
                                            </TableRow>
                                        </TableHead>
                                        <TableBody>
                                            {group.students.map((s, i) => (
                                                <TableRow key={s.name} hover sx={{ cursor: 'pointer' }}
                                                    onClick={() => setSelectedName(s.name)}>
                                                    <TableCell sx={{ color: 'text.secondary' }}>{i + 1}</TableCell>
                                                    <TableCell sx={{ fontWeight: 600 }}>{s.name}</TableCell>
                                                    <TableCell sx={{ textAlign: 'right' }} onClick={(e) => e.stopPropagation()}>
                                                        <Button size="small" startIcon={<BadgeIcon sx={{ fontSize: 15 }} />}
                                                            onClick={() => setSelectedName(s.name)}
                                                            sx={{ textTransform: 'none', fontWeight: 700, color: 'primary.main' }}>
                                                            ID Card
                                                        </Button>
                                                    </TableCell>
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

            {/* ── ID card dialog ── */}
            {selectedStudent && (
                <IdCardDialog
                    student={selectedStudent}
                    canManage={canManageSelected}
                    classes={CLASS_OPTIONS}
                    onClose={() => setSelectedName(null)}
                    onSave={handleSave}
                    onTransfer={handleTransfer}
                />
            )}

            <Snackbar open={Boolean(toast)} autoHideDuration={3500}
                onClose={() => setToast('')} message={toast} />

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
