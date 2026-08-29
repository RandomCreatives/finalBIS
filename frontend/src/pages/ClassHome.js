import { useEffect, useMemo, useRef, useState } from 'react';
import { Link as RouterLink, useNavigate, useParams, Navigate } from 'react-router-dom';
import {
    Alert, Box, Button, Card, CardContent, Chip, Container, Divider, Grid, IconButton,
    MenuItem, Paper, Snackbar, Table, TableBody, TableCell, TableContainer, TableHead,
    TableRow, TextField, ToggleButton, ToggleButtonGroup, Tooltip, Typography, useTheme,
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
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import SaveIcon from '@mui/icons-material/Save';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import { useColorScheme } from '../theme';
import {
    classBySlug, readClassLogin, clearClassLogin, demoRoster, CLASS_SUBJECTS,
} from '../data/classes';
import StudentIdCard from '../components/StudentIdCard';
import { CalendarBoard } from './PublicCalendar';
import WordEditor from '../components/WordEditor';
import { CLASSES } from '../data/classes';

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
    attendance: 'bisnoc.demo.attendance',
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

function AttendanceSection({ klass, roster, onToast }) {
    const [date, setDate] = useState(today());
    const all = readStore(STORE.attendance)[klass.name] || {};
    const [records, setRecords] = useState(all[date] || {});
    const [saved, setSaved] = useState(Boolean(all[date]));

    useEffect(() => {
        const store = readStore(STORE.attendance)[klass.name] || {};
        setRecords(store[date] || {});
        setSaved(Boolean(store[date]));
    }, [date, klass.name]);

    const setStatus = (name, status) => {
        setRecords((r) => ({ ...r, [name]: status }));
        setSaved(false);
    };

    const markAllPresent = () => {
        const next = {};
        roster.forEach((s) => { next[s.name] = 'present'; });
        setRecords(next);
        setSaved(false);
    };

    const save = () => {
        const store = readStore(STORE.attendance);
        store[klass.name] = { ...(store[klass.name] || {}), [date]: records };
        writeStore(STORE.attendance, store);
        setSaved(true);
        onToast('Attendance saved');
    };

    const tally = ATTENDANCE_STATUSES.map((s) => ({
        ...s, count: Object.values(records).filter((v) => v === s.key).length,
    }));

    return (
        <Box>
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1.5, alignItems: 'center', mb: 2.5 }}>
                <TextField label="Date" type="date" size="small" value={date}
                    onChange={(e) => setDate(e.target.value)}
                    InputLabelProps={{ shrink: true }} sx={{ width: 170 }} />
                <Chip label={`Week ${termWeekOf(date)} · Term 1`} size="small"
                    sx={{ fontWeight: 700, borderRadius: 1, bgcolor: 'rgba(2,132,199,.1)', color: '#0284c7' }} />
                <Box sx={{ ml: 'auto', display: 'flex', gap: 1 }}>
                    <Button size="small" onClick={markAllPresent}
                        sx={{ fontWeight: 700, textTransform: 'none', color: 'text.secondary' }}>
                        Mark all present
                    </Button>
                    <Button size="small" variant="contained" disableElevation startIcon={<SaveIcon />}
                        onClick={save} sx={{ fontWeight: 700, textTransform: 'none', borderRadius: 1 }}>
                        Save register
                    </Button>
                </Box>
            </Box>

            <Box sx={{ display: 'flex', gap: 1, mb: 2, flexWrap: 'wrap' }}>
                {tally.map((t) => (
                    <Chip key={t.key} size="small" label={`${t.full}: ${t.count}`}
                        sx={{ fontWeight: 700, borderRadius: 1, bgcolor: alpha(t.color, 0.1), color: t.color }} />
                ))}
                {saved && (
                    <Chip size="small" icon={<CheckCircleIcon sx={{ fontSize: '14px !important' }} />}
                        label="Saved" sx={{ fontWeight: 700, borderRadius: 1,
                            bgcolor: 'rgba(22,163,74,.1)', color: '#16a34a' }} />
                )}
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
                            <TableRow key={s.name} hover>
                                <TableCell sx={{ color: 'text.secondary' }}>{s.rollNum}</TableCell>
                                <TableCell sx={{ fontWeight: 600 }}>{s.name}</TableCell>
                                <TableCell>
                                    <ToggleButtonGroup size="small" exclusive
                                        value={records[s.name] || 'present'}
                                        onChange={(_, v) => v && setStatus(s.name, v)}>
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
        </Box>
    );
}

/* ── marksheets section ───────────────────────────────────── */

