import { useEffect, useMemo, useState } from 'react';
import {
    Alert, Box, Card, Chip, MenuItem, Paper, Stack, Table, TableBody, TableCell,
    TableHead, TableRow, TextField, Typography,
} from '@mui/material';
import PersonOutlineIcon from '@mui/icons-material/PersonOutline';
import SchoolIcon from '@mui/icons-material/School';
import GradeIcon from '@mui/icons-material/Grade';
import FactCheckIcon from '@mui/icons-material/FactCheck';
import { attendanceApi, classApi, marksheetApi, paymentApi, studentApi, termApi } from '../api/endpoints';
import useApi from '../hooks/useApi';
import DataState from '../components/DataState';
import PageHeader from '../components/PageHeader';
import { useAuth } from '../auth/AuthContext';

const statusColor = {
    present: 'success',
    late: 'warning',
    absent: 'error',
    excused: 'info',
};

const formatShortDate = (value) => {
    if (!value) return '—';
    const d = new Date(`${value}T00:00:00`);
    if (Number.isNaN(d.getTime())) return value;
    return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
};

const gradeFor = (percentage) => {
    if (percentage >= 90) return 'A+';
    if (percentage >= 80) return 'A';
    if (percentage >= 70) return 'B+';
    if (percentage >= 60) return 'B';
    if (percentage >= 50) return 'C';
    if (percentage >= 40) return 'D';
    return 'F';
};

