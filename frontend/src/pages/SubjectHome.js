import { useEffect, useMemo, useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import {
    Alert, Box, Button, Chip, CircularProgress, Container, Dialog, DialogActions, DialogContent,
    DialogTitle, Divider, Grid, IconButton, Paper, Snackbar, Table, TableBody, TableCell,
    TableContainer, TableHead, TableRow, TextField, Tooltip, Typography, useTheme, MenuItem,
} from '@mui/material';
import { alpha } from '@mui/material/styles';
import LogoutIcon from '@mui/icons-material/Logout';
import SchoolIcon from '@mui/icons-material/School';
import DashboardIcon from '@mui/icons-material/Dashboard';
import EventIcon from '@mui/icons-material/Event';
import GroupsIcon from '@mui/icons-material/Groups';
import GradeIcon from '@mui/icons-material/Grade';
import MenuBookOutlinedIcon from '@mui/icons-material/MenuBookOutlined';
import AddIcon from '@mui/icons-material/Add';
import SaveIcon from '@mui/icons-material/Save';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import PersonIcon from '@mui/icons-material/Person';
import {
    IdentityCard, TelegramCard, SecurityCard, TeachingCard, PreferencesCard,
} from '../components/settings/profileCards';
import { assignmentApi, assessmentApi, studentApi, termApi, timetableApi } from '../api/endpoints';
import useApi from '../hooks/useApi';
import { useAuth } from '../auth/AuthContext';
import { useColorScheme } from '../theme';
import LightModeIcon from '@mui/icons-material/LightMode';
import DarkModeIcon from '@mui/icons-material/DarkMode';

const DAYS = [
    { value: 1, label: 'Monday' },
    { value: 2, label: 'Tuesday' },
    { value: 3, label: 'Wednesday' },
    { value: 4, label: 'Thursday' },
    { value: 5, label: 'Friday' },
];

const hhmm = (t) => (t ? t.slice(0, 5) : '');

/** Same colour language as the admin and class timetables. */
const tint = (slot) => {
    if (slot.subject?.code === 'SPL') return '#f3e8ff';
    if (slot.subject?.code === 'REG') return '#f1f5f9';
    return slot.subject?.taughtBy === 'main_teacher' ? '#eef2ff' : '#ecfdf5';
};

const gradeFor = (p) => (p >= 90 ? 'A+' : p >= 80 ? 'A' : p >= 70 ? 'B+'
    : p >= 60 ? 'B' : p >= 50 ? 'C' : p >= 40 ? 'D' : 'F');
const GRADE_COLORS = {
    'A+': '#14532d', A: '#166534', 'B+': '#1e40af', B: '#1d4ed8',
    C: '#b45309', D: '#c2410c', F: '#b91c1c',
};

const SECTIONS = [
    { id: 'overview', label: 'Overview', icon: DashboardIcon },
    { id: 'week', label: 'My week', icon: EventIcon },
    { id: 'classes', label: 'My classes', icon: GroupsIcon },
    { id: 'marks', label: 'Marks', icon: GradeIcon },
    { id: 'profile', label: 'Profile', icon: PersonIcon },
];

const StatCard = ({ icon: Icon, label, value, dark }) => (
    <Paper variant="outlined" sx={{ p: 2, borderRadius: 1.5, display: 'flex', alignItems: 'center', gap: 1.5 }}>
        <Box sx={{ width: 40, height: 40, borderRadius: 1, display: 'flex', alignItems: 'center',
            justifyContent: 'center', bgcolor: alpha('#4f46e5', dark ? 0.25 : 0.1), color: 'primary.main' }}>
            <Icon sx={{ fontSize: 20 }} />
        </Box>
        <Box>
            <Typography sx={{ fontWeight: 800, fontSize: 22, lineHeight: 1.1 }}>{value}</Typography>
            <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600 }}>{label}</Typography>
        </Box>
    </Paper>
);

/* ── my week grid ─────────────────────────────────────────── */

