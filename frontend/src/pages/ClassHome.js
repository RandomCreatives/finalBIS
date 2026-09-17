import { useEffect, useMemo, useRef, useState } from 'react';
import { Link as RouterLink, useNavigate, useParams, Navigate } from 'react-router-dom';
import {
    Alert, Box, Button, Card, CardContent, Chip, CircularProgress, Container, Dialog, Divider, Grid,
    IconButton, InputAdornment, MenuItem, Paper, Snackbar, Table, TableBody, TableCell,
    TableContainer, TableHead, TableRow, Tab, Tabs, TextField, ToggleButton, ToggleButtonGroup,
    Tooltip, Typography, useTheme,
} from '@mui/material';
import { alpha } from '@mui/material/styles';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import LogoutIcon from '@mui/icons-material/Logout';
import LightModeIcon from '@mui/icons-material/LightMode';
import DarkModeIcon from '@mui/icons-material/DarkMode';
import SchoolIcon from '@mui/icons-material/School';
import DashboardIcon from '@mui/icons-material/Dashboard';
import FactCheckIcon from '@mui/icons-material/FactCheck';
import GradeIcon from '@mui/icons-material/Grade';
import MenuBookOutlinedIcon from '@mui/icons-material/MenuBookOutlined';
import GroupsIcon from '@mui/icons-material/Groups';
import CalendarMonthIcon from '@mui/icons-material/CalendarMonth';
import EventIcon from '@mui/icons-material/Event';
import AddIcon from '@mui/icons-material/Add';
import SearchIcon from '@mui/icons-material/Search';
import DownloadIcon from '@mui/icons-material/Download';
import GridViewIcon from '@mui/icons-material/GridView';
import CloseIcon from '@mui/icons-material/Close';
import SendIcon from '@mui/icons-material/Send';
import LockIcon from '@mui/icons-material/Lock';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import SaveIcon from '@mui/icons-material/Save';
import { useColorScheme } from '../theme';
import {
    classBySlug, readClassLogin, clearClassLogin, CLASS_SUBJECTS,
} from '../data/classes';
import { studentApi, classApi, attendanceApi, marksheetApi, assignmentApi, termApi } from '../api/endpoints';
import { clearToken } from '../api/client';
import useApi from '../hooks/useApi';
import StudentIdCard from '../components/StudentIdCard';
import { CalendarBoard } from './PublicCalendar';
import WordEditor from '../components/WordEditor';
import Spreadsheet, { makeModel } from '../components/Spreadsheet';

/*
 * Main teacher dashboard — where a class-card login lands.
 *
 * Demo-stage workspace: a welcome header for the teacher and a sidebar to
 * manage the class day-to-day — attendance, marksheets per subject, lesson
 * plans and the student roster. All entries persist in localStorage under
 * the class name; the real sign-in redesign will move this onto the live
 * system's data.
 */

const STORE = {
    marks: 'bisnoc.demo.marks',
    planning: 'bisnoc.demo.planningDocs',
};

const rgba = (hex, a) => {
    const n = parseInt(hex.slice(1), 16);
    return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
};

const readStore = (key) => {
    try { return JSON.parse(localStorage.getItem(key)) ?? {}; } catch { return {}; }
};
const writeStore = (key, value) => localStorage.setItem(key, JSON.stringify(value));

const gradeFor = (p) => (p >= 90 ? 'A+' : p >= 80 ? 'A' : p >= 70 ? 'B+'
    : p >= 60 ? 'B' : p >= 50 ? 'C' : p >= 40 ? 'D' : 'F');

const GRADE_COLORS = {
    'A+': '#15803d', A: '#16a34a', 'B+': '#65a30d', B: '#ca8a04',
    C: '#d97706', D: '#ea580c', F: '#dc2626',
};

const today = () => new Date().toISOString().slice(0, 10);

// Term 1 starts 24 Aug 2026 (per the school calendar) — derive the week.
const TERM1_START = new Date('2026-08-24T00:00:00');
const termWeekOf = (dateStr) => {
    const days = Math.floor((new Date(dateStr) - TERM1_START) / 86400000);
    return Math.min(17, Math.max(1, Math.floor(days / 7) + 1));
};

const greeting = () => {
    const h = new Date().getHours();
    if (h < 12) return 'Good morning';
    if (h < 18) return 'Good afternoon';
    return 'Good evening';
};

const ATTENDANCE_STATUSES = [
    { key: 'present', label: 'P', full: 'Present', color: '#16a34a' },
    { key: 'late', label: 'L', full: 'Late', color: '#d97706' },
    { key: 'absent', label: 'A', full: 'Absent', color: '#dc2626' },
    { key: 'excused', label: 'E', full: 'Excused', color: '#0284c7' },
];

const SECTIONS = [
    { id: 'overview', label: 'Overview', icon: DashboardIcon },
    { id: 'attendance', label: 'Attendance', icon: FactCheckIcon },
    { id: 'marks', label: 'Marksheets', icon: GradeIcon },
    { id: 'plans', label: 'Planning', icon: MenuBookOutlinedIcon },
    { id: 'calendar', label: 'Calendar', icon: CalendarMonthIcon },
    { id: 'students', label: 'Students', icon: GroupsIcon },
    { id: 'timetable', label: 'Timetable', icon: EventIcon, soon: true },
];

/* ── small pieces ─────────────────────────────────────────── */

function StatCard({ icon: Icon, label, value, hint, color = 'primary.main' }) {
    const theme = useTheme();
    const resolved = color === 'primary.main' ? theme.palette.primary.main : color;
    return (
        <Card variant="outlined" sx={{ borderRadius: 1.5, height: '100%' }}>
            <CardContent sx={{ p: 2.25 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25 }}>
                    <Box sx={{ width: 38, height: 38, borderRadius: 1, display: 'flex',
                        alignItems: 'center', justifyContent: 'center',
                        bgcolor: alpha(resolved, 0.1),
                        color: resolved }}>
                        <Icon sx={{ fontSize: 19 }} />
                    </Box>
                    <Box sx={{ minWidth: 0 }}>
                        <Typography sx={{ fontSize: 11, fontWeight: 700, color: 'text.secondary',
                            textTransform: 'uppercase', letterSpacing: .5 }}>{label}</Typography>
                        <Typography sx={{ fontSize: 20, fontWeight: 800, lineHeight: 1.2 }}>{value}</Typography>
                    </Box>
                </Box>
                {hint && <Typography sx={{ fontSize: 11.5, color: 'text.secondary', mt: 1 }}>{hint}</Typography>}
            </CardContent>
        </Card>
    );
}

/* ── attendance section ───────────────────────────────────── */

const GRID_STATUS_META = {
    present: { label: 'P', color: '#16a34a' },
    late: { label: 'L', color: '#d97706' },
    absent: { label: 'A', color: '#dc2626' },
    excused: { label: 'E', color: '#0284c7' },
};

const monthLabel = (month) => new Date(`${month}-01T00:00:00`)
    .toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });

