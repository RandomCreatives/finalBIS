import { useEffect, useState } from 'react';
import {
    Alert, Button, Card, MenuItem, Paper, Snackbar, Stack, Table, TableBody, TableCell,
    TableContainer, TableHead, TableRow, TextField, ToggleButton, ToggleButtonGroup, Typography,
} from '@mui/material';
import SaveIcon from '@mui/icons-material/Save';
import { attendanceApi, classApi, studentApi, subjectApi } from '../api/endpoints';
import useApi from '../hooks/useApi';
import PageHeader from '../components/PageHeader';
import DataState from '../components/DataState';

const STATUSES = [
    { value: 'present', label: 'Present', color: 'success' },
    { value: 'late', label: 'Late', color: 'warning' },
    { value: 'absent', label: 'Absent', color: 'error' },
    { value: 'excused', label: 'Excused', color: 'info' },
];

const today = () => new Date().toISOString().slice(0, 10);

export default function Attendance() {
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
                subtitle="Record homeroom or subject attendance for a class."
            />

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

            <Snackbar open={Boolean(toast)} autoHideDuration={3000}
                onClose={() => setToast('')} message={toast}
                anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }} />
        </>
    );
}
