import { useEffect, useMemo, useRef, useState } from 'react';
import {
    Alert, Box, Button, Card, Chip, Divider, IconButton, InputAdornment, Menu, MenuItem, Paper,
    Stack, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, TextField,
    Tooltip, Typography,
} from '@mui/material';
import SaveIcon from '@mui/icons-material/Save';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import RestartAltIcon from '@mui/icons-material/RestartAlt';
import SchoolIcon from '@mui/icons-material/School';
import SummarizeOutlinedIcon from '@mui/icons-material/SummarizeOutlined';
import DownloadIcon from '@mui/icons-material/Download';
import ConfirmDeleteDialog from '../components/ConfirmDeleteDialog';
import CheckmarkToast from '../components/CheckmarkToast';
import { Link as RouterLink } from 'react-router-dom';
import {
    academicYearApi, assignmentApi, classApi, marksheetApi, studentApi, studentRequestApi, termApi,
} from '../api/endpoints';
import useApi from '../hooks/useApi';
import PageHeader from '../components/PageHeader';
import DataState from '../components/DataState';
import { useAuth } from '../auth/AuthContext';
import { marksheetSubjectsFor } from '../utils/marksheetSubjects';
import { sortClassRoster } from '../utils/rosterSort';

// Kept as page exports for existing consumers/tests.
export { MAIN_TEACHER_MARKSHEET_CODES, marksheetSubjectsFor } from '../utils/marksheetSubjects';

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
    const [baseline, setBaseline] = useState('{}');  // what was loaded/saved last
    const entriesRef = useRef(entries);
    const baselineRef = useRef(baseline);
    entriesRef.current = entries;
    baselineRef.current = baseline;
    const [savedIds, setSavedIds] = useState({});    // studentId -> existing row id
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');
    const [toast, setToast] = useState('');
    const [downloadAnchorEl, setDownloadAnchorEl] = useState(null);
    const [exporting, setExporting] = useState(false);
    const [deleteDialog, setDeleteDialog] = useState({ open: false, studentId: null });

    // -------------------------------------------------------------------------
    // Teaching scope. A subject teacher may hold several classes, so the class
    // picker is built from *their* teaching assignments; admins see everything.
    // -------------------------------------------------------------------------
    const scope = useApi(async () => {
        if (isAdmin) {
            const classes = await classApi.list();
            return { classes, mainTeacherClassIds: [] };
        }

        const [{ assignments }, classes] = await Promise.all([
            assignmentApi.subjects({ teacherId: user.id }),
            user.role === 'main_teacher' ? classApi.list() : Promise.resolve([]),
        ]);

        const mainTeacherClassIds = user.role === 'main_teacher'
            ? (classes || []).filter((c) => c.mainTeacher?.id === user.id).map((c) => c.id)
            : [];
        const byId = new Map();
        assignments.forEach((a) => {
            if (a.class?.id && !byId.has(a.class.id)) byId.set(a.class.id, a.class);
        });
        // A main teacher's own class qualifies even if subjects are not
        // assigned to them individually yet.
        (classes || []).forEach((c) => {
            if (c.mainTeacher?.id === user.id && !byId.has(c.id)) byId.set(c.id, { id: c.id, name: c.name });
        });

        return { classes: [...byId.values()], mainTeacherClassIds };
    }, [user?.id, user?.role, isAdmin], { syncTopic: 'assignments' });

    const classOptions = useMemo(
        () => [...(scope.data?.classes || [])].sort((a, b) => (a.name || '').localeCompare(b.name || '')),
        [scope.data]
    );

    // Auto-select a lone class so a subject teacher lands directly on their sheet.
    useEffect(() => {
        if (!classId && classOptions.length === 1) setClassId(classOptions[0].id);
    }, [classOptions, classId]);

    const terms = useApi(() => termApi.list(), []);
    const years = useApi(() => academicYearApi.list(), []);
    const yearNameById = useMemo(
        () => new Map((years.data || []).map((year) => [String(year.id), year.name])),
        [years.data],
    );

    // Default to the current term once terms arrive.
    useEffect(() => {
        if (!termId && terms.data?.length) {
            const current = terms.data.find((t) => t.isCurrent) || terms.data[0];
            setTermId(current.id);
        }
    }, [terms.data, termId]);

    // Subjects offered in the chosen class. Main teachers see MAT/SCI/GLS in
    // their own homeroom even when the subject assignment owner still reflects
    // a previous teacher; elsewhere the picker remains assignment-scoped.
    const classSubjects = useApi(
        () => (classId
            ? assignmentApi.subjects({ classId }).then((r) => r.assignments)
            : Promise.resolve([])),
        [classId],
        { syncTopic: 'assignments' },
    );

    const isMainTeacherOfClass = scope.data?.mainTeacherClassIds?.includes(classId) || false;
    const subjectOptions = useMemo(
        () => marksheetSubjectsFor(classSubjects.data, { user, isAdmin, isMainTeacherOfClass }),
        [classSubjects.data, isAdmin, isMainTeacherOfClass, user]
    );

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
        [ready, classId],
        { syncTopic: 'students' },
    );
    const pendingReqs = useApi(
        () => (classId && typeof studentRequestApi?.list === 'function'
            ? studentRequestApi.list({ status: 'pending', classId }).catch(() => [])
            : Promise.resolve([])),
        [classId],
        { syncTopic: 'students' },
    );
    // Load this class/subject's records across terms so an empty selected term
    // can be distinguished from marks saved safely under a different term.
    const existing = useApi(
        () => (ready
            ? marksheetApi.list({ classId, subjectId })
            : Promise.resolve([])),
        [ready, classId, subjectId],
        { syncTopic: 'assessments' },
    );
    const selectedMarksheets = useMemo(
        () => (existing.data || []).filter((m) => String(m.termId) === String(termId)),
        [existing.data, termId],
    );
    const otherTermMarkCounts = useMemo(() => {
        const termById = new Map((terms.data || []).map((term) => [String(term.id), term]));
        const counts = new Map();
        (existing.data || []).forEach((mark) => {
            if (!mark.termId || String(mark.termId) === String(termId)) return;
            const key = String(mark.termId);
            counts.set(key, (counts.get(key) || 0) + 1);
        });
        return [...counts.entries()].map(([id, count]) => {
            const term = termById.get(id);
            const mark = (existing.data || []).find((row) => String(row.termId) === id);
            const yearName = term?.academicYearId
                ? yearNameById.get(String(term.academicYearId))
                : null;
            return {
                id,
                name: term?.name
                    ? `${term.name}${yearName ? ` (${yearName})` : ''}`
                    : (mark?.term?.name || 'Another term'),
                count,
            };
        });
    }, [existing.data, termId, terms.data, yearNameById]);

    // Seed editable state from this term's rows once both loads complete,
    // preserving any dirty unsaved cells if a background student sync occurs.
    useEffect(() => {
        if (!ready || !students.data || !existing.data) return;

        const savedByStudent = {};
        selectedMarksheets.forEach((m) => {
            if (m.student?.id) savedByStudent[m.student.id] = m;
        });

        const serverBaseline = {};
        const ids = {};
        sortClassRoster(students.data).forEach((s) => {
            const m = savedByStudent[s.id];
            serverBaseline[s.id] = {
                marks: m ? String(m.marks) : '',
                maxMarks: m ? String(m.maxMarks) : '100',
            };
            if (m?.id) ids[s.id] = m.id;
        });

        let previousBaseline = {};
        try {
            previousBaseline = typeof baselineRef.current === 'string'
                ? JSON.parse(baselineRef.current)
                : {};
        } catch {
            previousBaseline = {};
        }

        const merged = { ...serverBaseline };
        Object.keys(entriesRef.current || {}).forEach((sid) => {
            if (!(sid in merged)) return;
            const was = previousBaseline[sid];
            const current = entriesRef.current[sid];
            if (was && current && (current.marks !== was.marks || current.maxMarks !== was.maxMarks)) {
                merged[sid] = current;
            }
        });

        const nextBaseline = JSON.stringify(serverBaseline);
        entriesRef.current = merged;
        baselineRef.current = nextBaseline;
        setEntries(merged);
        setBaseline(nextBaseline);
        setSavedIds(ids);
    }, [ready, students.data, existing.data, selectedMarksheets]);

    const roster = useMemo(
        () => sortClassRoster(students.data),
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
        const next = {
            ...entriesRef.current,
            [studentId]: { ...entriesRef.current[studentId], [field]: value },
        };
        entriesRef.current = next;
        setEntries(next);
    };

    const handleDiscard = () => {
        const next = JSON.parse(baselineRef.current || '{}');
        entriesRef.current = next;
        setEntries(next);
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

            const nextBaseline = JSON.stringify(next);
            entriesRef.current = next;
            baselineRef.current = nextBaseline;
            setEntries(next);
            setBaseline(nextBaseline);
            setSavedIds(ids);
            setToast(`Saved ${res.saved} result${res.saved === 1 ? '' : 's'}`);
        } catch (err) {
            setError(err.message || 'Failed to save marksheets');
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = (studentId) => {
        setDeleteDialog({ open: true, studentId });
    };

    const handleConfirmDelete = async () => {
        const { studentId } = deleteDialog;
        if (!studentId) return;
        const id = savedIds[studentId];
        if (!id) {
            setDeleteDialog({ open: false, studentId: null });
            return;
        }

        setSaving(true);
        try {
            await marksheetApi.remove(id);
            const nextEntries = { ...entriesRef.current, [studentId]: { marks: '', maxMarks: '100' } };
            entriesRef.current = nextEntries;
            setEntries(nextEntries);
            setSavedIds((prev) => {
                const next = { ...prev };
                delete next[studentId];
                return next;
            });
            const parsed = JSON.parse(baselineRef.current || '{}');
            parsed[studentId] = { marks: '', maxMarks: '100' };
            const nextBaseline = JSON.stringify(parsed);
            baselineRef.current = nextBaseline;
            setBaseline(nextBaseline);
            setDeleteDialog({ open: false, studentId: null });
            setToast('Result removed');
        } catch (err) {
            setDeleteDialog({ open: false, studentId: null });
            setError(err.message || 'Failed to delete result');
        } finally {
            setSaving(false);
        }
    };

    const canDelete = isAdmin || user?.role === 'main_teacher';
    const selectedClass = classOptions.find((c) => c.id === classId);
    const selectedSubject = subjectOptions.find((s) => s.id === subjectId);
    const selectedTerm = (terms.data || []).find((t) => String(t.id) === String(termId));
    const selectedYearName = selectedTerm?.academicYearId
        ? yearNameById.get(String(selectedTerm.academicYearId))
        : null;
    const selectedTermLabel = selectedTerm
        ? `${selectedTerm.name}${selectedYearName ? ` (${selectedYearName})` : ''}`
        : 'the selected term';
    const currentYear = (years.data || []).find((year) => year.isCurrent);
    const currentTerm = (terms.data || []).find((term) => term.isCurrent
        && (!currentYear || String(term.academicYearId) === String(currentYear.id)));

    const handleExport = async (mode) => {
        setDownloadAnchorEl(null);
        if (!isAdmin) return;
        if (dirtyIds.length > 0) {
            setToast('Save or discard unsaved marks before exporting.');
            return;
        }
        if (!currentTerm) {
            setToast('No current term is configured for this academic year.');
            return;
        }
        if (mode === 'selected' && (!classId || !subjectId)) {
            setToast('Choose a class and subject before downloading a specific marksheet.');
            return;
        }

        setExporting(true);
        try {
            const params = { termId: currentTerm.id };
            if (mode === 'selected') {
                params.classId = classId;
                params.subjectId = subjectId;
            }
            const data = await marksheetApi.exportCurrentTerm(params);
            const exportTools = await import('../utils/marksheetExport');

            if (mode === 'allZip') {
                const zip = await exportTools.createMarksheetZip(data);
                exportTools.downloadMarksheetBlob(
                    zip,
                    exportTools.marksheetExportFilename(data, null, 'zip'),
                );
                setToast('Downloaded Excel files for all classes');
            } else {
                const klass = mode === 'selected' ? data.classes?.[0] : null;
                if (mode === 'selected' && !klass) throw new Error('No class data was returned for this export.');
                exportTools.downloadMarksheetWorkbook(
                    data,
                    exportTools.marksheetExportFilename(data, klass, 'xlsx', mode === 'selected' ? selectedSubject : null),
                );
                setToast(mode === 'selected'
                    ? `Downloaded ${klass.name} · ${selectedSubject?.name || 'subject'} marksheet`
                    : 'Downloaded the all-classes Excel workbook');
            }
        } catch (err) {
            setToast(err.message || 'Could not prepare the Excel export.');
        } finally {
            setExporting(false);
        }
    };

    // -------------------------------------------------------------------------

    return (
        <>
            <PageHeader
                title="Marksheets"
                action={(
                    <Button component={RouterLink} to="/app/report-cards" size="small"
                        variant="outlined" startIcon={<SummarizeOutlinedIcon />}
                        sx={{ textTransform: 'none', fontWeight: 700 }}>
                        Report cards
                    </Button>
                )}
                subtitle={isSubjectTeacher
                    ? 'Manage results class by class, for every class you teach.'
                    : 'Enter and edit marks per class, subject and term. Grades are computed by the server.'}
            />

            <DataState loading={scope.loading || terms.loading || years.loading} error={scope.error || terms.error}>
                <Card sx={{ p: 2, mb: 2.5 }} data-testid="marksheets-filter-card">
                    <Stack
                        direction={{ xs: 'column', md: 'row' }}
                        spacing={2}
                        alignItems={{ md: 'center' }}
                        flexWrap="wrap"
                        useFlexGap
                    >
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
                            data-testid="marksheet-subject-select"
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
                            data-testid="marksheet-term-select"
                            value={termId}
                            onChange={(e) => setTermId(e.target.value)}
                            disabled={dirtyIds.length > 0}
                        >
                            {(terms.data || []).map((t) => {
                                const yearName = t.academicYearId
                                    ? yearNameById.get(String(t.academicYearId))
                                    : null;
                                return (
                                    <MenuItem key={t.id} value={t.id}>
                                        {t.name}{yearName ? ` · ${yearName}` : ''}
                                    </MenuItem>
                                );
                            })}
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

                        {isAdmin && <Box sx={{ display: { xs: 'none', md: 'block' }, flexGrow: 1 }} />}
                        {isAdmin && (
                            <Box sx={{
                                display: 'flex',
                                justifyContent: { xs: 'stretch', md: 'flex-end' },
                                width: { xs: '100%', md: 'auto' },
                                ml: { md: 'auto' },
                            }}>
                                <Button
                                    size="small"
                                    variant="outlined"
                                    startIcon={<DownloadIcon />}
                                    onClick={(event) => setDownloadAnchorEl(event.currentTarget)}
                                    disabled={exporting || dirtyIds.length > 0}
                                    aria-haspopup="menu"
                                    aria-controls={downloadAnchorEl ? 'marksheets-download-menu' : undefined}
                                    aria-expanded={downloadAnchorEl ? 'true' : undefined}
                                    data-testid="marksheets-download-button"
                                    sx={{ textTransform: 'none', fontWeight: 700, width: { xs: '100%', md: 'auto' } }}
                                >
                                    {exporting ? 'Preparing…' : 'Download'}
                                </Button>
                                <Menu
                                    id="marksheets-download-menu"
                                    anchorEl={downloadAnchorEl}
                                    open={Boolean(downloadAnchorEl)}
                                    onClose={() => setDownloadAnchorEl(null)}
                                    anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
                                    transformOrigin={{ vertical: 'top', horizontal: 'right' }}
                                >
                                    <MenuItem disabled data-testid="marksheets-export-current-term">
                                        {currentTerm
                                            ? `Current term · ${currentTerm.name}${currentYear ? ` · ${currentYear.name}` : ''}`
                                            : 'No current term configured'}
                                    </MenuItem>
                                    <Divider />
                                    <MenuItem
                                        disabled={!classId || !subjectId || !currentTerm || dirtyIds.length > 0 || exporting}
                                        onClick={() => { void handleExport('selected'); }}
                                        data-testid="marksheets-export-selected-subject"
                                    >
                                        Selected subject · Excel (.xlsx)
                                    </MenuItem>
                                    <MenuItem
                                        disabled={!currentTerm || dirtyIds.length > 0 || exporting}
                                        onClick={() => { void handleExport('allWorkbook'); }}
                                        data-testid="marksheets-export-all-workbook"
                                    >
                                        All classes · one Excel workbook
                                    </MenuItem>
                                    <MenuItem
                                        disabled={!currentTerm || dirtyIds.length > 0 || exporting}
                                        onClick={() => { void handleExport('allZip'); }}
                                        data-testid="marksheets-export-all-zip"
                                    >
                                        All classes · ZIP of Excel files
                                    </MenuItem>
                                </Menu>
                            </Box>
                        )}
                    </Stack>
                </Card>

                {classId && pendingReqs.data?.length > 0 && (
                    <Alert severity="warning" sx={{ mb: 2 }} data-testid="marksheets-pending-students">
                        <strong>{pendingReqs.data.length}</strong> student{pendingReqs.data.length === 1 ? '' : 's'} awaiting office approval: {' '}
                        <strong>{pendingReqs.data.map((request) => request.name).join(' · ')}</strong>.
                        {' '}They will appear in this marksheet automatically after approval.
                    </Alert>
                )}

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
                        {!existing.loading && existing.data && selectedMarksheets.length === 0
                            && otherTermMarkCounts.length > 0 && (
                                <Alert severity="warning" sx={{ mb: 2 }} data-testid="marksheet-other-term-notice">
                                    No marks are saved for {selectedSubject?.name || 'this subject'} in{' '}
                                    {selectedTermLabel}. Existing results for this class
                                    and subject are in{' '}
                                    {otherTermMarkCounts.map((term) =>
                                        `${term.name} (${term.count} result${term.count === 1 ? '' : 's'})`
                                    ).join(', ')}. Select the matching term to view them. Nothing has been changed.
                                </Alert>
                            )}
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

            <CheckmarkToast
                open={Boolean(toast)}
                message={toast}
                onClose={() => setToast('')}
                autoHideDuration={3000}
            />
            <ConfirmDeleteDialog
                open={deleteDialog.open}
                onClose={() => setDeleteDialog({ open: false, studentId: null })}
                onConfirm={handleConfirmDelete}
                title="Remove this result?"
                message="This mark will be deleted and cannot be undone. The student's row stays on the sheet — you can enter a new mark at any time."
                confirmLabel="Delete result"
                cancelLabel="Cancel"
                loading={saving}
            />
        </>
    );
}