function MonthlyGridDialog({ classId, month, klassName, open, onClose }) {
    const theme = useTheme();
    const surface = theme.palette.mode === 'dark' ? theme.palette.background.paper : '#ffffff';

    const grid = useApi(
        () => (open && classId
            ? attendanceApi.monthlyGrid({ classId, month })
            : Promise.resolve(null)),
        [open, classId, month]
    );

    const days = grid.data?.days || [];
    const students = grid.data?.students || [];

    return (
        <Dialog open={open} onClose={onClose} maxWidth="xl" fullWidth
            PaperProps={{ sx: { borderRadius: 2, overflow: 'hidden' } }}>
            {/* header stripe */}
            <Box sx={{ px: 2.5, py: 1.25, display: 'flex', alignItems: 'center', gap: 1.25,
                bgcolor: 'primary.main', color: '#fff' }}>
                <GridViewIcon sx={{ fontSize: 18 }} />
                <Typography sx={{ fontWeight: 800, fontSize: 13.5, letterSpacing: .6, textTransform: 'uppercase' }}>
                    {monthLabel(month)} · {klassName} · Attendance at a glance
                </Typography>
                <IconButton size="small" onClick={onClose} sx={{ color: '#fff', ml: 'auto' }} aria-label="Close">
                    <CloseIcon sx={{ fontSize: 17 }} />
                </IconButton>
            </Box>

            <Box sx={{ p: 2.5 }}>
                {/* legend */}
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, alignItems: 'center', mb: 1.75 }}>
                    {Object.entries(GRID_STATUS_META).map(([key, meta]) => (
                        <Chip key={key} size="small"
                            label={`${meta.label} = ${key}`}
                            sx={{ fontWeight: 700, borderRadius: 1, height: 22, fontSize: 11,
                                bgcolor: alpha(meta.color, 0.12), color: meta.color }} />
                    ))}
                    {grid.data && (
                        <Chip size="small" label={`${days.length} school days`}
                            sx={{ fontWeight: 700, borderRadius: 1, height: 22, fontSize: 11 }} />
                    )}
                </Box>

                {grid.loading && (
                    <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
                        <CircularProgress />
                    </Box>
                )}
                {grid.error && (
                    <Alert severity="error" sx={{ borderRadius: 1.5 }}
                        action={<Button size="small" onClick={grid.reload}>Retry</Button>}>
                        {grid.error}
                    </Alert>
                )}
                {grid.data && days.length === 0 && (
                    <Alert severity="info" sx={{ borderRadius: 1.5 }}>
                        No school days yet this month.
                    </Alert>
                )}

                {grid.data && days.length > 0 && (
                    <TableContainer component={Paper} variant="outlined"
                        sx={{ borderRadius: 1.5, maxHeight: '62vh', overflow: 'auto' }}>
                        <Table size="small" stickyHeader>
                            <TableHead>
                                <TableRow>
                                    <TableCell sx={{ fontWeight: 700, minWidth: 170, bgcolor: surface,
                                        position: 'sticky', left: 0, zIndex: 3 }}>
                                        Student
                                    </TableCell>
                                    {days.map((d) => (
                                        <TableCell key={d} align="center"
                                            sx={{ minWidth: 36, p: 0.75, fontWeight: 700, bgcolor: surface }}>
                                            {Number(d.slice(8))}
                                        </TableCell>
                                    ))}
                                    <TableCell align="right" sx={{ fontWeight: 700, bgcolor: surface, minWidth: 70 }}>
                                        Rate
                                    </TableCell>
                                </TableRow>
                            </TableHead>
                            <TableBody>
                                {students.map((s) => (
                                    <TableRow key={s.id} hover>
                                        <TableCell sx={{ position: 'sticky', left: 0, zIndex: 2, bgcolor: surface,
                                            fontWeight: 600, whiteSpace: 'nowrap' }}>
                                            {s.name}
                                        </TableCell>
                                        {days.map((d) => {
                                            const status = s.marks[d];
                                            const meta = status ? GRID_STATUS_META[status] : null;
                                            return (
                                                <TableCell key={d} align="center" sx={{ p: 0.5 }}>
                                                    {meta ? (
                                                        <Box sx={{ bgcolor: alpha(meta.color, 0.16), color: meta.color,
                                                            fontWeight: 800, fontSize: 11, borderRadius: 0.75, py: 0.4 }}>
                                                            {meta.label}
                                                        </Box>
                                                    ) : (
                                                        <Box sx={{ color: 'divider' }}>·</Box>
                                                    )}
                                                </TableCell>
                                            );
                                        })}
                                        <TableCell align="right" sx={{ fontWeight: 800 }}>
                                            {s.attendanceRate === null ? '—' : `${s.attendanceRate}%`}
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </TableContainer>
                )}

                <Box sx={{ display: 'flex', justifyContent: 'flex-end', mt: 2 }}>
                    <Button onClick={onClose} variant="contained" disableElevation
                        sx={{ fontWeight: 700, textTransform: 'none', borderRadius: 1, px: 3 }}>
                        Close
                    </Button>
                </Box>
            </Box>
        </Dialog>
    );
}

function DailyRegister({ klass, classId, roster, monthSubmission, onToast }) {
    const [date, setDate] = useState(today());
    const [records, setRecords] = useState({});
    const [saving, setSaving] = useState(false);
    const [showGrid, setShowGrid] = useState(false);

    const locked = monthSubmission?.status === 'submitted';

    const existing = useApi(
        () => (classId
            ? attendanceApi.forClass({ classId, date })
            : Promise.resolve([])),
        [classId, date]
    );

    // Seed the toggles from whatever is already recorded.
    useEffect(() => {
        const next = {};
        (existing.data || []).forEach((r) => {
            if (r.student?.id) next[r.student.id] = r.status;
        });
        setRecords(next);
    }, [existing.data]);

    const setStatus = (id, status) => setRecords((r) => ({ ...r, [id]: status }));

    const markAllPresent = () => {
        const next = {};
        roster.forEach((s) => { next[s.id] = 'present'; });
        setRecords(next);
    };

    const save = async () => {
        setSaving(true);
        try {
            const payload = roster.map((s) => ({
                studentId: s.id,
                status: records[s.id] || 'present',
            }));
            await attendanceApi.mark({ classId, date, records: payload });
            existing.reload();
            onToast(`Register saved for ${date}`);
        } catch (err) {
            onToast(err.message || 'Could not save the register');
        } finally {
            setSaving(false);
        }
    };

    const tally = ATTENDANCE_STATUSES.map((st) => ({
        ...st,
        count: roster.filter((s) => (records[s.id] || 'present') === st.key).length,
    }));

    return (
        <Box>
            {locked && (
                <Alert severity="warning" icon={<LockIcon />} sx={{ mb: 2, borderRadius: 1.5 }}>
                    This month has been submitted and is locked. Ask an admin to return it for
                    correction if something needs fixing.
                </Alert>
            )}

            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1.5, alignItems: 'center', mb: 2.5 }}>
                <TextField label="Date" type="date" size="small" value={date}
                    onChange={(e) => setDate(e.target.value)}
                    InputLabelProps={{ shrink: true }} sx={{ width: 170 }} />
                <Tooltip title="Show this month at a glance">
                    <Button size="small" variant={showGrid ? 'contained' : 'outlined'}
                        startIcon={<GridViewIcon sx={{ fontSize: 16 }} />}
                        onClick={() => setShowGrid((v) => !v)}
                        sx={{ fontWeight: 700, textTransform: 'none', borderRadius: 1 }}>
                        {monthLabel(date.slice(0, 7))}
                    </Button>
                </Tooltip>
                <Chip label={`Week ${termWeekOf(date)} · Term 1`} size="small"
                    sx={{ fontWeight: 700, borderRadius: 1, bgcolor: 'rgba(2,132,199,.1)', color: '#0284c7' }} />
                {existing.loading && <CircularProgress size={16} />}
                <Box sx={{ ml: 'auto', display: 'flex', gap: 1 }}>
                    <Button size="small" onClick={markAllPresent} disabled={locked}
                        sx={{ fontWeight: 700, textTransform: 'none', color: 'text.secondary' }}>
                        Mark all present
                    </Button>
                    <Button size="small" variant="contained" disableElevation startIcon={<SaveIcon />}
                        onClick={save} disabled={locked || saving || roster.length === 0}
                        sx={{ fontWeight: 700, textTransform: 'none', borderRadius: 1 }}>
                        {saving ? 'Saving…' : 'Save register'}
                    </Button>
                </Box>
            </Box>

            <Box sx={{ display: 'flex', gap: 1, mb: 2, flexWrap: 'wrap' }}>
                {tally.map((t) => (
                    <Chip key={t.key} size="small" label={`${t.full}: ${t.count}`}
                        sx={{ fontWeight: 700, borderRadius: 1, bgcolor: alpha(t.color, 0.1), color: t.color }} />
                ))}
            </Box>

            <TableContainer component={Paper} variant="outlined" sx={{ borderRadius: 1.5 }}>
                <Table size="small">
                    <TableHead>
                        <TableRow>
                            <TableCell sx={{ width: 56, fontWeight: 700 }}>Roll</TableCell>
                            <TableCell sx={{ fontWeight: 700 }}>Student</TableCell>
                            <TableCell sx={{ width: 220, fontWeight: 700 }}>Status</TableCell>
                        </TableRow>
                    </TableHead>
                    <TableBody>
                        {roster.map((s) => (
                            <TableRow key={s.id} hover>
                                <TableCell sx={{ color: 'text.secondary' }}>{s.rollNum ?? '—'}</TableCell>
                                <TableCell sx={{ fontWeight: 600 }}>{s.name}</TableCell>
                                <TableCell>
                                    <ToggleButtonGroup size="small" exclusive disabled={locked}
                                        value={records[s.id] || 'present'}
                                        onChange={(_, v) => v && setStatus(s.id, v)}>
                                        {ATTENDANCE_STATUSES.map((st) => (
                                            <ToggleButton key={st.key} value={st.key}
                                                sx={{ px: 1.4, py: .3, minWidth: 40, fontWeight: 800, fontSize: 12 }}>
                                                {st.label}
                                            </ToggleButton>
                                        ))}
                                    </ToggleButtonGroup>
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </TableContainer>

            <MonthlyGridDialog classId={classId} month={date.slice(0, 7)}
                klassName={klass.name} open={showGrid} onClose={() => setShowGrid(false)} />
        </Box>
    );
}

function MonthlyReview({ klass, classId, onToast }) {
    const [month, setMonth] = useState(today().slice(0, 7));
    const [submitting, setSubmitting] = useState(false);
    const [downloading, setDownloading] = useState(false);

    const summary = useApi(
        () => (classId
            ? attendanceApi.monthly({ classId, month })
            : Promise.resolve(null)),
        [classId, month]
    );

    const submission = summary.data?.submission ?? null;
    const locked = submission?.status === 'submitted';

    const submit = async () => {
        // eslint-disable-next-line no-alert
        if (!window.confirm(`Submit ${month} attendance for ${klass.name} to the admin? The month will be locked until the admin returns it.`)) return;
        setSubmitting(true);
        try {
            await attendanceApi.submitMonth({ classId, month });
            await summary.reload();
            onToast(`${month} submitted to the admin`);
        } catch (err) {
            onToast(err.message || 'Could not submit the month');
        } finally {
            setSubmitting(false);
        }
    };

    const downloadCsv = async () => {
        setDownloading(true);
        try {
            const blob = await attendanceApi.reportCsv({ classId, month });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `attendance_${klass.name.replace(/[^a-z0-9]+/gi, '-')}_${month}.csv`;
            document.body.appendChild(a);
            a.click();
            a.remove();
            URL.revokeObjectURL(url);
            onToast('Monthly report downloaded');
        } catch (err) {
            onToast(err.message || 'Could not download the report');
        } finally {
            setDownloading(false);
        }
    };

    return (
        <Box>
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1.5, alignItems: 'center', mb: 2 }}>
                <TextField label="Month" type="month" size="small" value={month}
                    onChange={(e) => setMonth(e.target.value)}
                    InputLabelProps={{ shrink: true }} sx={{ width: 170 }} />
                {summary.data && (
                    <>
                        <Chip size="small" label={`${summary.data.daysMarked}/${summary.data.schoolDays} school days marked`}
                            sx={{ fontWeight: 700, borderRadius: 1 }} />
                        {submission && (
                            <Chip size="small"
                                label={submission.status === 'submitted'
                                    ? `Submitted ${new Date(submission.submittedAt).toLocaleDateString('en-GB')}`
                                    : 'Returned for correction'}
                                color={submission.status === 'submitted' ? 'success' : 'warning'}
                                sx={{ fontWeight: 700, borderRadius: 1 }} />
                        )}
                    </>
                )}
                <Box sx={{ ml: 'auto', display: 'flex', gap: 1 }}>
                    <Button size="small" variant="outlined" startIcon={<DownloadIcon />}
                        onClick={downloadCsv} disabled={downloading || !summary.data}
                        sx={{ fontWeight: 700, textTransform: 'none', borderRadius: 1 }}>
                        {downloading ? 'Preparing…' : 'Download CSV'}
                    </Button>
                    {!locked && (
                        <Button size="small" variant="contained" disableElevation startIcon={<SendIcon />}
                            onClick={submit} disabled={submitting || !summary.data}
                            sx={{ fontWeight: 700, textTransform: 'none', borderRadius: 1 }}>
                            {submitting ? 'Submitting…' : 'Submit month to admin'}
                        </Button>
                    )}
                </Box>
            </Box>

            {submission?.status === 'returned' && submission.note && (
                <Alert severity="warning" sx={{ mb: 2, borderRadius: 1.5 }}>
                    Admin note: {submission.note} — fix the registers and submit again.
                </Alert>
            )}

            {summary.loading && (
                <Box sx={{ display: 'flex', justifyContent: 'center', py: 5 }}><CircularProgress /></Box>
            )}
            {summary.error && (
                <Alert severity="error" sx={{ borderRadius: 1.5 }}
                    action={<Button size="small" onClick={summary.reload}>Retry</Button>}>
                    {summary.error}
                </Alert>
            )}

            {summary.data && (
                <TableContainer component={Paper} variant="outlined" sx={{ borderRadius: 1.5 }}>
                    <Table size="small">
                        <TableHead>
                            <TableRow>
                                <TableCell sx={{ fontWeight: 700 }}>Student</TableCell>
                                <TableCell sx={{ width: 70 }} align="center">P</TableCell>
                                <TableCell sx={{ width: 70 }} align="center">L</TableCell>
                                <TableCell sx={{ width: 70 }} align="center">A</TableCell>
                                <TableCell sx={{ width: 70 }} align="center">E</TableCell>
                                <TableCell sx={{ width: 90 }} align="right">Rate</TableCell>
                            </TableRow>
                        </TableHead>
                        <TableBody>
                            {summary.data.students.map((s) => (
                                <TableRow key={s.id} hover>
                                    <TableCell sx={{ fontWeight: 600 }}>{s.name}</TableCell>
                                    <TableCell align="center" sx={{ color: '#16a34a', fontWeight: 700 }}>{s.present}</TableCell>
                                    <TableCell align="center" sx={{ color: '#d97706', fontWeight: 700 }}>{s.late}</TableCell>
                                    <TableCell align="center" sx={{ color: '#dc2626', fontWeight: 700 }}>{s.absent}</TableCell>
                                    <TableCell align="center" sx={{ color: '#0284c7', fontWeight: 700 }}>{s.excused}</TableCell>
                                    <TableCell align="right" sx={{ fontWeight: 800 }}>
                                        {s.attendanceRate === null ? '—' : `${s.attendanceRate}%`}
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </TableContainer>
            )}
        </Box>
    );
}

function AttendanceSection({ klass, classId, roster }) {
    const [tab, setTab] = useState('daily');
    const [toast, setToast] = useState('');

    const monthSubmissionApi = useApi(
        () => (classId
            ? attendanceApi.monthly({ classId, month: today().slice(0, 7) })
                .then((d) => d.submission)
            : Promise.resolve(null)),
        [classId]
    );

    return (
        <Box>
            <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ mb: 2.5, minHeight: 36,
                '& .MuiTab-root': { minHeight: 36, fontWeight: 700, textTransform: 'none' } }}>
                <Tab value="daily" label="Daily register" />
                <Tab value="monthly" label="Monthly review & submission" />
            </Tabs>

            {tab === 'daily' && (
                <DailyRegister klass={klass} classId={classId} roster={roster}
                    monthSubmission={monthSubmissionApi.data} onToast={setToast} />
            )}
            {tab === 'monthly' && (
                <MonthlyReview klass={klass} classId={classId} onToast={setToast} />
            )}

            <Snackbar open={Boolean(toast)} autoHideDuration={3500}
                onClose={() => setToast('')} message={toast} />
        </Box>
    );
}

/* ── marksheets section ───────────────────────────────────── */

function MarksSection({ klass, classId, roster }) {
    const [subjectId, setSubjectId] = useState('');
    const [entries, setEntries] = useState({});
    const [baseline, setBaseline] = useState('{}');
    const [saving, setSaving] = useState(false);
    const [toast, setToast] = useState('');

    // Current term — marks are stored per term.
    const currentTerm = useApi(() => termApi.current().then((d) => d.term), []);
    const termId = currentTerm.data?.id ?? null;

    // Subjects offered in this class (from this year's assignments).
    const classSubjects = useApi(
        () => (classId
            ? assignmentApi.subjects({ classId }).then((d) => d.assignments)
            : Promise.resolve([])),
        [classId]
    );
    const subjects = useMemo(() => {
        const seen = new Map();
        (classSubjects.data || []).forEach((a) => {
            if (a.subject?.id && !seen.has(a.subject.id)) seen.set(a.subject.id, a.subject);
        });
        return [...seen.values()].sort((a, b) => a.name.localeCompare(b.name));
    }, [classSubjects.data]);

    // Default to the first subject once known.
    useEffect(() => {
        if (!subjectId && subjects.length > 0) setSubjectId(subjects[0].id);
    }, [subjects, subjectId]);

    // Existing marks for (class, subject, term).
    const existing = useApi(
        () => (classId && subjectId && termId
            ? marksheetApi.list({ classId, subjectId, termId })
            : Promise.resolve([])),
        [classId, subjectId, termId]
    );

    // Seed editable entries from the loaded marks.
    useEffect(() => {
        const next = {};
        (existing.data || []).forEach((m) => {
            if (m.student?.id) {
                next[m.student.id] = { marks: String(m.marks), maxMarks: String(m.maxMarks) };
            }
        });
        setEntries(next);
        setBaseline(JSON.stringify(next));
    }, [existing.data]);

    const setField = (studentId, field, value) => {
        setEntries((prev) => ({
            ...prev,
            [studentId]: { marks: '', maxMarks: '100', ...prev[studentId], [field]: value },
        }));
    };

    const dirtyIds = roster
        .filter((s) => {
            const e = entries[s.id];
            if (!e || e.marks === '' || e.marks === undefined) return false;
            const base = JSON.parse(baseline)[s.id];
            return JSON.stringify(e) !== JSON.stringify(base);
        })
        .map((s) => s.id);

    const invalidIds = roster.filter((s) => {
        const e = entries[s.id];
        if (!e || e.marks === '') return false;
        const marks = Number(e.marks);
        const max = Number(e.maxMarks) || 100;
        return Number.isNaN(marks) || marks < 0 || marks > max;
    }).map((s) => s.id);

    const graded = roster.filter((s) => entries[s.id]?.marks !== '' && entries[s.id]?.marks !== undefined);
    const average = graded.length
        ? graded.reduce((sum, s) => {
            const e = entries[s.id];
            const max = Number(e.maxMarks) || 100;
            return sum + (Number(e.marks) / max) * 100;
        }, 0) / graded.length
        : null;

    const save = async () => {
        if (dirtyIds.length === 0 || invalidIds.length > 0) return;
        setSaving(true);
        try {
            const payload = {
                classId,
                termId,
                entries: dirtyIds.map((studentId) => ({
                    studentId,
                    subjectId,
                    marks: Number(entries[studentId].marks),
                    maxMarks: Number(entries[studentId].maxMarks) || 100,
                })),
            };
            await marksheetApi.bulkSave(payload);
            await existing.reload();
            setToast('Marks saved — grades computed by the system');
        } catch (err) {
            setToast(err.message || 'Could not save marks');
        } finally {
            setSaving(false);
        }
    };


    return (
        <Box>
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1.5, alignItems: 'center', mb: 2.5 }}>
                <TextField select label="Subject" size="small" value={subjectId}
                    onChange={(e) => setSubjectId(e.target.value)} sx={{ minWidth: 200 }}>
                    {subjects.map((s) => <MenuItem key={s.id} value={s.id}>{s.name}</MenuItem>)}
                </TextField>
                {currentTerm.data && (
                    <Chip size="small" label={currentTerm.data.name}
                        sx={{ fontWeight: 700, borderRadius: 1 }} />
                )}
                {average !== null && (
                    <Chip size="small" label={`Average ${average.toFixed(1)}% · ${gradeFor(average)}`}
                        sx={{ fontWeight: 700, borderRadius: 1,
                            bgcolor: alpha(GRADE_COLORS[gradeFor(average)], 0.12),
                            color: GRADE_COLORS[gradeFor(average)] }} />
                )}
                <Chip size="small" label={`${graded.length}/${roster.length} graded`}
                    sx={{ fontWeight: 700, borderRadius: 1 }} />
                <Box sx={{ ml: 'auto', display: 'flex', gap: 1, alignItems: 'center' }}>
                    {invalidIds.length > 0 && (
                        <Chip size="small" color="error" label={`${invalidIds.length} invalid`}
                            sx={{ fontWeight: 700, borderRadius: 1 }} />
                    )}
                    <Button size="small" variant="contained" disableElevation startIcon={<SaveIcon />}
                        onClick={save}
                        disabled={saving || dirtyIds.length === 0 || invalidIds.length > 0 || !subjectId}
                        sx={{ fontWeight: 700, textTransform: 'none', borderRadius: 1 }}>
                        {saving ? 'Saving…' : `Save ${dirtyIds.length || ''} mark${dirtyIds.length === 1 ? '' : 's'}`.trim()}
                    </Button>
                </Box>
            </Box>

            {!subjectId && subjects.length === 0 && !classSubjects.loading && (
                <Alert severity="info" sx={{ borderRadius: 1.5 }}>
                    No subjects are assigned to {klass.name} yet — an admin assigns them under
                    Assignments → Subject teaching.
                </Alert>
            )}

            {subjectId && (
                <TableContainer component={Paper} variant="outlined" sx={{ borderRadius: 1.5 }}>
                    <Table size="small">
                        <TableHead>
                            <TableRow>
                                <TableCell sx={{ width: 56, fontWeight: 700 }}>Roll</TableCell>
                                <TableCell sx={{ fontWeight: 700 }}>Student</TableCell>
                                <TableCell sx={{ width: 110, fontWeight: 700 }}>Marks</TableCell>
                                <TableCell sx={{ width: 100, fontWeight: 700 }}>Max</TableCell>
                                <TableCell sx={{ width: 80, fontWeight: 700 }} align="right">%</TableCell>
                                <TableCell sx={{ width: 80, fontWeight: 700 }} align="center">Grade</TableCell>
                            </TableRow>
                        </TableHead>
                        <TableBody>
                            {roster.map((s) => {
                                const e = entries[s.id] || { marks: '', maxMarks: '100' };
                                const marksOk = e.marks !== '' && !Number.isNaN(Number(e.marks));
                                const maxOk = e.maxMarks !== '' && Number(e.maxMarks) > 0;
                                const invalid = marksOk && maxOk && Number(e.marks) > Number(e.maxMarks);
                                const pct = marksOk && maxOk && !invalid
                                    ? (Number(e.marks) / Number(e.maxMarks)) * 100
                                    : null;
                                return (
                                    <TableRow key={s.id} hover>
                                        <TableCell sx={{ color: 'text.secondary' }}>{s.rollNum ?? '—'}</TableCell>
                                        <TableCell sx={{ fontWeight: 600 }}>{s.name}</TableCell>
                                        <TableCell>
                                            <TextField type="number" size="small" value={e.marks} placeholder="—"
                                                error={invalid}
                                                onChange={(ev) => setField(s.id, 'marks', ev.target.value)}
                                                inputProps={{ min: 0, step: '0.5', style: { textAlign: 'right' } }}
                                                fullWidth />
                                        </TableCell>
                                        <TableCell>
                                            <TextField type="number" size="small" value={e.maxMarks}
                                                error={invalid}
                                                onChange={(ev) => setField(s.id, 'maxMarks', ev.target.value)}
                                                inputProps={{ min: 1, step: 1, style: { textAlign: 'right' } }}
                                                fullWidth />
                                        </TableCell>
                                        <TableCell align="right">
                                            {pct === null ? '—' : `${pct.toFixed(1)}%`}
                                        </TableCell>
                                        <TableCell align="center">
                                            {pct === null ? '—' : (
                                                <Chip size="small" label={gradeFor(pct)}
                                                    sx={{ fontWeight: 800, minWidth: 42, borderRadius: 1,
                                                        bgcolor: GRADE_COLORS[gradeFor(pct)], color: '#fff' }} />
                                            )}
                                        </TableCell>
                                    </TableRow>
                                );
                            })}
                        </TableBody>
                    </Table>
                </TableContainer>
            )}

            <Snackbar open={Boolean(toast)} autoHideDuration={3500}
                onClose={() => setToast('')} message={toast} />
        </Box>
    );
}