function MarksSection({ klass, roster, onToast }) {
    const [subject, setSubject] = useState(CLASS_SUBJECTS[0]);
    const store = readStore(STORE.marks)[klass.name] || {};
    const [entries, setEntries] = useState(store[subject] || {});
    const [saved, setSaved] = useState(false);

    useEffect(() => {
        const s = readStore(STORE.marks)[klass.name] || {};
        setEntries(s[subject] || {});
        setSaved(false);
    }, [subject, klass.name]);

    const setField = (name, field, value) => {
        setEntries((prev) => ({
            ...prev,
            [name]: { marks: '', maxMarks: '100', ...prev[name], [field]: value },
        }));
        setSaved(false);
    };

    const save = () => {
        const all = readStore(STORE.marks);
        all[klass.name] = { ...(all[klass.name] || {}), [subject]: entries };
        writeStore(STORE.marks, all);
        setSaved(true);
        onToast(`${subject} marks saved`);
    };

    const graded = roster.filter((s) => entries[s.name]?.marks !== '' && entries[s.name]?.marks !== undefined);
    const average = graded.length
        ? graded.reduce((sum, s) => {
            const e = entries[s.name];
            const max = Number(e.maxMarks) || 100;
            return sum + (Number(e.marks) / max) * 100;
        }, 0) / graded.length
        : null;

    return (
        <Box>
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1.5, alignItems: 'center', mb: 2.5 }}>
                <TextField select label="Subject" size="small" value={subject}
                    onChange={(e) => setSubject(e.target.value)} sx={{ minWidth: 200 }}>
                    {CLASS_SUBJECTS.map((s) => <MenuItem key={s} value={s}>{s}</MenuItem>)}
                </TextField>
                {average !== null && (
                    <Chip size="small" label={`Average ${average.toFixed(1)}% · ${gradeFor(average)}`}
                        sx={{ fontWeight: 700, borderRadius: 1,
                            bgcolor: alpha(GRADE_COLORS[gradeFor(average)], 0.12),
                            color: GRADE_COLORS[gradeFor(average)] }} />
                )}
                <Chip size="small" label={`${graded.length}/${roster.length} graded`}
                    sx={{ fontWeight: 700, borderRadius: 1, bgcolor: 'rgba(2,132,199,.08)', color: '#0284c7' }} />
                <Box sx={{ ml: 'auto', display: 'flex', gap: 1, alignItems: 'center' }}>
                    {saved && (
                        <Chip size="small" icon={<CheckCircleIcon sx={{ fontSize: '14px !important' }} />}
                            label="Saved" sx={{ fontWeight: 700, borderRadius: 1,
                                bgcolor: 'rgba(22,163,74,.1)', color: '#16a34a' }} />
                    )}
                    <Button size="small" variant="contained" disableElevation startIcon={<SaveIcon />}
                        onClick={save} sx={{ fontWeight: 700, textTransform: 'none', borderRadius: 1 }}>
                        Save marks
                    </Button>
                </Box>
            </Box>

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
                            const e = entries[s.name] || { marks: '', maxMarks: '100' };
                            const marksOk = e.marks !== '' && !Number.isNaN(Number(e.marks));
                            const maxOk = e.maxMarks !== '' && Number(e.maxMarks) > 0;
                            const invalid = marksOk && maxOk && Number(e.marks) > Number(e.maxMarks);
                            const pct = marksOk && maxOk && !invalid
                                ? (Number(e.marks) / Number(e.maxMarks)) * 100 : null;
                            return (
                                <TableRow key={s.name} hover>
                                    <TableCell sx={{ color: 'text.secondary' }}>{s.rollNum}</TableCell>
                                    <TableCell sx={{ fontWeight: 600 }}>{s.name}</TableCell>
                                    <TableCell>
                                        <TextField type="number" size="small" value={e.marks} placeholder="—"
                                            error={invalid} onChange={(ev) => setField(s.name, 'marks', ev.target.value)}
                                            inputProps={{ min: 0, step: '0.5', style: { textAlign: 'right' } }} fullWidth />
                                    </TableCell>
                                    <TableCell>
                                        <TextField type="number" size="small" value={e.maxMarks}
                                            error={invalid} onChange={(ev) => setField(s.name, 'maxMarks', ev.target.value)}
                                            inputProps={{ min: 1, step: 1, style: { textAlign: 'right' } }} fullWidth />
                                    </TableCell>
                                    <TableCell align="right">{pct === null ? '—' : `${pct.toFixed(1)}%`}</TableCell>
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
        </Box>
    );
}

/* ── lesson plans section ─────────────────────────────────── */

