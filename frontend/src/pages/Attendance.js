import { useEffect, useState } from 'react';
import {
    Alert, Button, Card, Chip, Dialog, DialogActions, DialogContent, DialogTitle,
    MenuItem, Paper, Snackbar, Stack, Tab, Table, TableBody, TableCell, TableContainer,
    TableHead, TableRow, Tabs, TextField, ToggleButton, ToggleButtonGroup, Typography,
} from '@mui/material';
import SaveIcon from '@mui/icons-material/Save';
import TodayIcon from '@mui/icons-material/Today';
import CalendarMonthIcon from '@mui/icons-material/CalendarMonth';
import { attendanceApi, classApi, studentApi, subjectApi } from '../api/endpoints';
import useApi from '../hooks/useApi';
import PageHeader from '../components/PageHeader';
import DataState from '../components/DataState';
import { StatGrid, StatCard } from '../components/DashboardSections';
import { useAuth } from '../auth/AuthContext';

const STATUSES = [
    { value: 'present', label: 'Present', color: 'success' },
    { value: 'late', label: 'Late', color: 'warning' },
    { value: 'absent', label: 'Absent', color: 'error' },
    { value: 'excused', label: 'Excused', color: 'info' },
];

const SUBMISSION_META = {
    pending: { label: 'Not submitted', color: 'default', variant: 'outlined' },
    submitted: { label: 'Submitted', color: 'success', variant: 'filled' },
    returned: { label: 'Returned for correction', color: 'warning', variant: 'filled' },
};

// Decisions first: submitted months may need a review, pending ones a chase,
// returned ones are already back with the teacher.
const SORT_ORDER = { submitted: 0, pending: 1, returned: 2 };

const TAB_SX = { minHeight: 44, textTransform: 'none', fontWeight: 700, fontSize: 14 };

const today = () => new Date().toISOString().slice(0, 10);

const fmtDateTime = (iso) => (iso
    ? new Date(iso).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
    : '—');

/**
 * Admin: every class's monthly submission for one chosen month, with the
 * power to return a submitted month for correction (the only way to unlock
 * a locked register).
 */