const PLANNING_TEMPLATES = {
    blank: {
        label: 'Blank page',
        title: (k) => `Planning — ${k.name}`,
        html: '<p><br></p>',
    },
    sheet: {
        label: 'Spreadsheet',
        title: (k) => `Spreadsheet — ${k.name}`,
        sheet: true,
    },
    scheme: {
        label: 'Scheme of Work',
        title: (k) => `Scheme of Work — ${k.name}`,
        html: `
<h1>Scheme of Work</h1>
<p><strong>School:</strong> British International School — NOC Gerji<br>
<strong>Class:</strong> ____________ &nbsp;&nbsp; <strong>Subject:</strong> ____________ &nbsp;&nbsp; <strong>Term:</strong> ____________ (2026/27)<br>
<strong>Teacher:</strong> ____________</p>
<table class="doc-table"><tbody>
<tr><th>Week</th><th>Unit / Topic</th><th>Learning objectives</th><th>Activities &amp; resources</th><th>Reflection</th></tr>
${'<tr><td>&nbsp;</td><td>&nbsp;</td><td>&nbsp;</td><td>&nbsp;</td><td>&nbsp;</td></tr>'.repeat(12)}
</tbody></table>
<p><br></p>`,
    },
    lesson: {
        label: 'Lesson Plan',
        title: (k) => `Lesson Plan — ${k.name}`,
        html: `
<h1>Lesson Plan</h1>
<p><strong>Date:</strong> ____________ &nbsp;&nbsp; <strong>Week:</strong> ____________ &nbsp;&nbsp;
<strong>Class:</strong> ____________ &nbsp;&nbsp; <strong>Subject:</strong> ____________ &nbsp;&nbsp;
<strong>Period:</strong> ____________</p>
<h2>1. Objectives</h2>
<p>By the end of the lesson, learners will be able to…</p>
<h2>2. Materials &amp; resources</h2>
<p><br></p>
<h2>3. Introduction (5–10 min)</h2>
<p><br></p>
<h2>4. Lesson development</h2>
<p><br></p>
<h2>5. Closure &amp; summary</h2>
<p><br></p>
<h2>6. Assessment / evidence of learning</h2>
<p><br></p>
<h2>7. Reflection (complete after teaching)</h2>
<p><br></p>`,
    },
};

