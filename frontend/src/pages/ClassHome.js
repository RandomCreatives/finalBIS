import { useEffect, useMemo, useState } from 'react';
import { Link as RouterLink, useNavigate, useParams, Navigate } from 'react-router-dom';
import { lessonLabel } from '../utils/periods';
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
import PersonIcon from '@mui/icons-material/Person';
import StorefrontIcon from '@mui/icons-material/Storefront';
import VerifiedUserOutlinedIcon from '@mui/icons-material/VerifiedUserOutlined';
import ReportOutlinedIcon from '@mui/icons-material/ReportOutlined';
import {
    IdentityCard, TelegramCard, SecurityCard, TeachingCard, PreferencesCard,
} from '../components/settings/profileCards';
import { useColorScheme } from '../theme';
import {
    classBySlug, readClassLogin, clearClassLogin, CLASS_SUBJECTS,
} from '../data/classes';
import { studentApi, classApi, attendanceApi, marksheetApi, assignmentApi, termApi, assessmentApi, timetableApi } from '../api/endpoints';
import { clearToken } from '../api/client';
import useApi from '../hooks/useApi';
import StudentIdCard from '../components/StudentIdCard';
import { CalendarBoard } from './PublicCalendar';
import PlanningSection from '../components/planning/PlanningDocs';
import StoreSection from '../components/communications/StoreSection';
import RequestSection from '../components/communications/RequestSection';
import ConductSection from '../components/communications/ConductSection';
import TentativeChip from '../components/TentativeChip';

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

const readStore = (key) => {
    try { return JSON.parse(localStorage.getItem(key)) ?? {}; } catch { return {}; }
};

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

/**
 * The Admin Communications sections (store, permission requests, conduct
 * reports) are introduced to teachers one at a time, on purpose: they stay
 * visible on the sidebar but greyed out with a "soon" chip until launch.
 * Flip a flag here the day that section goes live (decision: Mike,
 * 2026-09-22).
 */
const COMING_SOON = { store: true, request: true, conduct: true };

const SECTIONS = [
    { id: 'overview', label: 'Overview', icon: DashboardIcon },
    { id: 'attendance', label: 'Attendance', icon: FactCheckIcon },
    { id: 'marks', label: 'Marksheets', icon: GradeIcon },
    { id: 'plans', label: 'Planning', icon: MenuBookOutlinedIcon },
    { id: 'calendar', label: 'Calendar', icon: CalendarMonthIcon },
    { id: 'students', label: 'Students', icon: GroupsIcon },
    { id: 'timetable', label: 'Timetable', icon: EventIcon },
    { id: 'store', label: 'Store', icon: StorefrontIcon, soon: COMING_SOON.store },
    { id: 'request', label: 'Request', icon: VerifiedUserOutlinedIcon, soon: COMING_SOON.request },
    { id: 'conduct', label: 'Conduct report', icon: ReportOutlinedIcon, soon: COMING_SOON.conduct },
    { id: 'profile', label: 'Profile', icon: PersonIcon },
];

/**
 * Sidebar grouping: day-to-day classroom tools first, then the channels to
 * the school administration (store, permission requests, conduct reports).
 * Profile stays pinned to the bottom.
 */
