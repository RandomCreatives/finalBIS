import { useEffect, useMemo, useState } from 'react';
import {
    Alert, Box, Button, Card, Chip, IconButton, InputAdornment, MenuItem, Paper, Snackbar,
    Stack, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, TextField,
    Tooltip, Typography,
} from '@mui/material';
import SaveIcon from '@mui/icons-material/Save';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import RestartAltIcon from '@mui/icons-material/RestartAlt';
import SchoolIcon from '@mui/icons-material/School';
import { assignmentApi, classApi, marksheetApi, studentApi, termApi } from '../api/endpoints';
import useApi from '../hooks/useApi';
import PageHeader from '../components/PageHeader';
import DataState from '../components/DataState';
import { useAuth } from '../auth/AuthContext';

/** Mirrors gradeFor() in backend/controllers/marksheet.controller.js. */
const gradeFor = (percentage) => {
    if (percentage >= 90) return 'A+';
    if (percentage >= 80) return 'A';
    if (percentage >= 70) return 'B+';
    if (percentage >= 60) return 'B';
    if (percentage >= 50) return 'C';
    if (percentage >= 40) return 'D';
    return 'F';
};

const GRADE_COLORS = {
    'A+': '#15803d', A: '#16a34a', 'B+': '#65a30d', B: '#ca8a04',
    C: '#d97706', D: '#ea580c', F: '#dc2626',
};

const isNumber = (v) => v !== '' && !Number.isNaN(Number(v));