/* ── planning section (Word-like) ─────────────────────────── */

const PLANNING_TEMPLATES = {
    blank: {
        label: 'Blank page',
        title: (k) => `Planning — ${k.name}`,
        html: '<p><br></p>',
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
            <WordEditor
                key={doc.id}
                initialHtml={doc.html}
                onHtmlChange={handleHtml}
                printHeader={`${meta.label} · ${klass.name}`}
            />
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
            html: tpl.html,
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
                    Write your schemes of work and lesson plans on a simple Word-like page —
                    formatted text, tables, and printing included.
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

function StudentsSection({ klass, roster }) {
    const [students, setStudents] = useState(roster);
    const [selected, setSelected] = useState(null);
    const [toast, setToast] = useState('');

    useEffect(() => setStudents(roster), [roster]);

    const selectedStudent = students.find((s) => s.name === selected) ?? null;

    const handleSave = (originalName, patch) => {
        setStudents((prev) => prev.map((s) => (s.name === originalName ? { ...s, ...patch } : s)));
        if (patch.name && patch.name !== originalName) setSelected(patch.name);
        setToast('Student record saved');
    };

    const handleTransfer = (name, toClass) => {
        setStudents((prev) => prev.filter((s) => s.name !== name));
        setToast(`${name} transferred to ${toClass}`);
    };

    return (
        <Box>
            <Typography sx={{ fontSize: 13, color: 'text.secondary', mb: 2 }}>
                {students.length} student{students.length === 1 ? '' : 's'} in {klass.name} —
                open a student's ID card to view, edit or transfer.
            </Typography>
            <TableContainer component={Paper} variant="outlined" sx={{ borderRadius: 1.5 }}>
                <Table size="small">
                    <TableHead>
                        <TableRow>
                            <TableCell sx={{ width: 56, fontWeight: 700 }}>Roll</TableCell>
                            <TableCell sx={{ fontWeight: 700 }}>Student</TableCell>
                            <TableCell sx={{ width: 120, fontWeight: 700 }}>Admission</TableCell>
                            <TableCell sx={{ width: 100 }} />
                        </TableRow>
                    </TableHead>
                    <TableBody>
                        {students.map((s) => (
                            <TableRow key={s.name} hover sx={{ cursor: 'pointer' }} onClick={() => setSelected(s.name)}>
                                <TableCell sx={{ color: 'text.secondary' }}>{s.rollNum}</TableCell>
                                <TableCell sx={{ fontWeight: 600 }}>{s.name}</TableCell>
                                <TableCell sx={{ fontFamily: 'monospace', fontSize: 12 }}>{s.admissionNumber || '—'}</TableCell>
                                <TableCell onClick={(e) => e.stopPropagation()}>
                                    <Button size="small" onClick={() => setSelected(s.name)}
                                        sx={{ fontWeight: 700, textTransform: 'none', color: 'primary.main' }}>
                                        ID Card
                                    </Button>
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </TableContainer>

            {selectedStudent && (
                <StudentIdCard
                    student={selectedStudent}
                    canManage
                    classes={CLASSES.map((c) => c.name)}
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

/* ── overview section ─────────────────────────────────────── */

function OverviewSection({ klass, roster, goTo }) {
    const attendanceStore = readStore(STORE.attendance)[klass.name] || {};
    const marksStore = readStore(STORE.marks)[klass.name] || {};
    const plans = readStore(STORE.planning)[klass.name] || [];

    const attendanceDays = Object.keys(attendanceStore).length;
    const subjectsGraded = Object.keys(marksStore).filter(
        (subj) => Object.keys(marksStore[subj] || {}).length > 0).length;

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
    const roster = useMemo(() => (klass ? demoRoster(klass) : []), [klass]);

    if (!klass || !session || session.slug !== slug) {
        return <Navigate to="/classes" replace />;
    }

    const signOut = () => {
        clearClassLogin();
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

                        {section === 'overview' && <OverviewSection klass={klass} roster={roster} goTo={setSection} />}
                        {section === 'attendance' && <AttendanceSection klass={klass} roster={roster} onToast={() => {}} />}
                        {section === 'marks' && <MarksSection klass={klass} roster={roster} onToast={() => {}} />}
                        {section === 'plans' && <PlanningSection klass={klass} onToast={() => {}} />}
{section === 'calendar' && <CalendarBoard />}
                        {section === 'students' && <StudentsSection klass={klass} roster={roster} />}
                        {section === 'timetable' && <Alert severity="info">The weekly timetable arrives in a later version.</Alert>}
                    </Box>
                </Box>
            </Container>
        </Box>
    );
}