const SECTION_GROUPS = [
    {
        label: 'Class Room Management',
        ids: ['overview', 'attendance', 'marks', 'plans', 'calendar', 'students', 'timetable'],
    },
    { label: 'Admin Communications', ids: ['store', 'request', 'conduct'] },
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
    const [edits, setEdits] = useState({});
    const [saving, setSaving] = useState(false);
    const [toast, setToast] = useState('');

    // Create-assessment dialog state
    const [createOpen, setCreateOpen] = useState(false);
    const [newLabel, setNewLabel] = useState('');
    const [newMax, setNewMax] = useState('10');
    const [creating, setCreating] = useState(false);
    const [createError, setCreateError] = useState('');

    const currentTerm = useApi(() => termApi.current().then((d) => d.term), []);
    const termId = currentTerm.data?.id ?? null;

    // Subjects offered in this class.
    const classSubjects = useApi(
        () => (classId
            ? assignmentApi.subjects({ classId }).then((d) => d.assignments)
            : Promise.resolve([])),
        [classId]
    );
    const subjects = useMemo(() => {
        const seen = new Map();
        (classSubjects.data || []).forEach((a) => {
            // Registration is a timetable fixture, not a marked subject.
            if (a.subject?.id && a.subject.code !== 'REG' && !seen.has(a.subject.id)) {
                seen.set(a.subject.id, a.subject);
            }
        });
        return [...seen.values()].sort((a, b) => a.name.localeCompare(b.name));
    }, [classSubjects.data]);

    useEffect(() => {
        if (!subjectId && subjects.length > 0) setSubjectId(subjects[0].id);
    }, [subjects, subjectId]);

    // Assessment columns + their marks for (class, subject, term).
    const assessmentsApi = useApi(
        () => (classId && subjectId && termId
            ? assessmentApi.list({ classId, subjectId, termId })
            : Promise.resolve([])),
        [classId, subjectId, termId]
    );
    const assessments = assessmentsApi.data || [];

    // Reset local edits when the loaded columns change.
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

    // Cells the teacher changed (only entered, non-empty values are saved).
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

    // Invalid = entered value exceeds the assessment max.
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

    // Running final per student = sum of entered marks / sum of their maxes.
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

    return (
        <Box>
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1.5, alignItems: 'center', mb: 2.5 }}>
                <TextField select label="Subject" size="small" value={subjectId}
                    onChange={(e) => setSubjectId(e.target.value)} sx={{ minWidth: 180 }}>
                    {subjects.map((s) => <MenuItem key={s.id} value={s.id}>{s.name}</MenuItem>)}
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
                        onClick={save}
                        disabled={saving || dirtyEntries.length === 0 || invalidCells.size > 0}
                        sx={{ fontWeight: 700, textTransform: 'none', borderRadius: 1 }}>
                        {saving ? 'Saving…' : `Save ${dirtyEntries.length || ''} mark${dirtyEntries.length === 1 ? '' : 's'}`.trim()}
                    </Button>
                </Box>
            </Box>

            {subjects.length === 0 && !classSubjects.loading && (
                <Alert severity="info" sx={{ borderRadius: 1.5 }}>
                    No subjects are assigned to {klass.name} yet — an admin assigns them under
                    Assignments → Subject teaching.
                </Alert>
            )}

            {subjectId && assessments.length === 0 && !assessmentsApi.loading && (
                <Alert severity="info" sx={{ borderRadius: 1.5, mb: 2 }}>
                    No assessments yet. Click <strong>Create assessment</strong> to add one
                    (for example "Quiz 1" out of 10).
                </Alert>
            )}

            {subjectId && assessments.length > 0 && (
                <TableContainer component={Paper} variant="outlined" sx={{ borderRadius: 1.5, overflow: 'auto' }}>
                    <Table size="small">
                        <TableHead>
                            <TableRow>
                                <TableCell sx={{ width: 56, fontWeight: 700 }}>Roll</TableCell>
                                <TableCell sx={{ fontWeight: 700, minWidth: 160 }}>Student</TableCell>
                                {assessments.map((a) => (
                                    <TableCell key={a.id} align="center" sx={{ minWidth: 110 }}>
                                        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: .5 }}>
                                            <Box>
                                                <Typography sx={{ fontWeight: 700, fontSize: 13, lineHeight: 1.2 }}>{a.label}</Typography>
                                                <Typography sx={{ fontSize: 11, color: 'text.secondary' }}>out of {a.maxMarks}</Typography>
                                            </Box>
                                            <Tooltip title="Delete assessment">
                                                <IconButton size="small" onClick={() => deleteAssessment(a)}
                                                    aria-label={`Delete assessment ${a.label}`}>
                                                    <DeleteOutlineIcon sx={{ fontSize: 15 }} />
                                                </IconButton>
                                            </Tooltip>
                                        </Box>
                                    </TableCell>
                                ))}
                                <TableCell align="right" sx={{ fontWeight: 700, minWidth: 80 }}>Final %</TableCell>
                                <TableCell align="center" sx={{ fontWeight: 700, minWidth: 70 }}>Grade</TableCell>
                            </TableRow>
                        </TableHead>
                        <TableBody>
                            {roster.map((s) => {
                                const fin = finalFor(s.id);
                                return (
                                    <TableRow key={s.id} hover>
                                        <TableCell sx={{ color: 'text.secondary' }}>{s.rollNum ?? '—'}</TableCell>
                                        <TableCell sx={{ fontWeight: 600 }}>{s.name}</TableCell>
                                        {assessments.map((a) => {
                                            const key = `${a.id}|${s.id}`;
                                            const val = currentValue(a.id, s.id);
                                            const invalid = invalidCells.has(key);
                                            return (
                                                <TableCell key={a.id} align="center" sx={{ px: 0.75 }}>
                                                    <TextField type="number" size="small" value={val} placeholder="—"
                                                        error={invalid}
                                                        onChange={(ev) => setEdits((p) => ({ ...p, [key]: ev.target.value }))}
                                                        inputProps={{ min: 0, max: a.maxMarks, step: '0.5', style: { textAlign: 'right' } }}
                                                        sx={{ width: 84 }} />
                                                </TableCell>
                                            );
                                        })}
                                        <TableCell align="right" sx={{ fontWeight: 700 }}>
                                            {fin ? `${fin.pct.toFixed(1)}%` : '—'}
                                        </TableCell>
                                        <TableCell align="center">
                                            {fin ? (
                                                <Chip size="small" label={gradeFor(fin.pct)}
                                                    sx={{ fontWeight: 800, minWidth: 42, borderRadius: 1,
                                                        bgcolor: GRADE_COLORS[gradeFor(fin.pct)], color: '#fff' }} />
                                            ) : '—'}
                                        </TableCell>
                                    </TableRow>
                                );
                            })}
                        </TableBody>
                    </Table>
                </TableContainer>
            )}

            {/* Create-assessment dialog */}
            <Dialog open={createOpen} onClose={() => setCreateOpen(false)} maxWidth="xs" fullWidth
                PaperProps={{ sx: { borderRadius: 2 } }}>
                <Box sx={{ p: 2.75 }}>
                    <Typography sx={{ fontWeight: 800, fontSize: 16, mb: .5 }}>Create assessment</Typography>
                    <Typography sx={{ fontSize: 12.5, color: 'text.secondary', mb: 2 }}>
                        Add a marked column for {subjects.find((s) => s.id === subjectId)?.name || 'this subject'}.
                        The whole subject is out of 100, so a column "out of 10" is worth 10%.
                    </Typography>
                    <Box sx={{ display: 'flex', gap: 1.5, mb: 1 }}>
                        <TextField label="Name" size="small" fullWidth value={newLabel}
                            onChange={(e) => setNewLabel(e.target.value)}
                            placeholder="e.g. Quiz 1" autoFocus />
                        <TextField label="Out of" type="number" size="small" value={newMax}
                            onChange={(e) => setNewMax(e.target.value)}
                            inputProps={{ min: 1, step: 1, style: { textAlign: 'right' } }}
                            sx={{ width: 110 }} />
                    </Box>
                    {createError && (
                        <Typography sx={{ fontSize: 12.5, color: 'error.main', mb: 1 }}>{createError}</Typography>
                    )}
                    <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 1, mt: 1 }}>
                        <Button size="small" onClick={() => setCreateOpen(false)}
                            sx={{ fontWeight: 700, textTransform: 'none', color: 'text.secondary' }}>
                            Cancel
                        </Button>
                        <Button size="small" variant="contained" disableElevation onClick={createAssessment}
                            disabled={creating}
                            sx={{ fontWeight: 700, textTransform: 'none', borderRadius: 1 }}>
                            {creating ? 'Adding…' : 'Add column'}
                        </Button>
                    </Box>
                </Box>
            </Dialog>

            <Snackbar open={Boolean(toast)} autoHideDuration={3500}
                onClose={() => setToast('')} message={toast} />
        </Box>
    );
}

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