export default function Marksheets() {
    const { user, isAdmin } = useAuth();
    const isSubjectTeacher = user?.role === 'subject_teacher';

    const [classId, setClassId] = useState('');
    const [subjectId, setSubjectId] = useState('');
    const [termId, setTermId] = useState('');
    const [entries, setEntries] = useState({});      // studentId -> { marks, maxMarks }
    const [baseline, setBaseline] = useState({});    // what was loaded/saved last
    const [savedIds, setSavedIds] = useState({});    // studentId -> existing row id
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');
    const [toast, setToast] = useState('');

    // -------------------------------------------------------------------------
    // Teaching scope. A subject teacher may hold several classes, so the class
    // picker is built from *their* teaching assignments; admins see everything.
    // -------------------------------------------------------------------------
    const scope = useApi(async () => {
        if (isAdmin) {
            const classes = await classApi.list();
            return { classes };
        }

        const [{ assignments }, classes] = await Promise.all([
            assignmentApi.subjects({ teacherId: user.id }),
            user.role === 'main_teacher' ? classApi.list() : Promise.resolve([]),
        ]);

        const byId = new Map();
        assignments.forEach((a) => {
            if (a.class?.id && !byId.has(a.class.id)) byId.set(a.class.id, a.class);
        });
        // A main teacher's own class qualifies even if subjects are not
        // assigned to them individually yet.
        (classes || []).forEach((c) => {
            if (c.mainTeacher?.id === user.id && !byId.has(c.id)) byId.set(c.id, { id: c.id, name: c.name });
        });

        return { classes: [...byId.values()] };
    }, [user?.id]);

    const classOptions = useMemo(
        () => [...(scope.data?.classes || [])].sort((a, b) => (a.name || '').localeCompare(b.name || '')),
        [scope.data]
    );

    // Auto-select a lone class so a subject teacher lands directly on their sheet.
    useEffect(() => {
        if (!classId && classOptions.length === 1) setClassId(classOptions[0].id);
    }, [classOptions, classId]);

    const terms = useApi(() => termApi.list(), []);

    // Default to the current term once terms arrive.
    useEffect(() => {
        if (!termId && terms.data?.length) {
            const current = terms.data.find((t) => t.isCurrent) || terms.data[0];
            setTermId(current.id);
        }
    }, [terms.data, termId]);

    // Subjects offered in the chosen class; subject teachers only manage their own.
    const classSubjects = useApi(
        () => (classId
            ? assignmentApi.subjects({ classId }).then((r) => r.assignments)
            : Promise.resolve([])),
        [classId]
    );

    const subjectOptions = useMemo(() => {
        const list = classSubjects.data || [];
        const visible = isSubjectTeacher && !isAdmin
            ? list.filter((a) => a.teacherId === user.id)
            : list;

        const bySubject = new Map();
        visible.forEach((a) => {
            if (a.subject?.id && !bySubject.has(a.subject.id)) bySubject.set(a.subject.id, a.subject);
        });
        return [...bySubject.values()].sort((a, b) => (a.name || '').localeCompare(b.name || ''));
    }, [classSubjects.data, isSubjectTeacher, isAdmin, user?.id]);

    // Keep the subject choice valid when the class changes.
    useEffect(() => {
        if (subjectId && !subjectOptions.some((s) => s.id === subjectId)) setSubjectId('');
    }, [subjectOptions, subjectId]);

    // -------------------------------------------------------------------------
    // The sheet itself: roster + whatever is already recorded.
    // -------------------------------------------------------------------------
    const ready = Boolean(classId && subjectId && termId);

    const students = useApi(
        () => (ready ? studentApi.list({ classId }) : Promise.resolve([])),
        [ready, classId]
    );
    const existing = useApi(
        () => (ready
            ? marksheetApi.list({ classId, subjectId, termId })
            : Promise.resolve([])),
        [ready, classId, subjectId, termId]
    );

    // Seed editable state from the server's rows once both loads complete.
    useEffect(() => {
        if (!ready || !students.data || !existing.data) return;

        const savedByStudent = {};
        (existing.data || []).forEach((m) => {
            if (m.student?.id) savedByStudent[m.student.id] = m;
        });

        const next = {};
        const ids = {};
        students.data.forEach((s) => {
            const m = savedByStudent[s.id];
            next[s.id] = {
                marks: m ? String(m.marks) : '',
                maxMarks: m ? String(m.maxMarks) : '100',
            };
            if (m?.id) ids[s.id] = m.id;
        });

        setEntries(next);
        setBaseline(JSON.stringify(next));
        setSavedIds(ids);
    }, [ready, students.data, existing.data]);

    const roster = useMemo(
        () => [...(students.data || [])].sort((a, b) =>
            (a.rollNum ?? 999) - (b.rollNum ?? 999) || (a.name || '').localeCompare(b.name || '')),
        [students.data]
    );

    // -------------------------------------------------------------------------
    // Dirty/invalid bookkeeping.
    // -------------------------------------------------------------------------
    const rowState = (studentId) => {
        const e = entries[studentId];
        if (!e) return { invalid: false, dirty: false, percentage: null };

        const marksOk = isNumber(e.marks) && Number(e.marks) >= 0;
        const maxOk = isNumber(e.maxMarks) && Number(e.maxMarks) > 0;
        const invalid = (e.marks !== '' || e.maxMarks !== '')
            && (!marksOk || !maxOk || Number(e.marks) > Number(e.maxMarks));

        const baselineRow = JSON.parse(baseline || '{}')[studentId];
        const dirty = JSON.stringify(e) !== JSON.stringify(baselineRow) && e.marks !== '';

        let percentage = null;
        if (marksOk && maxOk) percentage = (Number(e.marks) / Number(e.maxMarks)) * 100;

        return { invalid, dirty, percentage };
    };

    const dirtyIds = roster.filter((s) => rowState(s.id).dirty).map((s) => s.id);
    const invalidIds = roster.filter((s) => rowState(s.id).invalid).map((s) => s.id);
    const graded = roster.filter((s) => isNumber(entries[s.id]?.marks));
    const average = graded.length
        ? graded.reduce((sum, s) => sum + rowState(s.id).percentage, 0) / graded.length
        : null;

    const handleField = (studentId, field, value) => {
        setEntries((prev) => ({
            ...prev,
            [studentId]: { ...prev[studentId], [field]: value },
        }));
    };

    const handleDiscard = () => {
        setEntries(JSON.parse(baseline || '{}'));
        setError('');
    };

    const handleSave = async () => {
        if (!dirtyIds.length || invalidIds.length) return;

        setSaving(true);
        setError('');
        try {
            const payloadEntries = dirtyIds.map((studentId) => ({
                studentId,
                subjectId,
                marks: Number(entries[studentId].marks),
                maxMarks: isNumber(entries[studentId].maxMarks) ? Number(entries[studentId].maxMarks) : 100,
            }));

            const res = await marksheetApi.bulkSave({ classId, termId, entries: payloadEntries });

            const next = { ...JSON.parse(baseline || '{}') };
            const ids = { ...savedIds };
            (res.marksheets || []).forEach((m) => {
                if (!m.student?.id) return;
                next[m.student.id] = { marks: String(m.marks), maxMarks: String(m.maxMarks) };
                ids[m.student.id] = m.id;
            });

            setEntries(next);
            setBaseline(JSON.stringify(next));
            setSavedIds(ids);
            setToast(`Saved ${res.saved} result${res.saved === 1 ? '' : 's'}`);
        } catch (err) {
            setError(err.message || 'Failed to save marksheets');
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async (studentId) => {
        const id = savedIds[studentId];
        if (!id) return;

        try {
            await marksheetApi.remove(id);
            setEntries((prev) => ({ ...prev, [studentId]: { marks: '', maxMarks: '100' } }));
            setSavedIds((prev) => {
                const next = { ...prev };
                delete next[studentId];
                return next;
            });
            setBaseline((prev) => {
                const parsed = JSON.parse(prev || '{}');
                parsed[studentId] = { marks: '', maxMarks: '100' };
                return JSON.stringify(parsed);
            });
            setToast('Result removed');
        } catch (err) {
            setError(err.message || 'Failed to delete result');
        }
    };

    const canDelete = isAdmin || user?.role === 'main_teacher';
    const selectedClass = classOptions.find((c) => c.id === classId);
    const selectedSubject = subjectOptions.find((s) => s.id === subjectId);
    const selectedTerm = (terms.data || []).find((t) => t.id === termId);

    // -------------------------------------------------------------------------

    return (
        <>
            <PageHeader
                title="Marksheets"
                subtitle={isSubjectTeacher
                    ? 'Manage results class by class, for every class you teach.'
                    : 'Enter and edit marks per class, subject and term. Grades are computed by the server.'}
            />

            <DataState loading={scope.loading || terms.loading} error={scope.error || terms.error}>
                <Card sx={{ p: 2, mb: 2.5 }}>
                    <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} alignItems={{ md: 'center' }}>
                        <TextField
                            select label={isSubjectTeacher ? 'My class' : 'Class'} size="small"
                            sx={{ minWidth: 210 }}
                            value={classId}
                            onChange={(e) => { setClassId(e.target.value); setSubjectId(''); }}
                            disabled={dirtyIds.length > 0}
                            helperText={dirtyIds.length > 0
                                ? 'Save or discard your edits to switch class'
                                : isSubjectTeacher && classOptions.length > 1
                                    ? `${classOptions.length} classes assigned to you`
                                    : undefined}
                        >
                            {classOptions.map((c) => (
                                <MenuItem key={c.id} value={c.id}>{c.name}</MenuItem>
                            ))}
                        </TextField>

                        <TextField
                            select label="Subject" size="small" sx={{ minWidth: 200 }}
                            value={subjectId}
                            onChange={(e) => setSubjectId(e.target.value)}
                            disabled={!classId || dirtyIds.length > 0}
                            helperText={dirtyIds.length > 0 ? 'Save or discard your edits first' : undefined}
                        >
                            {subjectOptions.map((s) => (
                                <MenuItem key={s.id} value={s.id}>{s.name}</MenuItem>
                            ))}
                        </TextField>

                        <TextField
                            select label="Term" size="small" sx={{ minWidth: 170 }}
                            value={termId}
                            onChange={(e) => setTermId(e.target.value)}
                            disabled={dirtyIds.length > 0}
                        >
                            {(terms.data || []).map((t) => (
                                <MenuItem key={t.id} value={t.id}>{t.name}</MenuItem>
                            ))}
                        </TextField>

                        {ready && (
                            <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                                <Chip
                                    size="small" color={graded.length === roster.length && roster.length > 0 ? 'success' : 'default'}
                                    label={`${graded.length}/${roster.length} graded`}
                                />
                                {average !== null && (
                                    <Chip
                                        size="small" variant="outlined"
                                        label={`Average ${average.toFixed(1)}% · ${gradeFor(average)}`}
                                    />
                                )}
                            </Stack>
                        )}
                    </Stack>
                </Card>

                {!scope.loading && classOptions.length === 0 && (
                    <Alert severity="info" icon={<SchoolIcon />}>
                        No teaching assignments yet. An admin assigns classes and subjects under
                        Assignments — your marksheets will appear here automatically afterwards.
                    </Alert>
                )}

                {scope.data && classOptions.length > 0 && !classId && (
                    <Alert severity="info">Pick a class to open its marksheet.</Alert>
                )}

                {classId && !subjectOptions.length && !classSubjects.loading && (
                    <Alert severity="info">
                        No subjects are assigned to {selectedClass?.name || 'this class'} yet.
                        {isSubjectTeacher
                            ? ' Ask an admin to assign you a subject for this class.'
                            : ' Assign subjects under Assignments → Subject teaching.'}
                    </Alert>
                )}

                {ready && (
                    <DataState loading={students.loading || existing.loading} error={students.error || existing.error}>
                        {roster.length === 0 ? (
                            <Alert severity="info">
                                No students in {selectedClass?.name || 'this class'} yet — place students
                                under Students → Assign.
                            </Alert>
                        ) : (
                            <TableContainer component={Paper} variant="outlined">
                                <Table size="small">
                                    <TableHead>
                                        <TableRow>
                                            <TableCell sx={{ width: 56 }}>Roll</TableCell>
                                            <TableCell sx={{ width: 110 }}>Admission</TableCell>
                                            <TableCell>Student</TableCell>
                                            <TableCell sx={{ width: 120 }}>Marks</TableCell>
                                            <TableCell sx={{ width: 110 }}>Max</TableCell>
                                            <TableCell sx={{ width: 80 }} align="right">%</TableCell>
                                            <TableCell sx={{ width: 80 }} align="center">Grade</TableCell>
                                            {canDelete && <TableCell sx={{ width: 56 }} />}
                                        </TableRow>
                                    </TableHead>
                                    <TableBody>
                                        {roster.map((s) => {
                                            const e = entries[s.id] || { marks: '', maxMarks: '100' };
                                            const { invalid, percentage } = rowState(s.id);
                                            const grade = percentage === null ? null : gradeFor(percentage);

                                            return (
                                                <TableRow key={s.id} hover>
                                                    <TableCell>{s.rollNum ?? '—'}</TableCell>
                                                    <TableCell>{s.admissionNo || '—'}</TableCell>
                                                    <TableCell>
                                                        <Typography variant="body2" fontWeight={600}>
                                                            {s.name}
                                                        </Typography>
                                                    </TableCell>
                                                    <TableCell>
                                                        <TextField
                                                            type="number" size="small" value={e.marks}
                                                            placeholder="—"
                                                            error={invalid}
                                                            onChange={(ev) => handleField(s.id, 'marks', ev.target.value)}
                                                            inputProps={{ min: 0, step: '0.5', style: { textAlign: 'right' } }}
                                                            fullWidth
                                                        />
                                                    </TableCell>
                                                    <TableCell>
                                                        <TextField
                                                            type="number" size="small" value={e.maxMarks}
                                                            error={invalid}
                                                            onChange={(ev) => handleField(s.id, 'maxMarks', ev.target.value)}
                                                            inputProps={{ min: 1, step: 1, style: { textAlign: 'right' } }}
                                                            InputProps={{
                                                                endAdornment: (
                                                                    <InputAdornment position="end">
                                                                        <Typography variant="caption" color="text.secondary">pts</Typography>
                                                                    </InputAdornment>
                                                                ),
                                                            }}
                                                            fullWidth
                                                        />
                                                    </TableCell>
                                                    <TableCell align="right">
                                                        {percentage === null ? '—' : `${percentage.toFixed(1)}%`}
                                                    </TableCell>
                                                    <TableCell align="center">
                                                        {grade ? (
                                                            <Chip
                                                                size="small" label={grade}
                                                                sx={{ bgcolor: GRADE_COLORS[grade], color: '#fff', fontWeight: 700, minWidth: 44 }}
                                                            />
                                                        ) : '—'}
                                                    </TableCell>
                                                    {canDelete && (
                                                        <TableCell align="center">
                                                            {savedIds[s.id] && (
                                                                <Tooltip title="Remove this result">
                                                                    <IconButton size="small" onClick={() => handleDelete(s.id)}>
                                                                        <DeleteOutlineIcon fontSize="small" />
                                                                    </IconButton>
                                                                </Tooltip>
                                                            )}
                                                        </TableCell>
                                                    )}
                                                </TableRow>
                                            );
                                        })}
                                    </TableBody>
                                </Table>
                            </TableContainer>
                        )}
                    </DataState>
                )}
            </DataState>

            {/* Sticky save bar — appears only while there are unsaved edits. */}
            {ready && dirtyIds.length > 0 && (
                <Paper
                    elevation={6}
                    sx={{
                        position: 'sticky', bottom: 16, mt: 2.5, p: 1.5, borderRadius: 2,
                        display: 'flex', alignItems: 'center', gap: 2,
                        border: '1px solid', borderColor: invalidIds.length ? 'error.main' : 'primary.main',
                    }}
                >
                    <Typography variant="body2" sx={{ flexGrow: 1 }}>
                        {invalidIds.length > 0
                            ? `${invalidIds.length} row${invalidIds.length === 1 ? ' has' : 's have'} invalid marks (marks must be between 0 and the maximum).`
                            : `${dirtyIds.length} unsaved change${dirtyIds.length === 1 ? '' : 's'} — ${selectedSubject?.name || ''} · ${selectedClass?.name || ''} · ${selectedTerm?.name || ''}`}
                    </Typography>
                    <Button size="small" startIcon={<RestartAltIcon />} onClick={handleDiscard} disabled={saving}>
                        Discard
                    </Button>
                    <Button
                        variant="contained" size="small" startIcon={<SaveIcon />}
                        onClick={handleSave} disabled={saving || invalidIds.length > 0}
                    >
                        {saving ? 'Saving…' : `Save ${dirtyIds.length} result${dirtyIds.length === 1 ? '' : 's'}`}
                    </Button>
                </Paper>
            )}

            {error && (
                <Box sx={{ mt: 2 }}>
                    <Alert severity="error" onClose={() => setError('')}>{error}</Alert>
                </Box>
            )}

            <Snackbar
                open={Boolean(toast)} autoHideDuration={3000}
                onClose={() => setToast('')} message={toast}
            />
        </>
    );
}