function WeekGrid({ slots }) {
    if (!slots || slots.length === 0) {
        return <Alert severity="info">No lessons have been scheduled for you yet.</Alert>;
    }
    return (
        <Grid container spacing={1.5}>
            {DAYS.map((day) => {
                const daySlots = slots
                    .filter((s) => s.dayOfWeek === day.value)
                    .sort((a, b) => a.startsAt.localeCompare(b.startsAt));
                return (
                    <Grid item xs={12} sm={6} md key={day.value}>
                        <Paper variant="outlined" sx={{ p: 1.25, height: '100%' }}>
                            <Typography variant="subtitle2" sx={{ mb: 1, textAlign: 'center', color: 'text.secondary', fontWeight: 800 }}>
                                {day.label}
                            </Typography>
                            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                                {daySlots.length === 0 && (
                                    <Typography variant="caption" color="text.disabled" textAlign="center">—</Typography>
                                )}
                                {daySlots.map((slot) => (
                                    <Box key={slot.id} sx={{ p: 1, borderRadius: 1.5, bgcolor: tint(slot),
                                        border: '1px solid', borderColor: 'divider' }}>
                                        <Typography variant="caption" color="text.secondary">
                                            {hhmm(slot.startsAt)}–{hhmm(slot.endsAt)}
                                        </Typography>
                                        <Typography variant="body2" sx={{ fontWeight: 700, lineHeight: 1.3 }}>
                                            {slot.class?.name || 'Class'}
                                        </Typography>
                                        <Typography variant="caption" display="block" color="text.secondary">
                                            {slot.subject?.name || 'Period'}
                                        </Typography>
                                        {slot.room && (
                                            <Typography variant="caption" color="text.disabled">{slot.room}</Typography>
                                        )}
                                    </Box>
                                ))}
                            </Box>
                        </Paper>
                    </Grid>
                );
            })}
        </Grid>
    );
}

/* ── my classes ───────────────────────────────────────────── */

function ClassCard({ group }) {
    const [open, setOpen] = useState(false);
    const roster = useApi(
        () => (open ? studentApi.list({ classId: group.classId }) : Promise.resolve(null)),
        [open, group.classId]
    );
    const students = useMemo(
        () => [...(roster.data || [])].sort((a, b) => a.name.localeCompare(b.name)),
        [roster.data]
    );
    return (
        <Paper variant="outlined" sx={{ borderRadius: 1.5, overflow: 'hidden' }}>
            <Box sx={{ p: 2, display: 'flex', alignItems: 'center', gap: 1.5, flexWrap: 'wrap' }}>
                <Box sx={{ flexGrow: 1, minWidth: 200 }}>
                    <Typography sx={{ fontWeight: 800, fontSize: 16 }}>{group.className}</Typography>
                    <Box sx={{ display: 'flex', gap: 0.75, mt: 0.75, flexWrap: 'wrap' }}>
                        {group.subjects.map((s) => (
                            <Chip key={s.id} size="small"
                                label={`${s.name} · ${s.sessionsPerWeek}/wk`}
                                sx={{ fontWeight: 700, borderRadius: 1,
                                    bgcolor: s.code === 'SPL' ? '#f3e8ff' : '#ecfdf5' }} />
                        ))}
                    </Box>
                </Box>
                <Button size="small" variant="outlined" onClick={() => setOpen((o) => !o)}
                    endIcon={open ? <ExpandLessIcon /> : <ExpandMoreIcon />}
                    sx={{ textTransform: 'none', fontWeight: 700, borderRadius: 1 }}>
                    {open ? 'Hide students' : 'View students'}
                </Button>
            </Box>
            {open && (
                <>
                    <Divider />
                    <Box sx={{ p: 2, pt: 1.5 }}>
                        {roster.loading && <CircularProgress size={22} />}
                        {roster.error && <Alert severity="error">Could not load the class list.</Alert>}
                        {roster.data && students.length === 0 && (
                            <Alert severity="info">No students are enrolled in this class yet.</Alert>
                        )}
                        {students.length > 0 && (
                            <Grid container spacing={0.5}>
                                {students.map((s, i) => (
                                    <Grid item xs={12} sm={6} md={4} key={s.id}>
                                        <Box sx={{ display: 'flex', gap: 1, py: 0.5, alignItems: 'baseline' }}>
                                            <Typography variant="caption" color="text.disabled" sx={{ width: 20, textAlign: 'right' }}>
                                                {i + 1}
                                            </Typography>
                                            <Typography variant="body2" sx={{ fontWeight: 600 }}>{s.name}</Typography>
                                        </Box>
                                    </Grid>
                                ))}
                            </Grid>
                        )}
                        <Typography variant="caption" color="text.disabled" sx={{ display: 'block', mt: 1 }}>
                            Read-only — student lists are managed by the class's main teacher.
                        </Typography>
                    </Box>
                </>
            )}
        </Paper>
    );
}