/* ── timetable section ────────────────────────────────────── */

const TT_DAYS = [
    { value: 1, label: 'Monday' },
    { value: 2, label: 'Tuesday' },
    { value: 3, label: 'Wednesday' },
    { value: 4, label: 'Thursday' },
    { value: 5, label: 'Friday' },
];



/** Same palette as the admin Timetable page: Spelling purple, Registration
 *  neutral, main-teacher subjects indigo, subject-teacher subjects mint. */
const ttTint = (slot) => {
    if (slot.subject?.code === 'SPL') return '#f3e8ff';
    if (slot.subject?.code === 'REG') return '#f1f5f9';
    return slot.subject?.taughtBy === 'main_teacher' ? '#eef2ff' : '#ecfdf5';
};

/** Builds the worksheet rows (array of arrays) for the class weekly grid:
 *  one row per bell period, columns Time + Mon–Fri. Pure, so it's testable. */
export const timetableSheetRows = (slots, className) => {
    const periodKeys = [...new Set(slots.map((s) => `${s.startsAt}|${s.endsAt}`))].sort();
    const rows = [
        [`${className} — Weekly Timetable 2026/2027 (Tentative)`],
        [],
        ['Time', ...TT_DAYS.map((d) => d.label)],
    ];
    periodKeys.forEach((key) => {
        const [start, end] = key.split('|');
        const row = [lessonLabel(start, end)];
        TT_DAYS.forEach((day) => {
            const slot = slots.find(
                (s) => s.dayOfWeek === day.value && s.startsAt === start && s.endsAt === end
            );
            if (!slot) { row.push(''); return; }
            const subject = slot.subject?.name || 'Period';
            row.push(slot.teacher?.name ? `${subject} (${slot.teacher.name})` : subject);
        });
        rows.push(row);
    });
    return rows;
};