function MonthlySubmissions() {
    const [month, setMonth] = useState(today().slice(0, 7));
    const [returnDialog, setReturnDialog] = useState(null); // { classId, className, note }
    const [saving, setSaving] = useState(false);
    const [formError, setFormError] = useState('');
    const [toast, setToast] = useState('');

    const submissions = useApi(() => attendanceApi.submissions({ month }), [month]);

    const rows = [...(submissions.data?.submissions || [])].sort(
        (a, b) => (SORT_ORDER[a.status] ?? 3) - (SORT_ORDER[b.status] ?? 3)
            || String(a.className).localeCompare(String(b.className))
    );
    const submitted = rows.filter((r) => r.status === 'submitted').length;
    const pending = rows.filter((r) => r.status === 'pending').length;
    const returned = rows.filter((r) => r.status === 'returned').length;

    const handleReturn = async () => {
        setSaving(true);
        setFormError('');
        try {
            await attendanceApi.returnMonth({
                classId: returnDialog.classId,
                month,
                note: returnDialog.note.trim(),
            });
            setToast(`${returnDialog.className} returned for correction — the register is unlocked`);
            setReturnDialog(null);
            submissions.reload();
        } catch (err) {
            setFormError(err.message);
        } finally {
            setSaving(false);
        }
    };

    return (
        <>
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} alignItems={{ sm: 'center' }} sx={{ mb: 2.5 }}>
                <TextField
                    label="Month" type="month" size="small" value={month}
                    onChange={(e) => setMonth(e.target.value)}
                    InputLabelProps={{ shrink: true }} sx={{ width: 170 }}
                />
                <Typography variant="body2" color="text.secondary">
                    Each main teacher submits their month at month end; submitted registers
                    lock. Returning one is the only way to reopen it.
                </Typography>
            </Stack>

            <DataState loading={submissions.loading} error={submissions.error}
                empty={rows.length === 0} emptyMessage="No classes found for this month."
            >
                <StatGrid>
                    <StatCard label="Classes" value={rows.length} />
                    <StatCard label="Submitted" value={submitted} color={submitted === rows.length && rows.length ? 'success.main' : 'warning.main'} />
                    <StatCard label="Not submitted" value={pending} color={pending ? 'error.main' : 'success.main'} />
                    <StatCard label="Returned for correction" value={returned} color={returned ? 'warning.main' : 'success.main'} />
                </StatGrid>

                <TableContainer component={Paper} variant="outlined">
                    <Table size="small">
                        <TableHead>
                            <TableRow>
                                <TableCell>Class</TableCell>
                                <TableCell>Status</TableCell>
                                <TableCell>Handed in</TableCell>
                                <TableCell>Admin note</TableCell>
                                <TableCell align="right">Actions</TableCell>
                            </TableRow>
                        </TableHead>
                        <TableBody>
                            {rows.map((r) => {
                                const meta = SUBMISSION_META[r.status] || SUBMISSION_META.pending;
                                return (
                                    <TableRow key={r.classId} hover
                                        sx={r.status === 'pending' ? { bgcolor: '#fef7f7' } : undefined}>
                                        <TableCell sx={{ fontWeight: 600 }}>{r.className}</TableCell>
                                        <TableCell>
                                            <Chip size="small" label={meta.label} color={meta.color} variant={meta.variant} />
                                        </TableCell>
                                        <TableCell>
                                            <Typography variant="body2" color="text.secondary">
                                                {fmtDateTime(r.submittedAt)}
                                            </Typography>
                                        </TableCell>
                                        <TableCell sx={{ maxWidth: 240 }}>
                                            {r.note
                                                ? <Typography variant="body2" color="text.secondary">{r.note}</Typography>
                                                : <Typography variant="body2" color="text.disabled">—</Typography>}
                                        </TableCell>
                                        <TableCell align="right">
                                            {r.status === 'submitted' && (
                                                <Button size="small" color="warning"
                                                    onClick={() => {
                                                        setFormError('');
                                                        setReturnDialog({ classId: r.classId, className: r.className, note: '' });
                                                    }}>
                                                    Return for correction
                                                </Button>
                                            )}
                                        </TableCell>
                                    </TableRow>
                                );
                            })}
                        </TableBody>
                    </Table>
                </TableContainer>
            </DataState>

            {/* Return for correction ------------------------------------------- */}
            <Dialog open={Boolean(returnDialog)} onClose={() => setReturnDialog(null)} maxWidth="xs" fullWidth>
                <DialogTitle>Return {month} for correction</DialogTitle>
                <DialogContent>
                    {formError && <Alert severity="error" sx={{ mb: 2 }}>{formError}</Alert>}
                    {returnDialog && (
                        <Stack spacing={2} sx={{ mt: 1 }}>
                            <Typography variant="body2" color="text.secondary">
                                {returnDialog.className}'s register will unlock so the main teacher can
                                fix it and submit again. Your note is shown to them.
                            </Typography>
                            <TextField
                                label="Why is it being returned?" required fullWidth multiline rows={3}
                                value={returnDialog.note}
                                onChange={(e) => setReturnDialog((d) => ({ ...d, note: e.target.value }))}
                                autoFocus
                            />
                        </Stack>
                    )}
                </DialogContent>
                <DialogActions sx={{ px: 3, pb: 2 }}>
                    <Button onClick={() => setReturnDialog(null)}>Cancel</Button>
                    <Button variant="contained" color="warning" onClick={handleReturn}
                        disabled={saving || !returnDialog?.note?.trim()}>
                        {saving ? 'Returning…' : 'Return and unlock'}
                    </Button>
                </DialogActions>
            </Dialog>

            <Snackbar open={Boolean(toast)} autoHideDuration={3500}
                onClose={() => setToast('')} message={toast}
                anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }} />
        </>
    );
}