const DOC_TYPE_META = {
    sheet: { label: 'Spreadsheet', color: '#0891b2' },
    scheme: { label: 'Scheme of Work', color: '#7c3aed' },
    lesson: { label: 'Lesson Plan', color: '#2563eb' },
    blank: { label: 'Document', color: '#64748b' },
};
function DocEditor({ doc, klass, onBack, onPatch, onToast }) {
    const saveTimer = useRef(null);
    const [status, setStatus] = useState('saved');

    const handleHtml = (html) => {
        setStatus('saving');
        if (saveTimer.current) clearTimeout(saveTimer.current);
        saveTimer.current = setTimeout(() => {
            onPatch({ html });
            setStatus('saved');
        }, 600);
    };

    const handleModel = (model) => {
        setStatus('saving');
        if (saveTimer.current) clearTimeout(saveTimer.current);
        saveTimer.current = setTimeout(() => {
            onPatch({ model });
            setStatus('saved');
        }, 600);
    };

    useEffect(() => () => { if (saveTimer.current) clearTimeout(saveTimer.current); }, []);

    const meta = DOC_TYPE_META[doc.type] || DOC_TYPE_META.blank;

    return (
        <Box>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25, mb: 2, flexWrap: 'wrap' }}>
                <Button size="small" onClick={onBack}
                    sx={{ fontWeight: 700, textTransform: 'none', color: 'text.secondary' }}>
                    ← All documents
                </Button>
                <Chip size="small" label={meta.label}
                    sx={{ fontWeight: 700, borderRadius: 1, height: 22, fontSize: 11,
                        bgcolor: rgba(meta.color, 0.1), color: meta.color }} />
                <TextField size="small" value={doc.title} sx={{ flexGrow: 1, maxWidth: 460,
                    '& .MuiInputBase-input': { fontSize: 14, fontWeight: 700 } }}
                    onChange={(e) => onPatch({ title: e.target.value })} />
                <Typography sx={{ fontSize: 12, fontWeight: 700, ml: 'auto',
                    color: status === 'saving' ? 'text.secondary' : '#16a34a' }}>
                    {status === 'saving' ? 'Saving…' : '✓ Saved'}
                </Typography>
            </Box>
            {doc.type === 'sheet' ? (
                <Spreadsheet
                    key={doc.id}
                    value={doc.model || makeModel()}
                    onChange={handleModel}
                />
            ) : (
                <WordEditor
                    key={doc.id}
                    initialHtml={doc.html}
                    onHtmlChange={handleHtml}
                    printHeader={`${meta.label} · ${klass.name}`}
                />
            )}
            <Snackbar open={false} message="" />
        </Box>
    );
}