function TimetableSection({ classId, klass }) {
    const tt = useApi(
        () => (classId ? timetableApi.get({ classId }) : Promise.resolve([])),
        [classId]
    );
    const slots = tt.data || [];
    const [exporting, setExporting] = useState(false);

    const downloadExcel = async () => {
        try {
            setExporting(true);
            // Lazy-load SheetJS so the Excel library stays out of the main bundle.
            const XLSX = await import('xlsx');
            const rows = timetableSheetRows(slots, klass?.name || 'Class');
            const ws = XLSX.utils.aoa_to_sheet(rows);
            ws['!cols'] = [{ wch: 13 }, ...TT_DAYS.map(() => ({ wch: 26 }))];
            ws['!merges'] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: 5 } }];
            const wb = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(wb, ws, 'Timetable');
            const stem = (klass?.name || 'class').toLowerCase().replace(/[^a-z0-9]+/g, '-');
            XLSX.writeFile(wb, `${stem}-timetable-2026-27.xlsx`);
        } finally {
            setExporting(false);
        }
    };

    if (tt.loading) {
        return <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}><CircularProgress size={28} /></Box>;
    }
    if (tt.error) {
        return <Alert severity="error">Could not load the timetable. Please try again.</Alert>;
    }
    if (slots.length === 0) {
        return <Alert severity="info">No periods have been scheduled for this class yet.</Alert>;
    }

    return (
        <Box>
            <Box sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 1, mb: 2,
                justifyContent: 'space-between' }}>
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                    <TentativeChip />
                    <Chip size="small" label={`${slots.length} sessions / week`} sx={{ fontWeight: 700 }} />
                    <Chip size="small" label="Main teacher" sx={{ bgcolor: '#eef2ff' }} />
                    <Chip size="small" label="Subject teacher" sx={{ bgcolor: '#ecfdf5' }} />
                    <Chip size="small" label="Spelling" sx={{ bgcolor: '#f3e8ff' }} />
                    <Chip size="small" label="Registration" sx={{ bgcolor: '#f1f5f9' }} />
                </Box>
                <Button variant="outlined" size="small" onClick={downloadExcel} disabled={exporting}
                    startIcon={exporting ? <CircularProgress size={14} /> : <DownloadIcon sx={{ fontSize: 16 }} />}
                    sx={{ textTransform: 'none', fontWeight: 700, borderRadius: 1 }}>
                    Download Excel
                </Button>
            </Box>

            <Grid container spacing={1.5}>
                {TT_DAYS.map((day) => {
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
                                        <Box key={slot.id} sx={{ p: 1, borderRadius: 1.5, bgcolor: ttTint(slot),
                                            border: '1px solid', borderColor: 'divider' }}>
                                        <Typography variant="caption" color="text.secondary">
                                            {lessonLabel(slot.startsAt, slot.endsAt)}
                                        </Typography>
                                            <Typography variant="body2" sx={{ fontWeight: 700, lineHeight: 1.3 }}>
                                                {slot.subject?.name || 'Period'}
                                            </Typography>
                                            <Typography variant="caption" display="block" color="text.secondary">
                                                {slot.teacher?.name || 'Unassigned'}
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
        </Box>
    );
}

/* ── profile & settings ─────────────────────────────────── */

function ProfileSection({ klass, classId }) {
    const classSubjects = useApi(
        () => (classId
            ? assignmentApi.subjects({ classId }).then((d) => d.assignments).catch(() => [])
            : Promise.resolve([])),
        [classId]
    );
    const teachingItems = useMemo(() => {
        const rows = [{
            primary: `Main teacher — ${klass.name}`,
            secondary: 'Homeroom · daily attendance · monthly registers',
        }];
        const seen = new Map();
        (classSubjects.data || []).forEach((a) => {
            if (!a.subject?.id || a.subject.code === 'REG' || seen.has(a.subject.id)) return;
            seen.set(a.subject.id, {
                primary: a.subject.name,
                secondary: a.teacher?.name ? `Taught by ${a.teacher.name}` : null,
            });
        });
        return rows.concat([...seen.values()].sort((a, b) => a.primary.localeCompare(b.primary)));
    }, [classSubjects.data, klass.name]);

    return (
        <Grid container spacing={2.5}>
            <Grid item xs={12} md={7}>
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5 }}>
                    <IdentityCard
                        roleLabel="Main Teacher"
                        nameNote="You sign in daily with the class card; your display name is issued by the school. Ask the coordinator to correct it."
                    />
                    <SecurityCard
                        mode="self-service"
                        note="This is your personal account password (for signing in with your school email). The class card still works for daily sign-in. Don’t know your current password? Ask the coordinator — it can be reset to your class card password."
                    />
                </Box>
            </Grid>
            <Grid item xs={12} md={5}>
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5 }}>
                    <TelegramCard />
                    <TeachingCard items={teachingItems} />
                    <PreferencesCard />
                </Box>
            </Grid>
        </Grid>
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

    // Sidebar nav button — Profile is rendered separately, pinned to the
    // bottom of the full-length sidebar (see below).
    const renderNavButton = (s) => {
        const Icon = s.icon;
        const active = section === s.id;
        return (
            <Button key={s.id} disabled={s.soon}
                onClick={() => !s.soon && setSection(s.id)}
                data-testid={s.id === 'profile' ? 'side-nav-profile' : undefined}
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
    };

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
                    {/* sidebar — full viewport length, Profile pinned to the bottom */}
                    <Paper variant="outlined" data-testid="side-nav" sx={{ borderRadius: 1.5, p: 1, flexShrink: 0,
                        width: { md: 220 }, display: 'flex', flexDirection: { xs: 'row', md: 'column' },
                        gap: .5, overflowX: 'auto', maxWidth: '100%', position: { md: 'sticky' }, top: { md: 76 },
                        height: { md: 'calc(100vh - 100px)' }, overflowY: { md: 'auto' } }}>
                        {SECTION_GROUPS.map((g, gi) => (
                            <Box key={g.label} sx={{ display: 'contents' }}>
                                <Typography data-testid={`side-nav-group-${gi}`}
                                    sx={{ display: { xs: 'none', md: 'block' },
                                        px: 0.75, pt: gi === 0 ? 0 : 1, pb: 0.25,
                                        fontSize: 9.5, fontWeight: 800, letterSpacing: '.14em',
                                        textTransform: 'uppercase', color: 'text.disabled' }}>
                                    {g.label}
                                </Typography>
                                {g.ids.map((id) => renderNavButton(SECTIONS.find((s) => s.id === id)))}
                            </Box>
                        ))}
                        <Box data-testid="side-nav-spacer"
                            sx={{ flexGrow: 1, display: { xs: 'none', md: 'block' } }} />
                        <Divider sx={{ display: { xs: 'none', md: 'block' }, mx: 0.5 }} />
                        {SECTIONS.filter((s) => s.id === 'profile').map((s) => renderNavButton(s))}
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
                        {section === 'timetable' && <TimetableSection classId={session.classId} klass={klass} />}
                        {section === 'store' && <StoreSection klass={klass} classId={session.classId} />}
                        {section === 'request' && <RequestSection klass={klass} classId={session.classId} roster={roster} />}
                        {section === 'conduct' && <ConductSection klass={klass} classId={session.classId} roster={roster} />}
                        {section === 'profile' && <ProfileSection klass={klass} classId={session.classId} />}
                    </Box>
                </Box>
            </Container>
        </Box>
    );
}