export default function Attendance() {
    const { user } = useAuth();
    const isAdmin = user?.role === 'admin';

    const [tab, setTab] = useState(0);
    const [classId, setClassId] = useState('');
    const [subjectId, setSubjectId] = useState('');
    const [date, setDate] = useState(today());
    const [marks, setMarks] = useState({});
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');
    const [toast, setToast] = useState('');

    const classes = useApi(() => classApi.list(), []);
    const subjects = useApi(
        () => (classId ? subjectApi.list({ classId }) : Promise.resolve([])),
        [classId]
    );
    const students = useApi(
        () => (classId ? studentApi.list({ classId }) : Promise.resolve([])),
        [classId]
    );
    const existing = useApi(
        () => (classId && date
            ? attendanceApi.forClass({ classId, date, subjectId: subjectId || undefined })
            : Promise.resolve([])),
        [classId, date, subjectId]
    );

    // Seed the form from whatever is already recorded, defaulting to present.
    useEffect(() => {
        if (!students.data) return;
        const saved = {};
        (existing.data || []).forEach((r) => {
            if (r.student?.id) saved[r.student.id] = r.status;
        });
        const next = {};
        students.data.forEach((s) => { next[s.id] = saved[s.id] || 'present'; });
        setMarks(next);
    }, [students.data, existing.data]);

    const handleSave = async () => {
        setSaving(true);
        setError('');
        try {
            const records = Object.entries(marks).map(([studentId, status]) => ({ studentId, status }));
            await attendanceApi.mark({
                classId,
                date,
                subjectId: subjectId || null,
                records,
            });
            setToast('Attendance saved');
            existing.reload();
        } catch (err) {
            setError(err.message);
        } finally {
            setSaving(false);
        }
    };

    const roster = students.data || [];
    const alreadyMarked = (existing.data || []).length > 0;

    const tally = STATUSES.map((s) => ({
        ...s,
        count: Object.values(marks).filter((v) => v === s.value).length,
    }));

    return (
        <>
            <PageHeader
                title="Attendance"
                subtitle={
                    isAdmin
                        ? 'Record daily registers, and track each class\u2019s monthly submission.'
                        : 'Record homeroom or subject attendance for a class.'
                }
            />

            {isAdmin && (
                <Tabs value={tab} onChange={(_, v) => setTab(v)} aria-label="Attendance views"
                    sx={{ mb: 2, borderBottom: 1, borderColor: 'divider', minHeight: 44 }}>
                    <Tab icon={<TodayIcon fontSize="small" />} iconPosition="start"
                        label="Daily register" sx={TAB_SX} />
                    <Tab icon={<CalendarMonthIcon fontSize="small" />} iconPosition="start"
                        label="Monthly submissions" sx={TAB_SX} />
                </Tabs>
            )}

            {isAdmin && tab === 1 ? (
                <MonthlySubmissions />
            ) : (
                <>
                    <Card sx={{ p: 2, mb: 2.5 }}>
                        <Stack direction={{ xs: 'column', md: 'row' }} spacing={2}>
                            <TextField
                                select label="Class" size="small" sx={{ minWidth: 200 }}
                                value={classId}
                                onChange={(e) => { setClassId(e.target.value); setSubjectId(''); }}
                            >
                                {(classes.data || []).map((c) => (
                                    <MenuItem key={c.id} value={c.id}>{c.name}</MenuItem>
                                ))}
                            </TextField>

                            <TextField
                                select label="Session" size="small" sx={{ minWidth: 220 }}
                                value={subjectId} onChange={(e) => setSubjectId(e.target.value)}
                                disabled={!classId}
                                helperText="Homeroom, or a specific subject"
                            >
                                <MenuItem value="">Homeroom (daily)</MenuItem>
                                {(subjects.data || []).map((s) => (
                                    <MenuItem key={s.id} value={s.id}>{s.name}</MenuItem>
                                ))}
                            </TextField>

                            <TextField
                                label="Date" type="date" size="small"
                                value={date} onChange={(e) => setDate(e.target.value)}
                                InputLabelProps={{ shrink: true }}
                                inputProps={{ max: today() }}
                            />
                        </Stack>
                    </Card>

                    {!classId ? (
                        <Alert severity="info">Choose a class to begin taking attendance.</Alert>
                    ) : (
                        <>
                            {alreadyMarked && (
                                <Alert severity="info" sx={{ mb: 2 }}>
                                    Attendance for this session already exists — saving will update it.
                                </Alert>
                            )}
                            {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

                            <DataState
                                loading={students.loading}
                                error={students.error}
                                empty={roster.length === 0}
                                emptyMessage="This class has no enrolled students."
                            >
                                <Stack direction="row" spacing={1} sx={{ mb: 2 }} flexWrap="wrap" useFlexGap>
                                    {tally.map((t) => (
                                        <Typography key={t.value} variant="body2" color="text.secondary">
                                            <strong>{t.count}</strong> {t.label.toLowerCase()}
                                        </Typography>
                                    ))}
                                </Stack>

                                <TableContainer component={Paper} variant="outlined">
                                    <Table size="small">
                                        <TableHead>
                                            <TableRow>
                                                <TableCell>Admission no.</TableCell>
                                                <TableCell>Student</TableCell>
                                                <TableCell align="right">Status</TableCell>
                                            </TableRow>
                                        </TableHead>
                                        <TableBody>
                                            {roster.map((s) => (
                                                <TableRow key={s.id} hover>
                                                    <TableCell>{s.admissionNo}</TableCell>
                                                    <TableCell sx={{ fontWeight: 500 }}>{s.name}</TableCell>
                                                    <TableCell align="right">
                                                        <ToggleButtonGroup
                                                            exclusive size="small"
                                                            value={marks[s.id] || 'present'}
                                                            onChange={(_, value) => {
                                                                if (value) setMarks((m) => ({ ...m, [s.id]: value }));
                                                            }}
                                                        >
                                                            {STATUSES.map((st) => (
                                                                <ToggleButton
                                                                    key={st.value} value={st.value}
                                                                    color={st.color}
                                                                    sx={{ px: 1.5, py: 0.4, fontSize: 12.5 }}
                                                                >
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

                                <Stack direction="row" justifyContent="flex-end" sx={{ mt: 2.5 }}>
                                    <Button
                                        variant="contained" startIcon={<SaveIcon />}
                                        onClick={handleSave} disabled={saving}
                                    >
                                        {saving ? 'Saving…' : 'Save attendance'}
                                    </Button>
                                </Stack>
                            </DataState>
                        </>
                    )}
                </>
            )}

            <Snackbar open={Boolean(toast)} autoHideDuration={3000}
                onClose={() => setToast('')} message={toast}
                anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }} />
        </>
    );
}