/* ── marks ────────────────────────────────────────────────── */

function MarksSection({ pairs }) {
    const [pairKey, setPairKey] = useState('');
    const [edits, setEdits] = useState({});
    const [saving, setSaving] = useState(false);
    const [toast, setToast] = useState('');

    const [createOpen, setCreateOpen] = useState(false);
    const [newLabel, setNewLabel] = useState('');
    const [newMax, setNewMax] = useState('10');
    const [creating, setCreating] = useState(false);
    const [createError, setCreateError] = useState('');

    useEffect(() => {
        if (!pairKey && pairs.length > 0) setPairKey(pairs[0].key);
    }, [pairs, pairKey]);
    const pair = pairs.find((p) => p.key === pairKey) || null;
    const classId = pair?.classId ?? null;
    const subjectId = pair?.subjectId ?? null;

    const currentTerm = useApi(() => termApi.current().then((d) => d.term), []);
    const termId = currentTerm.data?.id ?? null;

    const rosterApi = useApi(
        () => (classId ? studentApi.list({ classId }) : Promise.resolve([])),
        [classId]
    );
    const roster = useMemo(
        () => [...(rosterApi.data || [])].sort((a, b) => a.name.localeCompare(b.name)),
        [rosterApi.data]
    );

    const assessmentsApi = useApi(
        () => (classId && subjectId && termId
            ? assessmentApi.list({ classId, subjectId, termId })
            : Promise.resolve([])),
        [classId, subjectId, termId]
    );
    const assessments = assessmentsApi.data || [];

    useEffect(() => { setEdits({}); }, [assessmentsApi.data]);

    const loadedValue = (aid, sid) => {
        const a = assessments.find((x) => x.id === aid);
        const v = a?.marks?.[sid];
        return v === undefined || v === null ? '' : String(v);
    };
    const currentValue = (aid, sid) => {
        const key = `${aid}|${sid}`;
        return key in edits ? edits[key] : loadedValue(aid, sid);
    };

    const dirtyEntries = useMemo(() => {
        const out = [];
        assessments.forEach((a) => roster.forEach((s) => {
            const cur = currentValue(a.id, s.id);
            if (cur !== loadedValue(a.id, s.id) && cur !== '') {
                out.push({ assessmentId: a.id, studentId: s.id, value: cur });
            }
        }));
        return out;
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [edits, assessments, roster]);

    const invalidCells = useMemo(() => {
        const set = new Set();
        assessments.forEach((a) => roster.forEach((s) => {
            const cur = currentValue(a.id, s.id);
            if (cur !== '' && (Number.isNaN(Number(cur)) || Number(cur) > a.maxMarks)) {
                set.add(`${a.id}|${s.id}`);
            }
        }));
        return set;
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [edits, assessments, roster]);

    const finalFor = (sid) => {
        let marks = 0;
        let max = 0;
        assessments.forEach((a) => {
            const v = currentValue(a.id, sid);
            if (v !== '' && !Number.isNaN(Number(v))) {
                marks += Number(v);
                max += a.maxMarks;
            }
        });
        if (max === 0) return null;
        return { marks, max, pct: (marks / max) * 100 };
    };

    const createAssessment = async () => {
        const max = Number(newMax);
        if (!newLabel.trim()) { setCreateError('Give the assessment a name.'); return; }
        if (!(max > 0)) { setCreateError('The mark must be greater than zero.'); return; }
        setCreating(true);
        setCreateError('');
        try {
            await assessmentApi.create({ classId, subjectId, termId, label: newLabel.trim(), maxMarks: max });
            await assessmentsApi.reload();
            setCreateOpen(false);
            setNewLabel('');
            setNewMax('10');
            setToast('Assessment column added');
        } catch (err) {
            setCreateError(err.message || 'Could not create the assessment');
        } finally {
            setCreating(false);
        }
    };

    const deleteAssessment = async (a) => {
        // eslint-disable-next-line no-alert
        if (!window.confirm(`Delete "${a.label}" and all its marks?`)) return;
        try {
            await assessmentApi.remove(a.id);
            await assessmentsApi.reload();
            setToast('Assessment column removed');
        } catch (err) {
            setToast(err.message || 'Could not delete the assessment');
        }
    };

    const save = async () => {
        if (dirtyEntries.length === 0 || invalidCells.size > 0) return;
        setSaving(true);
        try {
            await assessmentApi.saveMarks({
                classId,
                subjectId,
                termId,
                entries: dirtyEntries.map((e) => ({
                    assessmentId: e.assessmentId,
                    studentId: e.studentId,
                    marks: Number(e.value),
                })),
            });
            await assessmentsApi.reload();
            setEdits({});
            setToast('Marks saved — final computed automatically');
        } catch (err) {
            setToast(err.message || 'Could not save marks');
        } finally {
            setSaving(false);
        }
    };

    if (pairs.length === 0) {
        return <Alert severity="info">You have no teaching assignments this year.</Alert>;
    }

    return (
        <Box>
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1.5, alignItems: 'center', mb: 2.5 }}>
                <TextField select label="Class & subject" size="small" value={pairKey}
                    onChange={(e) => setPairKey(e.target.value)} sx={{ minWidth: 260 }}>
                    {pairs.map((p) => (
                        <MenuItem key={p.key} value={p.key}>{p.className} — {p.subjectName}</MenuItem>
                    ))}
                </TextField>
                {currentTerm.data && (
                    <Chip size="small" label={currentTerm.data.name} sx={{ fontWeight: 700, borderRadius: 1 }} />
                )}
                <Box sx={{ ml: 'auto', display: 'flex', gap: 1, alignItems: 'center' }}>
                    {invalidCells.size > 0 && (
                        <Chip size="small" color="error" label={`${invalidCells.size} over max`}
                            sx={{ fontWeight: 700, borderRadius: 1 }} />
                    )}
                    <Button size="small" variant="outlined" startIcon={<AddIcon sx={{ fontSize: 16 }} />}
                        onClick={() => setCreateOpen(true)} disabled={!subjectId}
                        sx={{ fontWeight: 700, textTransform: 'none', borderRadius: 1 }}>
                        Create assessment
                    </Button>
                    <Button size="small" variant="contained" disableElevation startIcon={<SaveIcon />}
                        onClick={save} disabled={saving || dirtyEntries.length === 0 || invalidCells.size > 0}
                        sx={{ fontWeight: 700, textTransform: 'none', borderRadius: 1 }}>
                        {saving ? 'Saving…' : `Save marks${dirtyEntries.length > 0 ? ` (${dirtyEntries.length})` : ''}`}
                    </Button>
                </Box>
            </Box>

            {(rosterApi.loading || assessmentsApi.loading) && (
                <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}><CircularProgress size={26} /></Box>
            )}
            {(rosterApi.error || assessmentsApi.error) && (
                <Alert severity="error">Could not load the marksheet for this class.</Alert>
            )}

            {!rosterApi.loading && !assessmentsApi.loading && !rosterApi.error && (
                assessments.length === 0 ? (
                    <Alert severity="info">
                        No assessments yet for this class and subject. Create your first column
                        (e.g. "Quiz 1" out of 10) — the final is computed automatically from the columns.
                    </Alert>
                ) : (
                    <TableContainer component={Paper} variant="outlined" sx={{ borderRadius: 1.5 }}>
                        <Table size="small" stickyHeader>
                            <TableHead>
                                <TableRow>
                                    <TableCell sx={{ fontWeight: 800, minWidth: 200 }}>Student</TableCell>
                                    {assessments.map((a) => (
                                        <TableCell key={a.id} align="center" sx={{ minWidth: 110 }}>
                                            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 0.5 }}>
                                                <Box>
                                                    <Typography variant="caption" sx={{ fontWeight: 800, display: 'block' }}>
                                                        {a.label}
                                                    </Typography>
                                                    <Typography variant="caption" color="text.secondary">
                                                        /{a.maxMarks}
                                                    </Typography>
                                                </Box>
                                                <Tooltip title="Delete column and its marks">
                                                    <IconButton size="small" onClick={() => deleteAssessment(a)} sx={{ p: 0.25 }}>
                                                        <DeleteOutlineIcon sx={{ fontSize: 14 }} />
                                                    </IconButton>
                                                </Tooltip>
                                            </Box>
                                        </TableCell>
                                    ))}
                                    <TableCell align="center" sx={{ fontWeight: 800, minWidth: 90 }}>Final</TableCell>
                                    <TableCell align="center" sx={{ fontWeight: 800, minWidth: 64 }}>Grade</TableCell>
                                </TableRow>
                            </TableHead>
                            <TableBody>
                                {roster.map((s) => {
                                    const f = finalFor(s.id);
                                    return (
                                        <TableRow key={s.id} hover>
                                            <TableCell sx={{ fontWeight: 600 }}>{s.name}</TableCell>
                                            {assessments.map((a) => {
                                                const key = `${a.id}|${s.id}`;
                                                const invalid = invalidCells.has(key);
                                                return (
                                                    <TableCell key={a.id} align="center">
                                                        <TextField type="number" size="small"
                                                            value={currentValue(a.id, s.id)}
                                                            onChange={(e) => setEdits((prev) => ({ ...prev, [key]: e.target.value }))}
                                                            placeholder="—" error={invalid}
                                                            inputProps={{ min: 0, max: a.maxMarks, style: { textAlign: 'center', padding: '6px 4px' } }}
                                                            sx={{ width: 72 }} />
                                                    </TableCell>
                                                );
                                            })}
                                            <TableCell align="center" sx={{ fontWeight: 800 }}>
                                                {f ? `${f.marks}/${f.max}` : '—'}
                                            </TableCell>
                                            <TableCell align="center">
                                                {f && (
                                                    <Chip size="small" label={gradeFor(f.pct)}
                                                        sx={{ fontWeight: 800, borderRadius: 1,
                                                            color: '#fff', bgcolor: GRADE_COLORS[gradeFor(f.pct)] }} />
                                                )}
                                            </TableCell>
                                        </TableRow>
                                    );
                                })}
                            </TableBody>
                        </Table>
                    </TableContainer>
                )
            )}

            <Dialog open={createOpen} onClose={() => setCreateOpen(false)} maxWidth="xs" fullWidth>
                <DialogTitle sx={{ fontWeight: 800 }}>Create assessment</DialogTitle>
                <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 1 }}>
                    {createError && <Alert severity="error">{createError}</Alert>}
                    <Typography variant="body2" color="text.secondary">
                        An assessment "worth 10%" is entered as out of 10 marks. The final mark
                        is the sum of all columns for the term.
                    </Typography>
                    <TextField label="Name" size="small" fullWidth value={newLabel}
                        onChange={(e) => setNewLabel(e.target.value)} placeholder='e.g. "Quiz 1"' autoFocus />
                    <TextField label="Out of" type="number" size="small" value={newMax}
                        onChange={(e) => setNewMax(e.target.value)} inputProps={{ min: 1 }} />
                </DialogContent>
                <DialogActions sx={{ px: 3, pb: 2 }}>
                    <Button onClick={() => setCreateOpen(false)} sx={{ textTransform: 'none' }}>Cancel</Button>
                    <Button variant="contained" disableElevation onClick={createAssessment} disabled={creating}
                        sx={{ textTransform: 'none', fontWeight: 700 }}>
                        {creating ? 'Creating…' : 'Create'}
                    </Button>
                </DialogActions>
            </Dialog>

            <Snackbar open={Boolean(toast)} autoHideDuration={4000} onClose={() => setToast('')}
                message={toast} anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }} />
        </Box>
    );
}