export default function StudentPortal() {
    const { user } = useAuth();
    const [classId, setClassId] = useState('');
    const [studentId, setStudentId] = useState('');

    const classes = useApi(() => classApi.list(), []);
    const currentTerm = useApi(() => termApi.current(), []);
    const classOptions = useMemo(
        () => [...(classes.data || [])].sort((a, b) => (a.name || '').localeCompare(b.name || '')),
        [classes.data],
    );

    useEffect(() => {
        if (!classId && classOptions.length) setClassId(classOptions[0].id);
    }, [classId, classOptions]);

    const students = useApi(
        () => (classId ? studentApi.list({ classId }) : Promise.resolve([])),
        [classId],
        { syncTopic: 'students' },
    );
    const roster = useMemo(
        () => [...(students.data || [])].sort((a, b) => (a.rollNum ?? 999) - (b.rollNum ?? 999) || (a.name || '').localeCompare(b.name || '')),
        [students.data],
    );

    useEffect(() => {
        if (!roster.length) {
            setStudentId('');
            return;
        }
        if (!studentId || !roster.some((s) => s.id === studentId)) {
            setStudentId(roster[0].id);
        }
    }, [roster, studentId]);

    const selectedStudent = useMemo(
        () => roster.find((s) => s.id === studentId) || null,
        [roster, studentId],
    );

    const studentDetail = useApi(
        () => (studentId ? studentApi.get(studentId) : Promise.resolve(null)),
        [studentId],
    );

    const marksheets = useApi(
        () => {
            if (!studentId || !currentTerm.data?.term?.id) return Promise.resolve({ marksheets: [], stats: {} });
            return marksheetApi.forStudent(studentId, { termId: currentTerm.data.term.id });
        },
        [studentId, currentTerm.data?.term?.id],
    );

    const attendance = useApi(
        () => (studentId ? attendanceApi.forStudent(studentId, {}) : Promise.resolve({ attendance: [], stats: {} })),
        [studentId],
    );

    const paymentRows = useApi(
        () => {
            if (!currentTerm.data?.term?.id || user?.role !== 'admin') return Promise.resolve([]);
            return paymentApi.list({ termId: currentTerm.data.term.id });
        },
        [currentTerm.data?.term?.id, user?.role],
    );

    const paymentStatus = useMemo(() => {
        const row = (paymentRows.data || []).find((p) => p.studentId === studentId);
        if (!row) return { label: 'Unpaid', tone: 'default' };
        if (row.status === 'paid_term') return { label: 'Paid (term)', tone: 'success' };
        if (row.status === 'paid_annum') return { label: 'Paid (annum)', tone: 'success' };
        return { label: 'Unpaid', tone: 'default' };
    }, [paymentRows.data, studentId]);

    const recentAttendance = useMemo(
        () => [...(attendance.data?.attendance || [])].slice(0, 7),
        [attendance.data],
    );

    const currentAverage = useMemo(() => {
        const rows = marksheets.data?.marksheets || [];
        const valid = rows.filter((m) => Number.isFinite(Number(m.percentage)));
        if (!valid.length) return null;
        const total = valid.reduce((sum, row) => sum + Number(row.percentage), 0);
        return total / valid.length;
    }, [marksheets.data]);

    const loading = classes.loading || currentTerm.loading || students.loading || studentDetail.loading || marksheets.loading || attendance.loading;
    const error = classes.error || currentTerm.error || students.error || studentDetail.error || marksheets.error || attendance.error || paymentRows.error;
    const student = studentDetail.data || selectedStudent;

    return (
        <Box>
            <PageHeader title="Student Portal" subtitle="One-page academic overview for a selected student." />

            <DataState loading={loading} error={error} empty={!classOptions.length && !classes.loading} emptyMessage="No classes are available to this account yet.">
                <Stack spacing={3}>
                    <Paper sx={{ p: 2 }}>
                        <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} alignItems={{ md: 'center' }}>
                            <TextField
                                select
                                label="Class"
                                value={classId}
                                onChange={(e) => setClassId(e.target.value)}
                                sx={{ minWidth: 220 }}
                            >
                                {classOptions.map((c) => (
                                    <MenuItem key={c.id} value={c.id}>{c.name}</MenuItem>
                                ))}
                            </TextField>

                            <TextField
                                select
                                label="Student"
                                value={studentId}
                                onChange={(e) => setStudentId(e.target.value)}
                                sx={{ minWidth: 280 }}
                                disabled={!roster.length}
                            >
                                {roster.map((s) => (
                                    <MenuItem key={s.id} value={s.id}>{s.name} · {s.admissionNo || 'No admission'}</MenuItem>
                                ))}
                            </TextField>
                        </Stack>
                    </Paper>

                    {student ? (
                        <>
                            <Stack direction={{ xs: 'column', md: 'row' }} spacing={2}>
                                <Card sx={{ flex: 1, p: 2 }}>
                                    <Stack direction="row" spacing={1.5} alignItems="center">
                                        <SchoolIcon color="primary" />
                                        <Typography variant="h6">Student summary</Typography>
                                    </Stack>
                                    <Stack spacing={1} sx={{ mt: 2 }}>
                                        <Typography variant="h5">{student.name}</Typography>
                                        <Typography color="text.secondary">Admission no: {student.admissionNo || '—'}</Typography>
                                        <Typography color="text.secondary">Class: {selectedStudent?.class?.name || student.class?.name || 'Not assigned'}</Typography>
                                        <Typography color="text.secondary">Roll number: {student.rollNum || '—'}</Typography>
                                    </Stack>
                                </Card>

                                <Card sx={{ flex: 1, p: 2 }}>
                                    <Stack direction="row" spacing={1.5} alignItems="center">
                                        <GradeIcon color="primary" />
                                        <Typography variant="h6">Current term</Typography>
                                    </Stack>
                                    <Stack spacing={1} sx={{ mt: 2 }}>
                                        <Typography variant="h4">{currentAverage === null ? '—' : `${currentAverage.toFixed(1)}%`}</Typography>
                                        <Typography color="text.secondary">Overall average</Typography>
                                        <Typography variant="body2" color="text.secondary">
                                            Term: {currentTerm.data?.term?.name || 'Current term'}
                                        </Typography>
                                    </Stack>
                                </Card>

                                <Card sx={{ flex: 1, p: 2 }}>
                                    <Stack direction="row" spacing={1.5} alignItems="center">
                                        <FactCheckIcon color="primary" />
                                        <Typography variant="h6">Attendance</Typography>
                                    </Stack>
                                    <Stack spacing={1} sx={{ mt: 2 }}>
                                        <Typography variant="h4">{attendance.data?.stats?.attendanceRate === null || attendance.data?.stats?.attendanceRate === undefined ? '—' : `${attendance.data.stats.attendanceRate}%`}</Typography>
                                        <Typography color="text.secondary">Present + late / total</Typography>
                                        <Typography variant="body2" color="text.secondary">
                                            {attendance.data?.stats?.present ?? 0} present · {attendance.data?.stats?.late ?? 0} late · {attendance.data?.stats?.absent ?? 0} absent
                                        </Typography>
                                    </Stack>
                                </Card>

                                <Card sx={{ flex: 1, p: 2 }}>
                                    <Stack direction="row" spacing={1.5} alignItems="center">
                                        <PersonOutlineIcon color="primary" />
                                        <Typography variant="h6">Fee status</Typography>
                                    </Stack>
                                    <Stack spacing={1} sx={{ mt: 2 }}>
                                        <Chip
                                            label={paymentStatus.label}
                                            color={paymentStatus.tone === 'success' ? 'success' : paymentStatus.tone === 'default' ? 'default' : 'warning'}
                                            sx={{ alignSelf: 'flex-start' }}
                                        />
                                        <Typography color="text.secondary">
                                            {user?.role === 'admin' ? 'School office payment record' : 'Visitors may not see payment status if the office setting is off.'}
                                        </Typography>
                                    </Stack>
                                </Card>
                            </Stack>

                            <Stack direction={{ xs: 'column', lg: 'row' }} spacing={2}>
                                <Card sx={{ flex: 2, p: 2 }}>
                                    <Typography variant="h6" sx={{ mb: 2 }}>Performance by subject</Typography>
                                    <Table size="small">
                                        <TableHead>
                                            <TableRow>
                                                <TableCell>Subject</TableCell>
                                                <TableCell align="right">Marks</TableCell>
                                                <TableCell align="right">%</TableCell>
                                                <TableCell align="center">Grade</TableCell>
                                            </TableRow>
                                        </TableHead>
                                        <TableBody>
                                            {(marksheets.data?.marksheets || []).length === 0 ? (
                                                <TableRow>
                                                    <TableCell colSpan={4}>
                                                        <Typography color="text.secondary">No marks recorded for this student in the current term.</Typography>
                                                    </TableCell>
                                                </TableRow>
                                            ) : (
                                                (marksheets.data?.marksheets || []).map((row) => {
                                                    const pct = Number(row.percentage);
                                                    const grade = row.grade || gradeFor(pct);
                                                    return (
                                                        <TableRow key={row.id || row.subject?.id || row.subjectId}>
                                                            <TableCell>{row.subject?.name || 'Subject'}</TableCell>
                                                            <TableCell align="right">{row.marks ?? '—'}</TableCell>
                                                            <TableCell align="right">{Number.isFinite(pct) ? `${pct.toFixed(1)}%` : '—'}</TableCell>
                                                            <TableCell align="center">
                                                                <Chip label={grade} size="small" color={grade === 'A+' || grade === 'A' ? 'success' : grade === 'B+' || grade === 'B' ? 'warning' : grade === 'C' ? 'info' : 'error'} variant="outlined" />
                                                            </TableCell>
                                                        </TableRow>
                                                    );
                                                })
                                            )}
                                        </TableBody>
                                    </Table>
                                </Card>

                                <Card sx={{ flex: 1, p: 2 }}>
                                    <Typography variant="h6" sx={{ mb: 2 }}>Guardian contact</Typography>
                                    <Stack spacing={1.5}>
                                        <Box>
                                            <Typography variant="caption" color="text.secondary">Guardian</Typography>
                                            <Typography>{student.guardianName || '—'}</Typography>
                                        </Box>
                                        <Box>
                                            <Typography variant="caption" color="text.secondary">Phone</Typography>
                                            <Typography>{student.guardianPhone || '—'}</Typography>
                                        </Box>
                                        <Box>
                                            <Typography variant="caption" color="text.secondary">Email</Typography>
                                            <Typography>{student.guardianEmail || '—'}</Typography>
                                        </Box>
                                        <Box>
                                            <Typography variant="caption" color="text.secondary">Special needs</Typography>
                                            <Typography>{student.specialNeeds ? (student.specialNeedsNote || 'Recorded') : 'None recorded'}</Typography>
                                        </Box>
                                    </Stack>
                                </Card>
                            </Stack>

                            <Card sx={{ p: 2 }}>
                                <Typography variant="h6" sx={{ mb: 2 }}>Recent attendance</Typography>
                                {recentAttendance.length === 0 ? (
                                    <Alert severity="info">No attendance records are available for this student yet.</Alert>
                                ) : (
                                    <Stack spacing={1}>
                                        {recentAttendance.map((entry) => (
                                            <Paper key={entry.id} sx={{ p: 1.5, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }} variant="outlined">
                                                <Box>
                                                    <Typography fontWeight={700}>{entry.subject?.name || 'Homeroom'}</Typography>
                                                    <Typography variant="caption" color="text.secondary">{formatShortDate(entry.date)}</Typography>
                                                </Box>
                                                <Chip
                                                    label={entry.status}
                                                    color={statusColor[entry.status] || 'default'}
                                                    size="small"
                                                />
                                            </Paper>
                                        ))}
                                    </Stack>
                                )}
                            </Card>
                        </>
                    ) : (
                        <Alert severity="info">Select a class and student to open the portal.</Alert>
                    )}
                </Stack>
            </DataState>
        </Box>
    );
}