function PlanningSection({ klass, onToast }) {
    const [docs, setDocs] = useState(() => readStore(STORE.planning)[klass.name] || []);
    const [openId, setOpenId] = useState(null);

    const persist = (next) => {
        setDocs(next);
        const all = readStore(STORE.planning);
        all[klass.name] = next;
        writeStore(STORE.planning, all);
    };

    const createDoc = (type) => {
        const tpl = PLANNING_TEMPLATES[type];
        const doc = {
            id: `doc-${Date.now()}`,
            type,
            title: tpl.title(klass),
            html: tpl.sheet ? undefined : tpl.html,
            model: tpl.sheet ? makeModel() : undefined,
            updatedAt: Date.now(),
        };
        persist([doc, ...docs]);
        setOpenId(doc.id);
        onToast(`${tpl.label} created`);
    };

    const patchDoc = (id, patch) => {
        persist(docs.map((d) => (d.id === id ? { ...d, ...patch, updatedAt: Date.now() } : d)));
    };

    const deleteDoc = (id) => {
        // eslint-disable-next-line no-alert
        if (!window.confirm('Delete this document? This cannot be undone.')) return;
        persist(docs.filter((d) => d.id !== id));
        if (openId === id) setOpenId(null);
        onToast('Document deleted');
    };

    const openDoc = docs.find((d) => d.id === openId);
    if (openDoc) {
        return (
            <DocEditor doc={openDoc} klass={klass}
                onBack={() => setOpenId(null)}
                onPatch={(patch) => patchDoc(openDoc.id, patch)}
                onToast={onToast} />
        );
    }

    return (
        <Box>
            <Box sx={{ display: 'flex', gap: 1, mb: 2.5, flexWrap: 'wrap', alignItems: 'center' }}>
                <Typography sx={{ fontSize: 13, color: 'text.secondary', flexGrow: 1 }}>
                    Build your planning as a Word-like page (formatted text, tables, printing) or an
                    Excel-like spreadsheet — schemes of work, weekly plans, grade trackers, anything.
                </Typography>
                {Object.entries(PLANNING_TEMPLATES).map(([type, tpl]) => (
                    <Button key={type} size="small" variant={type === 'blank' ? 'outlined' : 'contained'}
                        disableElevation startIcon={<AddIcon sx={{ fontSize: 15 }} />}
                        onClick={() => createDoc(type)}
                        sx={{ fontWeight: 700, textTransform: 'none', borderRadius: 1 }}>
                        New {tpl.label}
                    </Button>
                ))}
            </Box>

            {docs.length === 0 ? (
                <Alert severity="info" sx={{ borderRadius: 1.5 }}>
                    No planning documents yet — start with a <strong>Scheme of Work</strong> for the term,
                    then add weekly <strong>Lesson Plans</strong>.
                </Alert>
            ) : (
                <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 1.75 }}>
                    {docs.map((d) => {
                        const meta = DOC_TYPE_META[d.type] || DOC_TYPE_META.blank;
                        return (
                            <Card key={d.id} variant="outlined"
                                sx={{ borderRadius: 1.5, cursor: 'pointer', transition: 'border-color .15s, transform .15s',
                                    '&:hover': { borderColor: 'primary.main', transform: 'translateY(-2px)' } }}
                                onClick={() => setOpenId(d.id)}>
                                <CardContent sx={{ p: 2.25 }}>
                                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                                        <Chip size="small" label={meta.label}
                                            sx={{ fontWeight: 700, borderRadius: 1, height: 20, fontSize: 10.5,
                                                bgcolor: rgba(meta.color, 0.1), color: meta.color }} />
                                        <Box sx={{ ml: 'auto' }} onClick={(e) => e.stopPropagation()}>
                                            <Tooltip title="Delete">
                                                <IconButton size="small" onClick={() => deleteDoc(d.id)}>
                                                    <DeleteOutlineIcon sx={{ fontSize: 16 }} />
                                                </IconButton>
                                            </Tooltip>
                                        </Box>
                                    </Box>
                                    <Typography sx={{ fontWeight: 800, fontSize: 14.5, lineHeight: 1.3 }}>
                                        {d.title}
                                    </Typography>
                                    <Typography sx={{ fontSize: 11.5, color: 'text.secondary', mt: .75 }}>
                                        Last edited {new Date(d.updatedAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}{' '}
                                        at {new Date(d.updatedAt).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
                                    </Typography>
                                </CardContent>
                            </Card>
                        );
                    })}
                </Box>
            )}
        </Box>
    );
}