/* ── the dashboard ────────────────────────────────────────── */

export default function SubjectHome() {
    const theme = useTheme();
    const dark = theme.palette.mode === 'dark';
    const { toggleColorScheme } = useColorScheme();
    const { user, logout } = useAuth();
    const navigate = useNavigate();
    const [section, setSection] = useState('overview');

    const myAssignments = useApi(
        () => (user ? assignmentApi.subjects({ teacherId: user.id }).then((d) => d.assignments || []) : Promise.resolve([])),
        [user?.id] // eslint-disable-line react-hooks/exhaustive-deps
    );
    const week = useApi(
        () => (user ? timetableApi.myWeek() : Promise.resolve([])),
        [user?.id] // eslint-disable-line react-hooks/exhaustive-deps
    );

    // Group assignments into per-class cards; marked pairs for the Marks tab.
    const { classGroups, markedPairs } = useMemo(() => {
        const byClass = new Map();
        const pairs = [];
        (myAssignments.data || []).forEach((a) => {
            const cls = a.class;
            const subj = a.subject;
            if (!cls?.id || !subj?.id || subj.code === 'REG') return;
            if (!byClass.has(cls.id)) byClass.set(cls.id, { classId: cls.id, className: cls.name, subjects: new Map() });
            const g = byClass.get(cls.id);
            if (!g.subjects.has(subj.id)) {
                g.subjects.set(subj.id, { id: subj.id, code: subj.code, name: subj.name, sessionsPerWeek: a.sessionsPerWeek });
            }
            pairs.push({
                key: `${cls.id}|${subj.id}`,
                classId: cls.id,
                className: cls.name,
                subjectId: subj.id,
                subjectName: subj.name,
            });
        });
        const groups = [...byClass.values()]
            .map((g) => ({ ...g, subjects: [...g.subjects.values()].sort((a, b) => a.name.localeCompare(b.name)) }))
            .sort((a, b) => a.className.localeCompare(b.className));
        pairs.sort((a, b) => a.className.localeCompare(b.className) || a.subjectName.localeCompare(b.subjectName));
        return { classGroups: groups, markedPairs: pairs };
    }, [myAssignments.data]);

    const todaySlots = useMemo(() => {
        const dow = new Date().getDay(); // 0 Sun … 6 Sat; school days 1–5 match the timetable
        return (week.data || [])
            .filter((s) => s.dayOfWeek === dow)
            .sort((a, b) => a.startsAt.localeCompare(b.startsAt));
    }, [week.data]);

    const subjectCount = useMemo(
        () => new Set((myAssignments.data || []).map((a) => a.subject?.id).filter(Boolean)).size,
        [myAssignments.data]
    );

    if (!user) return null;
    if (user.role !== 'subject_teacher') return <Navigate to="/app" replace />;

    const activeSection = SECTIONS.find((s) => s.id === section);
    const greeting = `Good ${new Date().getHours() < 12 ? 'morning' : new Date().getHours() < 17 ? 'afternoon' : 'evening'}`;

    return (
        <Box sx={{ minHeight: '100vh', bgcolor: dark ? 'background.default' : '#f8fafc', pb: 6 }}>
            {/* header */}
            <Box sx={{ bgcolor: dark ? 'background.paper' : '#ffffff', borderBottom: '1px solid', borderColor: 'divider' }}>
                <Container maxWidth="xl" sx={{ display: 'flex', alignItems: 'center', gap: 1.5, py: 1.5 }}>
                    <Box sx={{ width: 36, height: 36, borderRadius: 1, display: 'flex', alignItems: 'center',
                        justifyContent: 'center', bgcolor: 'primary.main', color: '#fff' }}>
                        <SchoolIcon sx={{ fontSize: 20 }} />
                    </Box>
                    <Box sx={{ flexGrow: 1 }}>
                        <Typography sx={{ fontWeight: 800, fontSize: 15, lineHeight: 1.2 }}>BIS NOC Gerji</Typography>
                        <Typography variant="caption" color="text.secondary">Subject teacher dashboard · 2026/2027</Typography>
                    </Box>
                    <Chip size="small" label={user.name} sx={{ fontWeight: 700, borderRadius: 1, mr: 0.5 }} />
                    <Tooltip title={dark ? 'Light mode' : 'Dark mode'}>
                        <IconButton size="small" onClick={toggleColorScheme}>
                            {dark ? <LightModeIcon sx={{ fontSize: 18 }} /> : <DarkModeIcon sx={{ fontSize: 18 }} />}
                        </IconButton>
                    </Tooltip>
                    <Tooltip title="Sign out">
                        <IconButton size="small" onClick={() => { logout(); navigate('/login', { replace: true }); }}>
                            <LogoutIcon sx={{ fontSize: 18 }} />
                        </IconButton>
                    </Tooltip>
                </Container>
            </Box>

            <Container maxWidth="xl" sx={{ mt: 3 }}>
                <Typography sx={{ fontWeight: 800, fontSize: 22, mb: 0.5 }}>
                    {greeting}, {user.name?.split(' ')[0]}
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
                    Your lessons, your classes and your marks — in one place.
                </Typography>

                <Box sx={{ display: 'flex', flexDirection: { xs: 'column', md: 'row' }, gap: 2.5, alignItems: 'flex-start' }}>
                    {/* sidebar */}
                    <Paper variant="outlined" sx={{ borderRadius: 1.5, p: 1, flexShrink: 0,
                        width: { md: 220 }, display: 'flex', flexDirection: { xs: 'row', md: 'column' },
                        gap: 0.5, overflowX: 'auto', maxWidth: '100%', position: { md: 'sticky' }, top: { md: 76 } }}>
                        {SECTIONS.map((s) => {
                            const Icon = s.icon;
                            const active = section === s.id;
                            return (
                                <Button key={s.id} onClick={() => setSection(s.id)}
                                    startIcon={<Icon sx={{ fontSize: 18 }} />}
                                    sx={{ justifyContent: 'flex-start', textTransform: 'none',
                                        fontWeight: active ? 800 : 600, borderRadius: 1, px: 1.5, py: 1,
                                        whiteSpace: 'nowrap', minWidth: { xs: 'auto', md: 0 },
                                        color: active ? '#fff' : 'text.primary',
                                        bgcolor: active ? 'primary.main' : 'transparent',
                                        '&:hover': active ? { bgcolor: 'primary.dark' } : { bgcolor: alpha(theme.palette.primary.main, 0.06) } }}>
                                    {s.label}
                                </Button>
                            );
                        })}
                    </Paper>

                    {/* content */}
                    <Box sx={{ flexGrow: 1, minWidth: 0, width: '100%' }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25, mb: 2.5 }}>
                            {(() => { const Icon = activeSection.icon; return (
                                <Box sx={{ width: 36, height: 36, borderRadius: 1, display: 'flex',
                                    alignItems: 'center', justifyContent: 'center',
                                    bgcolor: alpha(theme.palette.primary.main, 0.1), color: 'primary.main' }}>
                                    <Icon sx={{ fontSize: 18 }} />
                                </Box>
                            ); })()}
                            <Typography sx={{ fontWeight: 800, fontSize: 19, letterSpacing: '-0.01em' }}>
                                {activeSection.label}
                            </Typography>
                        </Box>
                        <Divider sx={{ mb: 2.5 }} />

                        {section === 'overview' && (
                            <Box>
                                <Grid container spacing={1.5} sx={{ mb: 3 }}>
                                    <Grid item xs={12} sm={4}>
                                        <StatCard icon={EventIcon} dark={dark} label="Sessions this week"
                                            value={week.loading ? '…' : (week.data || []).length} />
                                    </Grid>
                                    <Grid item xs={12} sm={4}>
                                        <StatCard icon={GroupsIcon} dark={dark} label="Classes I teach"
                                            value={myAssignments.loading ? '…' : classGroups.length} />
                                    </Grid>
                                    <Grid item xs={12} sm={4}>
                                        <StatCard icon={MenuBookOutlinedIcon} dark={dark} label="Subjects"
                                            value={myAssignments.loading ? '…' : subjectCount} />
                                    </Grid>
                                </Grid>

                                <Typography sx={{ fontWeight: 800, fontSize: 15, mb: 1.5 }}>Today</Typography>
                                {week.loading && <CircularProgress size={24} />}
                                {!week.loading && todaySlots.length === 0 && (
                                    <Alert severity="info">No lessons scheduled today. Have a good one!</Alert>
                                )}
                                {!week.loading && todaySlots.length > 0 && (
                                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                                        {todaySlots.map((slot) => (
                                            <Paper key={slot.id} variant="outlined"
                                                sx={{ p: 1.5, borderRadius: 1.5, display: 'flex', alignItems: 'center', gap: 2 }}>
                                                <Chip size="small"
                                                    label={`${hhmm(slot.startsAt)}–${hhmm(slot.endsAt)}`}
                                                    sx={{ fontWeight: 800, borderRadius: 1, bgcolor: tint(slot) }} />
                                                <Box sx={{ flexGrow: 1 }}>
                                                    <Typography sx={{ fontWeight: 700, fontSize: 14 }}>{slot.class?.name}</Typography>
                                                    <Typography variant="caption" color="text.secondary">{slot.subject?.name}</Typography>
                                                </Box>
                                                {slot.room && (
                                                    <Typography variant="caption" color="text.disabled">{slot.room}</Typography>
                                                )}
                                            </Paper>
                                        ))}
                                    </Box>
                                )}
                            </Box>
                        )}

                        {section === 'week' && (
                            week.loading
                                ? <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}><CircularProgress size={28} /></Box>
                                : week.error
                                    ? <Alert severity="error">Could not load your timetable. Please try again.</Alert>
                                    : <WeekGrid slots={week.data} />
                        )}

                        {section === 'classes' && (
                            myAssignments.loading
                                ? <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}><CircularProgress size={28} /></Box>
                                : myAssignments.error
                                    ? <Alert severity="error">Could not load your classes. Please try again.</Alert>
                                    : classGroups.length === 0
                                        ? <Alert severity="info">You have no teaching assignments this year yet.</Alert>
                                        : (
                                            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                                                {classGroups.map((g) => <ClassCard key={g.classId} group={g} />)}
                                            </Box>
                                        )
                        )}

                        {section === 'marks' && <MarksSection pairs={markedPairs} />}
                        {section === 'profile' && (
                            <Grid container spacing={2.5}>
                                <Grid item xs={12} md={7}>
                                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5 }}>
                                        <IdentityCard
                                            roleLabel="Subject Teacher"
                                            nameNote="Shown as your card on the teacher sign-in wall. Ask the coordinator to correct your name."
                                        />
                                        <SecurityCard mode="self-service" />
                                    </Box>
                                </Grid>
                                <Grid item xs={12} md={5}>
                                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5 }}>
                                        <TelegramCard />
                                        <TeachingCard
                                            items={classGroups.flatMap((g) =>
                                                g.subjects.map((s) => ({
                                                    primary: `${s.name} — ${g.className}`,
                                                    secondary: s.sessionsPerWeek
                                                        ? `${s.sessionsPerWeek} session${s.sessionsPerWeek > 1 ? 's' : ''} per week`
                                                        : null,
                                                })))}
                                        />
                                        <PreferencesCard />
                                    </Box>
                                </Grid>
                            </Grid>
                        )}
                    </Box>
                </Box>
            </Container>
        </Box>
    );
}