/* ── students section ─────────────────────────────────────── */

function StudentsSection({ klass, roster, loading, error, reload, classNames, classIdByName }) {
    const [search, setSearch] = useState('');
    const [selected, setSelected] = useState(null);
    const [saving, setSaving] = useState(false);
    const [toast, setToast] = useState('');

    const filtered = useMemo(() => {
        const q = search.trim().toLowerCase();
        if (!q) return roster;
        return roster.filter((s) =>
            s.name.toLowerCase().includes(q)
            || (s.admissionNo || '').toLowerCase().includes(q));
    }, [roster, search]);

    const selectedStudent = roster.find((s) => s.id === selected) ?? null;

    const handleSave = async (patch) => {
        if (!selectedStudent) return;
        setSaving(true);
        try {
            await studentApi.update(selectedStudent.id, patch);
            await reload();
            setToast('Student record saved');
        } catch (err) {
            setToast(err.message || 'Could not save changes');
        } finally {
            setSaving(false);
        }
    };

    const handleTransfer = async (toClassName, reason) => {
        if (!selectedStudent) return;
        const toClassId = classIdByName[toClassName];
        if (!toClassId) { setToast('Unknown class'); return; }
        setSaving(true);
        try {
            await studentApi.transfer(selectedStudent.id, toClassId, reason);
            const name = selectedStudent.name;
            await reload();
            setSelected(null);
            setToast(`${name} transferred to ${toClassName}`);
        } catch (err) {
            setToast(err.message || 'Transfer failed');
        } finally {
            setSaving(false);
        }
    };

    return (
        <Box>
            <Box sx={{ display: 'flex', gap: 1.5, mb: 2, alignItems: 'center', flexWrap: 'wrap' }}>
                <TextField
                    placeholder="Search by name or admission no…"
                    size="small" value={search} onChange={(e) => setSearch(e.target.value)}
                    sx={{ flexGrow: 1, maxWidth: 360 }}
                    InputProps={{
                        startAdornment: (
                            <InputAdornment position="start">
                                <SearchIcon fontSize="small" sx={{ color: 'text.secondary' }} />
                            </InputAdornment>
                        ),
                    }}
                />
                <Typography sx={{ fontSize: 13, color: 'text.secondary' }}>
                    {filtered.length} of {roster.length} student{roster.length === 1 ? '' : 's'} in {klass.name}
                </Typography>
            </Box>

            {loading && (
                <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
                    <CircularProgress />
                </Box>
            )}
            {error && (
                <Alert severity="error" sx={{ borderRadius: 1.5 }}
                    action={<Button size="small" onClick={reload}>Retry</Button>}>
                    Could not load the class list: {error}
                </Alert>
            )}
            {!loading && !error && roster.length === 0 && (
                <Alert severity="info" sx={{ borderRadius: 1.5 }}>
                    No students have been placed in this class yet.
                </Alert>
            )}

            {!loading && !error && roster.length > 0 && (
                <TableContainer component={Paper} variant="outlined" sx={{ borderRadius: 1.5 }}>
                    <Table size="small">
                        <TableHead>
                            <TableRow>
                                <TableCell sx={{ width: 56, fontWeight: 700 }}>Roll</TableCell>
                                <TableCell sx={{ width: 130, fontWeight: 700 }}>Admission</TableCell>
                                <TableCell sx={{ fontWeight: 700 }}>Student name</TableCell>
                                <TableCell sx={{ width: 150, fontWeight: 700 }}>Guardian phone</TableCell>
                                <TableCell sx={{ width: 100 }} />
                            </TableRow>
                        </TableHead>
                        <TableBody>
                            {filtered.map((s) => (
                                <TableRow key={s.id} hover sx={{ cursor: 'pointer' }} onClick={() => setSelected(s.id)}>
                                    <TableCell sx={{ color: 'text.secondary' }}>{s.rollNum ?? '—'}</TableCell>
                                    <TableCell sx={{ fontFamily: 'monospace', fontSize: 12 }}>{s.admissionNo || '—'}</TableCell>
                                    <TableCell sx={{ fontWeight: 600 }}>{s.name}</TableCell>
                                    <TableCell sx={{ fontSize: 12.5 }}>{s.guardianPhone || '—'}</TableCell>
                                    <TableCell onClick={(e) => e.stopPropagation()}>
                                        <Button size="small" onClick={() => setSelected(s.id)}
                                            sx={{ fontWeight: 700, textTransform: 'none', color: 'primary.main' }}>
                                            ID Card
                                        </Button>
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </TableContainer>
            )}

            {selectedStudent && (
                <StudentIdCard
                    student={{ ...selectedStudent, className: klass.name }}
                    canManage
                    classes={classNames}
                    saving={saving}
                    onClose={() => setSelected(null)}
                    onSave={handleSave}
                    onTransfer={handleTransfer}
                />
            )}

            <Snackbar open={Boolean(toast)} autoHideDuration={3000}
                onClose={() => setToast('')} message={toast} />
        </Box>
    );
}

function OverviewSection({ klass, classId, roster, goTo }) {
    const plans = readStore(STORE.planning)[klass.name] || [];

    // Live attendance: days marked so far this month.
    const month = today().slice(0, 7);
    const grid = useApi(
        () => (classId
            ? attendanceApi.monthlyGrid({ classId, month })
            : Promise.resolve(null)),
        [classId, month]
    );
    const attendanceDays = grid.data?.days?.length
        ? new Set(grid.data.students.flatMap((s) => Object.keys(s.marks))).size
        : 0;

    // Live marks: distinct subjects that have any mark recorded.
    const marks = useApi(
        () => (classId ? marksheetApi.list({ classId }) : Promise.resolve([])),
        [classId]
    );
    const subjectsGraded = new Set((marks.data || []).map((m) => m.subject?.id)).size;

    return (
        <Box>
            <Grid container spacing={2}>
                <Grid item xs={6} md={3}>
                    <StatCard icon={GroupsIcon} label="Students" value={roster.length}
                        hint={`Capacity ${klass.capacity ?? 30} per class`} />
                </Grid>
                <Grid item xs={6} md={3}>
                    <StatCard icon={FactCheckIcon} label="Attendance days" value={attendanceDays}
                        hint={attendanceDays ? 'Registers saved' : 'No registers yet'} color="#16a34a" />
                </Grid>
                <Grid item xs={6} md={3}>
                    <StatCard icon={GradeIcon} label="Subjects graded" value={subjectsGraded}
                        hint={`of ${CLASS_SUBJECTS.length} subjects`} color="#ca8a04" />
                </Grid>
                <Grid item xs={6} md={3}>
                    <StatCard icon={MenuBookOutlinedIcon} label="Planning docs" value={plans.length}
                        hint={plans.length ? 'Schemes & lesson plans' : 'None yet'} color="#0284c7" />
                </Grid>
            </Grid>

            <Typography sx={{ fontWeight: 800, fontSize: 15, mt: 4, mb: 1.5 }}>Quick actions</Typography>
            <Box sx={{ display: 'flex', gap: 1.25, flexWrap: 'wrap' }}>
                <Button variant="contained" disableElevation startIcon={<FactCheckIcon />}
                    onClick={() => goTo('attendance')} sx={{ fontWeight: 700, textTransform: 'none', borderRadius: 1 }}>
                    Take today's register
                </Button>
                <Button variant="outlined" startIcon={<GradeIcon />}
                    onClick={() => goTo('marks')} sx={{ fontWeight: 700, textTransform: 'none', borderRadius: 1 }}>
                    Enter marks
                </Button>
                <Button variant="outlined" startIcon={<MenuBookOutlinedIcon />}
                    onClick={() => goTo('plans')} sx={{ fontWeight: 700, textTransform: 'none', borderRadius: 1 }}>
                    Write planning
                </Button>
            </Box>

            <Alert severity="info" sx={{ mt: 3, borderRadius: 1.5 }}>
                This workspace is the demo stage of the main-teacher dashboard — entries stay in this
                browser. The sign-in redesign connects it to the school's live records.
            </Alert>
        </Box>
    );
}

/* ── the dashboard ────────────────────────────────────────── */

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
    const [section, setSection] = useState('overview');

    // Live roster from the school database. The class login stored the class
    // id plus a real JWT for the class's main teacher, which the API client
    // attaches to every request.
    const liveRoster = useApi(
        () => (session?.classId
            ? studentApi.list({ classId: session.classId })
            : Promise.resolve([])),
        [session?.classId]
    );
    const roster = useMemo(
        () => [...(liveRoster.data || [])].sort(
            (a, b) => a.name.localeCompare(b.name, 'en', { sensitivity: 'base' })
        ),
        [liveRoster.data]
    );

    // All classes — for the transfer picker.
    const allClasses = useApi(() => classApi.list().catch(() => []), []);
    const classNames = useMemo(
        () => (allClasses.data || []).map((cl) => cl.name).sort(),
        [allClasses.data]
    );
    const classIdByName = useMemo(() => {
        const m = {};
        (allClasses.data || []).forEach((cl) => { m[cl.name] = cl.id; });
        return m;
    }, [allClasses.data]);

    if (!klass || !session || session.slug !== slug || !session.classId) {
        // Old or incomplete session — go back through the class login.
        return <Navigate to="/classes" replace />;
    }

    const signOut = () => {
        clearClassLogin();
        clearToken();
        navigate('/classes');
    };

    const dateLine = new Date().toLocaleDateString('en-GB', {
        weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
    });

    const activeSection = SECTIONS.find((s) => s.id === section);

    return (
        <Box sx={{ minHeight: '100vh', bgcolor: 'background.default', color: 'text.primary' }}>
            {/* ── top bar ── */}
            <Box component="header" sx={{ position: 'sticky', top: 0, zIndex: 100,
                borderBottom: `1px solid ${border}`, bgcolor: alpha(surface, 0.9),
                backdropFilter: 'blur(12px)' }}>
                <Container maxWidth="xl">
                    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                        minHeight: 60, gap: 2 }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, minWidth: 0 }}>
                            <Button component={RouterLink} to="/classes" size="small"
                                startIcon={<ArrowBackIcon />}
                                sx={{ fontWeight: 700, borderRadius: 1, textTransform: 'none', flexShrink: 0,
                                    color: 'text.secondary', '&:hover': { color: 'primary.main' } }}>
                                Classes
                            </Button>
                            <Box sx={{ width: 1, height: 24, bgcolor: border }} />
                            <Box sx={{ width: 34, height: 34, borderRadius: 1, bgcolor: 'primary.main',
                                color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                <SchoolIcon sx={{ fontSize: 18 }} />
                            </Box>
                            <Typography sx={{ fontWeight: 800, fontSize: 14.5, whiteSpace: 'nowrap' }}>
                                BIS NOC Gerji
                            </Typography>
                        </Box>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <Box onClick={toggleColorScheme} sx={{ display: 'flex', alignItems: 'center',
                                justifyContent: 'center', width: 34, height: 34, borderRadius: 1,
                                border: `1px solid ${border}`, cursor: 'pointer', color: 'text.secondary',
                                '&:hover': { color: 'primary.main', borderColor: 'primary.main' } }}
                                aria-label="Toggle theme">
                                {dark ? <LightModeIcon sx={{ fontSize: 17 }} /> : <DarkModeIcon sx={{ fontSize: 17 }} />}
                            </Box>
                            <Button onClick={signOut} variant="outlined" size="small" startIcon={<LogoutIcon />}
                                sx={{ fontWeight: 700, borderRadius: 1, px: 2, textTransform: 'none' }}>
                                Sign Out
                            </Button>
                        </Box>
                    </Box>
                </Container>
            </Box>

            {/* ── welcome header ── */}
            <Box sx={{ borderBottom: `1px solid ${border}`,
                bgcolor: dark ? alpha(theme.palette.primary.main, 0.06) : alpha(theme.palette.primary.main, 0.04) }}>
                <Container maxWidth="xl">
                    <Box sx={{ py: { xs: 3, md: 3.5 }, display: 'flex', flexWrap: 'wrap',
                        alignItems: 'center', gap: 2 }}>
                        <Box sx={{ width: 52, height: 52, borderRadius: '50%', flexShrink: 0,
                            bgcolor: 'primary.main', color: '#fff', display: 'flex',
                            alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 20 }}>
                            {(klass.mainTeacher || 'T').replace(/^(Mr|Ms|Mrs)\.?\s*/i, '').charAt(0).toUpperCase()}
                        </Box>
                        <Box sx={{ minWidth: 0 }}>
                            <Typography sx={{ fontWeight: 800, fontSize: { xs: 20, md: 24 }, letterSpacing: '-.02em', lineHeight: 1.15 }}>
                                {greeting()}, {klass.mainTeacher || 'Teacher'}
                            </Typography>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: .5, flexWrap: 'wrap' }}>
                                <Chip label={klass.name} size="small"
                                    sx={{ fontWeight: 700, borderRadius: 1, height: 22,
                                        bgcolor: 'primary.main', color: '#fff' }} />
                                <Chip label="Main Teacher" size="small" variant="outlined"
                                    sx={{ fontWeight: 700, borderRadius: 1, height: 22 }} />
                                <Typography sx={{ fontSize: 12.5, color: 'text.secondary' }}>
                                    {dateLine} · Week {termWeekOf(today())} of Term 1
                                </Typography>
                            </Box>
                        </Box>
                    </Box>
                </Container>
            </Box>

            {/* ── body: sidebar + content ── */}
            <Container maxWidth="xl" sx={{ py: 3 }}>
                <Box sx={{ display: 'flex', gap: 3, flexDirection: { xs: 'column', md: 'row' },
                    alignItems: 'flex-start' }}>
                    {/* sidebar */}
                    <Paper variant="outlined" sx={{ borderRadius: 1.5, p: 1, flexShrink: 0,
                        width: { md: 220 }, display: 'flex', flexDirection: { xs: 'row', md: 'column' },
                        gap: .5, overflowX: 'auto', maxWidth: '100%', position: { md: 'sticky' }, top: { md: 76 } }}>
                        {SECTIONS.map((s) => {
                            const Icon = s.icon;
                            const active = section === s.id;
                            return (
                                <Button key={s.id} disabled={s.soon}
                                    onClick={() => !s.soon && setSection(s.id)}
                                    startIcon={<Icon sx={{ fontSize: 18 }} />}
                                    sx={{ justifyContent: 'flex-start', textTransform: 'none',
                                        fontWeight: active ? 800 : 600, borderRadius: 1, px: 1.5, py: 1,
                                        whiteSpace: 'nowrap', minWidth: { xs: 'auto', md: 0 },
                                        color: active ? '#fff' : s.soon ? 'text.disabled' : 'text.primary',
                                        bgcolor: active ? 'primary.main' : 'transparent',
                                        '&:hover': active ? { bgcolor: 'primary.dark' } : { bgcolor: alpha(theme.palette.primary.main, 0.06) } }}>
                                    {s.label}
                                    {s.soon && (
                                        <Chip label="soon" size="small" sx={{ ml: 1, height: 16, fontSize: 9,
                                            fontWeight: 800, bgcolor: 'rgba(100,116,139,.12)', color: 'text.secondary' }} />
                                    )}
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
                            <Typography sx={{ fontWeight: 800, fontSize: 19, letterSpacing: '-.01em' }}>
                                {activeSection.label}
                            </Typography>
                        </Box>
                        <Divider sx={{ mb: 2.5 }} />

                        {section === 'overview' && <OverviewSection klass={klass} classId={session.classId} roster={roster} goTo={setSection} />}
                        {section === 'attendance' && <AttendanceSection klass={klass} classId={session.classId} roster={roster} />}
                        {section === 'marks' && <MarksSection klass={klass} classId={session.classId} roster={roster} />}
                        {section === 'plans' && <PlanningSection klass={klass} onToast={() => {}} />}
{section === 'calendar' && <CalendarBoard />}
                        {section === 'students' && (
                            <StudentsSection klass={klass} roster={roster}
                                loading={liveRoster.loading} error={liveRoster.error}
                                reload={liveRoster.reload}
                                classNames={classNames} classIdByName={classIdByName} />
                        )}
                        {section === 'timetable' && <Alert severity="info">The weekly timetable arrives in a later version.</Alert>}
                    </Box>
                </Box>
            </Container>
        </Box>
    );
}
