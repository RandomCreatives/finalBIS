import { useState } from 'react';
import {
    Alert, Box, Button, Card, CardContent, Chip, Dialog, DialogActions, DialogContent,
    DialogTitle, Grid, MenuItem, Paper, Snackbar, Stack, Table, TableBody, TableCell,
    TableContainer, TableHead, TableRow, TextField, ToggleButton, ToggleButtonGroup,
    Tooltip, Typography,
} from '@mui/material';
import GroupAddIcon from '@mui/icons-material/GroupAdd';
import SwapHorizIcon from '@mui/icons-material/SwapHoriz';
import AutoFixHighIcon from '@mui/icons-material/AutoFixHigh';
import PersonAddIcon from '@mui/icons-material/PersonAdd';
import GroupsIcon from '@mui/icons-material/Groups';
import ClassIcon from '@mui/icons-material/Class';
import MenuBookIcon from '@mui/icons-material/MenuBook';
import AssignmentIndIcon from '@mui/icons-material/AssignmentInd';
import Checkbox from '@mui/material/Checkbox';
import FormControlLabel from '@mui/material/FormControlLabel';
import { assignmentApi, classApi, subjectApi, userApi, studentApi } from '../api/endpoints';
import useApi from '../hooks/useApi';
import PageHeader from '../components/PageHeader';
import DataState from '../components/DataState';
import { Section } from '../components/DashboardSections';

const roleLabel = (r) => (r || '').replace(/_/g, ' ');

export default function Assignments() {
    const [staffDialog, setStaffDialog] = useState(null);
    const [bulkDialog, setBulkDialog] = useState(null);
    const [rotateDialog, setRotateDialog] = useState(null);
    const [placeDialog, setPlaceDialog] = useState(null);
    const [saving, setSaving] = useState(false);
    const [formError, setFormError] = useState('');
    const [toast, setToast] = useState('');

    const classes = useApi(() => classApi.list(), []);
    const subjects = useApi(() => subjectApi.list(), []);
    const staff = useApi(() => userApi.list(), []);
    const workload = useApi(() => assignmentApi.workload(), []);
    const subjectAssignments = useApi(() => assignmentApi.subjects(), []);
    const unassigned = useApi(() => studentApi.unassigned(), []);

    const teachers = (staff.data || []).filter((s) => s.role !== 'admin' && s.isActive);

    const refresh = () => {
        classes.reload();
        workload.reload();
        subjectAssignments.reload();
        unassigned.reload();
    };

    const handleRotate = async () => {
        setSaving(true);
        setFormError('');
        try {
            await assignmentApi.rotate({
                classAId: rotateDialog.classAId,
                classBId: rotateDialog.classBId,
                position: rotateDialog.position,
            });
            setToast('Teachers rotated');
            setRotateDialog(null);
            refresh();
        } catch (err) {
            setFormError(err.message);
        } finally {
            setSaving(false);
        }
    };

    const handleAutoAssign = async () => {
        setSaving(true);
        try {
            const result = await assignmentApi.autoAssignMain(0);
            setToast(result.message);
            refresh();
        } catch (err) {
            setToast(err.message);
        } finally {
            setSaving(false);
        }
    };

    const handlePlaceStudents = async () => {
        setSaving(true);
        setFormError('');
        try {
            const result = await studentApi.assign(
                placeDialog.studentIds, placeDialog.classId, 'Placed by administrator'
            );
            setToast(result.message);
            setPlaceDialog(null);
            refresh();
        } catch (err) {
            setFormError(err.message);
        } finally {
            setSaving(false);
        }
    };

    const handleAssignStaff = async () => {
        setSaving(true);
        setFormError('');
        try {
            await assignmentApi.assignStaff({
                classId: staffDialog.classId,
                userId: staffDialog.userId,
                position: staffDialog.position,
            });
            setToast('Class staffing updated');
            setStaffDialog(null);
            refresh();
        } catch (err) {
            setFormError(err.message);
        } finally {
            setSaving(false);
        }
    };

    const handleBulkAssign = async () => {
        setSaving(true);
        setFormError('');
        try {
            const result = await assignmentApi.bulkAssignSubject({
                subjectId: bulkDialog.subjectId,
                teacherId: bulkDialog.teacherId || null,
                classIds: bulkDialog.classIds,
                sessionsPerWeek: Number(bulkDialog.sessionsPerWeek) || 0,
            });
            setToast(result.message);
            setBulkDialog(null);
            refresh();
        } catch (err) {
            setFormError(err.message);
        } finally {
            setSaving(false);
        }
    };

    const gaps = workload.data?.gaps || [];

    return (
        <>
            <PageHeader
                title="Assignments"
                subtitle="Who runs each class, and who teaches each subject."
            />

            {(unassigned.data || []).length > 0 && (
                <Alert
                    severity="info"
                    sx={{ mb: 2 }}
                    action={
                        <Button
                            size="small"
                            onClick={() => {
                                setFormError('');
                                setPlaceDialog({
                                    classId: '',
                                    studentIds: (unassigned.data || []).map((s) => s.id),
                                });
                            }}
                        >
                            Place them
                        </Button>
                    }
                >
                    {unassigned.data.length} student{unassigned.data.length === 1 ? ' has' : 's have'} no class yet.
                </Alert>
            )}

            {gaps.length > 0 && (
                <Alert severity="warning" sx={{ mb: 2.5 }}>
                    {gaps.length} class{gaps.length === 1 ? '' : 'es'} still need staffing:{' '}
                    {gaps.slice(0, 4).map((g) => g.className).join(', ')}
                    {gaps.length > 4 ? '…' : ''}
                </Alert>
            )}

            <Section
                title="Class staffing"
                icon={<ClassIcon />}
                defaultExpanded
                action={
                    <Button
                        startIcon={<SwapHorizIcon />}
                        onClick={() => {
                            setFormError('');
                            setRotateDialog({ classAId: '', classBId: '', position: 'main' });
                        }}
                    >
                        Rotate teachers
                    </Button>
                }
            >
                <DataState
                    loading={classes.loading}
                    error={classes.error}
                    empty={(classes.data || []).length === 0}
                    emptyMessage="Create classes first."
                >
                    <Grid container spacing={2.5}>
                        {(classes.data || []).map((c) => (
                            <Grid item xs={12} sm={6} md={4} key={c.id}>
                                <Card sx={{ height: '100%' }}>
                                    <CardContent>
                                        <Typography variant="h6" gutterBottom>{c.name}</Typography>

                                        <Stack spacing={1.5} sx={{ mt: 2 }}>
                                            {['main', 'assistant'].map((position) => {
                                                const holder = position === 'main' ? c.mainTeacher : c.assistantTeacher;
                                                return (
                                                    <Box key={position}>
                                                        <Typography variant="caption" color="text.secondary" display="block">
                                                            {position === 'main' ? 'Main teacher' : 'Assistant teacher'}
                                                        </Typography>
                                                        <Stack direction="row" alignItems="center" justifyContent="space-between">
                                                            <Typography variant="body2" sx={{ fontWeight: holder ? 500 : 400 }}>
                                                                {holder?.name || <em style={{ color: '#9ca3af' }}>unassigned</em>}
                                                            </Typography>
                                                            <Button
                                                                size="small"
                                                                onClick={() => {
                                                                    setFormError('');
                                                                    setStaffDialog({
                                                                        classId: c.id, className: c.name,
                                                                        position, userId: holder?.id || '',
                                                                    });
                                                                }}
                                                            >
                                                                {holder ? 'Change' : 'Assign'}
                                                            </Button>
                                                        </Stack>
                                                    </Box>
                                                );
                                            })}
                                        </Stack>

                                        <Typography variant="caption" color="text.secondary" sx={{ mt: 2, display: 'block' }}>
                                            {c.studentCount ?? 0} students
                                        </Typography>
                                    </CardContent>
                                </Card>
                            </Grid>
                        ))}
                    </Grid>
                </DataState>
            </Section>

            {/* --- Subject teaching ------------------------------------------ */}
            <Section
                title="Subject teaching"
                icon={<MenuBookIcon />}
                action={
                    <Stack direction="row" spacing={1.5}>
                        <Tooltip title="Give Maths, Science and semester subjects to each class's own main teacher">
                            <Button
                                startIcon={<AutoFixHighIcon />}
                                onClick={handleAutoAssign}
                                disabled={saving}
                            >
                                Auto-assign main-teacher subjects
                            </Button>
                        </Tooltip>
                        <Button
                            variant="contained"
                            startIcon={<GroupAddIcon />}
                            onClick={() => {
                                setFormError('');
                                setBulkDialog({ subjectId: '', teacherId: '', classIds: [], sessionsPerWeek: 5 });
                            }}
                        >
                            Assign subject across classes
                        </Button>
                    </Stack>
                }
            >
                <DataState
                    loading={subjectAssignments.loading}
                    error={subjectAssignments.error}
                    empty={(subjectAssignments.data?.assignments || []).length === 0}
                    emptyMessage="No subject assignments yet. Use the button above to staff a subject across several classes at once."
                >
                    <TableContainer component={Paper} variant="outlined">
                        <Table size="small">
                            <TableHead>
                                <TableRow>
                                    <TableCell>Subject</TableCell>
                                    <TableCell>Class</TableCell>
                                    <TableCell>Teacher</TableCell>
                                    <TableCell align="right">Sessions/week</TableCell>
                                </TableRow>
                            </TableHead>
                            <TableBody>
                                {(subjectAssignments.data?.assignments || []).map((a) => (
                                    <TableRow key={a.id} hover>
                                        <TableCell sx={{ fontWeight: 500 }}>{a.subject?.name}</TableCell>
                                        <TableCell>{a.class?.name}</TableCell>
                                        <TableCell>
                                            {a.teacher?.name || (
                                                <Chip label="Unassigned" size="small" color="warning" variant="outlined" />
                                            )}
                                        </TableCell>
                                        <TableCell align="right">{a.sessionsPerWeek}</TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </TableContainer>
                </DataState>
            </Section>

            {/* --- Students ---------------------------------------------------- */}
            <Section title="Students" icon={<GroupsIcon />}>
                <DataState
                    loading={unassigned.loading}
                    error={unassigned.error}
                >
                    <Grid container spacing={2.5}>
                        <Grid item xs={12} md={5}>
                            <Card>
                                <CardContent>
                                    <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1 }}>
                                        <Typography variant="h6">
                                            Awaiting a class ({(unassigned.data || []).length})
                                        </Typography>
                                        {(unassigned.data || []).length > 0 && (
                                            <Button
                                                size="small"
                                                startIcon={<PersonAddIcon />}
                                                onClick={() => {
                                                    setFormError('');
                                                    setPlaceDialog({
                                                        classId: '',
                                                        studentIds: (unassigned.data || []).map((s) => s.id),
                                                    });
                                                }}
                                            >
                                                Place
                                            </Button>
                                        )}
                                    </Stack>

                                    {(unassigned.data || []).length === 0 ? (
                                        <Typography variant="body2" color="text.secondary">
                                            Every active student has a class.
                                        </Typography>
                                    ) : (
                                        <Stack spacing={0.5}>
                                            {(unassigned.data || []).map((s) => (
                                                <Stack
                                                    key={s.id}
                                                    direction="row"
                                                    justifyContent="space-between"
                                                    sx={{ py: 0.75, borderBottom: '1px solid', borderColor: 'divider' }}
                                                >
                                                    <Typography variant="body2">{s.name}</Typography>
                                                    <Typography variant="caption" color="text.secondary">
                                                        {s.admissionNo}
                                                    </Typography>
                                                </Stack>
                                            ))}
                                        </Stack>
                                    )}
                                </CardContent>
                            </Card>
                        </Grid>

                        <Grid item xs={12} md={7}>
                            <Card>
                                <CardContent>
                                    <Typography variant="h6" gutterBottom>Class occupancy</Typography>
                                    <TableContainer>
                                        <Table size="small">
                                            <TableHead>
                                                <TableRow>
                                                    <TableCell>Class</TableCell>
                                                    <TableCell>Main teacher</TableCell>
                                                    <TableCell align="right">Students</TableCell>
                                                    <TableCell align="right">Places left</TableCell>
                                                </TableRow>
                                            </TableHead>
                                            <TableBody>
                                                {(classes.data || []).map((c) => {
                                                    const free = c.capacity == null
                                                        ? null
                                                        : c.capacity - (c.studentCount ?? 0);
                                                    return (
                                                        <TableRow key={c.id} hover>
                                                            <TableCell sx={{ fontWeight: 500 }}>{c.name}</TableCell>
                                                            <TableCell>
                                                                {c.mainTeacher?.name || (
                                                                    <Chip label="none" size="small" color="warning" variant="outlined" />
                                                                )}
                                                            </TableCell>
                                                            <TableCell align="right">
                                                                {c.studentCount ?? 0}
                                                                {c.capacity ? ` / ${c.capacity}` : ''}
                                                            </TableCell>
                                                            <TableCell align="right">
                                                                {free === null ? (
                                                                    <Typography variant="caption" color="text.disabled">
                                                                        no limit
                                                                    </Typography>
                                                                ) : (
                                                                    <Typography
                                                                        variant="body2"
                                                                        color={free <= 0 ? 'error.main' : 'text.primary'}
                                                                    >
                                                                        {free}
                                                                    </Typography>
                                                                )}
                                                            </TableCell>
                                                        </TableRow>
                                                    );
                                                })}
                                            </TableBody>
                                        </Table>
                                    </TableContainer>
                                </CardContent>
                            </Card>
                        </Grid>
                    </Grid>
                </DataState>
            </Section>

            {/* --- Workload --------------------------------------------------- */}
            <Section title="Workload" icon={<AssignmentIndIcon />}>
                <DataState
                    loading={workload.loading}
                    error={workload.error}
                    empty={(workload.data?.teachers || []).length === 0}
                    emptyMessage="No teaching staff yet."
                >
                    <TableContainer component={Paper} variant="outlined">
                        <Table size="small">
                            <TableHead>
                                <TableRow>
                                    <TableCell>Teacher</TableCell>
                                    <TableCell>Role</TableCell>
                                    <TableCell align="right">Homeroom</TableCell>
                                    <TableCell align="right">Assistant</TableCell>
                                    <TableCell align="right">Subject classes</TableCell>
                                    <TableCell align="right">Sessions/week</TableCell>
                                    <TableCell>Subjects</TableCell>
                                </TableRow>
                            </TableHead>
                            <TableBody>
                                {(workload.data?.teachers || []).map((t) => (
                                    <TableRow key={t.id} hover>
                                        <TableCell sx={{ fontWeight: 500 }}>{t.name}</TableCell>
                                        <TableCell>{roleLabel(t.role)}</TableCell>
                                        <TableCell align="right">{t.mainOf || '—'}</TableCell>
                                        <TableCell align="right">{t.assistantOf || '—'}</TableCell>
                                        <TableCell align="right">{t.subjectClasses || '—'}</TableCell>
                                        <TableCell align="right">
                                            <Typography
                                                variant="body2"
                                                color={t.weeklySessions > 25 ? 'error.main' : 'text.primary'}
                                                sx={{ fontWeight: t.weeklySessions > 25 ? 600 : 400 }}
                                            >
                                                {t.weeklySessions}
                                            </Typography>
                                        </TableCell>
                                        <TableCell>
                                            <Stack direction="row" spacing={0.5} flexWrap="wrap" useFlexGap>
                                                {t.subjects.map((s) => (
                                                    <Chip key={s} label={s} size="small" variant="outlined" />
                                                ))}
                                            </Stack>
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </TableContainer>
                </DataState>
            </Section>

            {/* Assign class staff ---------------------------------------------- */}
            <Dialog open={Boolean(staffDialog)} onClose={() => setStaffDialog(null)} maxWidth="xs" fullWidth>
                <DialogTitle>
                    {staffDialog?.position === 'main' ? 'Main teacher' : 'Assistant teacher'} — {staffDialog?.className}
                </DialogTitle>
                <DialogContent>
                    {formError && <Alert severity="error" sx={{ mb: 2 }}>{formError}</Alert>}
                    <TextField
                        select label="Teacher" required fullWidth sx={{ mt: 1 }}
                        value={staffDialog?.userId || ''}
                        onChange={(e) => setStaffDialog((d) => ({ ...d, userId: e.target.value }))}
                    >
                        {teachers.map((t) => (
                            <MenuItem key={t.id} value={t.id}>
                                {t.name} — {roleLabel(t.role)}
                            </MenuItem>
                        ))}
                    </TextField>
                </DialogContent>
                <DialogActions sx={{ px: 3, pb: 2 }}>
                    <Button onClick={() => setStaffDialog(null)}>Cancel</Button>
                    <Button variant="contained" onClick={handleAssignStaff} disabled={saving || !staffDialog?.userId}>
                        Save
                    </Button>
                </DialogActions>
            </Dialog>

            {/* Bulk subject assignment ----------------------------------------- */}
            <Dialog open={Boolean(bulkDialog)} onClose={() => setBulkDialog(null)} maxWidth="sm" fullWidth>
                <DialogTitle>Assign a subject across classes</DialogTitle>
                <DialogContent>
                    {formError && <Alert severity="error" sx={{ mb: 2 }}>{formError}</Alert>}
                    {bulkDialog && (
                        <Stack spacing={2} sx={{ mt: 1 }}>
                            <Typography variant="body2" color="text.secondary">
                                Pick one subject and one teacher, then tick every class they take for it.
                            </Typography>

                            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
                                <TextField
                                    select label="Subject" required fullWidth
                                    value={bulkDialog.subjectId}
                                    onChange={(e) => setBulkDialog((d) => ({ ...d, subjectId: e.target.value }))}
                                >
                                    {(subjects.data || []).map((s) => (
                                        <MenuItem key={s.id} value={s.id}>{s.name}</MenuItem>
                                    ))}
                                </TextField>
                                <TextField
                                    select label="Teacher" fullWidth
                                    value={bulkDialog.teacherId}
                                    onChange={(e) => setBulkDialog((d) => ({ ...d, teacherId: e.target.value }))}
                                >
                                    <MenuItem value="">Leave unassigned</MenuItem>
                                    {teachers.map((t) => (
                                        <MenuItem key={t.id} value={t.id}>{t.name}</MenuItem>
                                    ))}
                                </TextField>
                            </Stack>

                            <Box>
                                <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 1 }}>
                                    Classes ({bulkDialog.classIds.length} selected)
                                </Typography>
                                <ToggleButtonGroup
                                    value={bulkDialog.classIds}
                                    onChange={(_, value) => setBulkDialog((d) => ({ ...d, classIds: value }))}
                                    sx={{ flexWrap: 'wrap', gap: 1, '& .MuiToggleButton-root': { borderRadius: '8px !important', border: '1px solid #e5e7eb !important' } }}
                                >
                                    {(classes.data || []).map((c) => (
                                        <ToggleButton key={c.id} value={c.id} size="small" sx={{ px: 1.5, py: 0.5 }}>
                                            {c.name}
                                        </ToggleButton>
                                    ))}
                                </ToggleButtonGroup>
                            </Box>

                            <TextField
                                label="Sessions per week (each class)" type="number" fullWidth
                                value={bulkDialog.sessionsPerWeek}
                                onChange={(e) => setBulkDialog((d) => ({ ...d, sessionsPerWeek: e.target.value }))}
                            />
                        </Stack>
                    )}
                </DialogContent>
                <DialogActions sx={{ px: 3, pb: 2 }}>
                    <Button onClick={() => setBulkDialog(null)}>Cancel</Button>
                    <Button
                        variant="contained" onClick={handleBulkAssign}
                        disabled={saving || !bulkDialog?.subjectId || bulkDialog?.classIds?.length === 0}
                    >
                        Assign
                    </Button>
                </DialogActions>
            </Dialog>

            {/* Rotate teachers -------------------------------------------------- */}
            <Dialog open={Boolean(rotateDialog)} onClose={() => setRotateDialog(null)} maxWidth="xs" fullWidth>
                <DialogTitle>Rotate teachers</DialogTitle>
                <DialogContent>
                    {formError && <Alert severity="error" sx={{ mb: 2 }}>{formError}</Alert>}
                    {rotateDialog && (
                        <Stack spacing={2} sx={{ mt: 1 }}>
                            <Typography variant="body2" color="text.secondary">
                                Swaps the two classes' teachers in one step.
                            </Typography>

                            <TextField
                                select label="Position" fullWidth
                                value={rotateDialog.position}
                                onChange={(e) => setRotateDialog((d) => ({ ...d, position: e.target.value }))}
                            >
                                <MenuItem value="main">Main teachers</MenuItem>
                                <MenuItem value="assistant">Assistant teachers</MenuItem>
                            </TextField>

                            <TextField
                                select label="Class A" required fullWidth
                                value={rotateDialog.classAId}
                                onChange={(e) => setRotateDialog((d) => ({ ...d, classAId: e.target.value }))}
                            >
                                {(classes.data || []).map((c) => (
                                    <MenuItem key={c.id} value={c.id}>
                                        {c.name} — {(rotateDialog.position === 'main' ? c.mainTeacher : c.assistantTeacher)?.name || 'unassigned'}
                                    </MenuItem>
                                ))}
                            </TextField>

                            <TextField
                                select label="Class B" required fullWidth
                                value={rotateDialog.classBId}
                                onChange={(e) => setRotateDialog((d) => ({ ...d, classBId: e.target.value }))}
                            >
                                {(classes.data || [])
                                    .filter((c) => c.id !== rotateDialog.classAId)
                                    .map((c) => (
                                        <MenuItem key={c.id} value={c.id}>
                                            {c.name} — {(rotateDialog.position === 'main' ? c.mainTeacher : c.assistantTeacher)?.name || 'unassigned'}
                                        </MenuItem>
                                    ))}
                            </TextField>
                        </Stack>
                    )}
                </DialogContent>
                <DialogActions sx={{ px: 3, pb: 2 }}>
                    <Button onClick={() => setRotateDialog(null)}>Cancel</Button>
                    <Button
                        variant="contained" onClick={handleRotate}
                        disabled={saving || !rotateDialog?.classAId || !rotateDialog?.classBId}
                    >
                        Rotate
                    </Button>
                </DialogActions>
            </Dialog>

            {/* Place students --------------------------------------------------- */}
            <Dialog open={Boolean(placeDialog)} onClose={() => setPlaceDialog(null)} maxWidth="xs" fullWidth>
                <DialogTitle>Place students</DialogTitle>
                <DialogContent>
                    {formError && <Alert severity="error" sx={{ mb: 2 }}>{formError}</Alert>}
                    {placeDialog && (
                        <Stack spacing={2} sx={{ mt: 1 }}>
                            <TextField
                                select label="Into class" required fullWidth
                                value={placeDialog.classId}
                                onChange={(e) => setPlaceDialog((d) => ({ ...d, classId: e.target.value }))}
                            >
                                {(classes.data || []).map((c) => {
                                    const free = c.capacity == null ? null : c.capacity - (c.studentCount ?? 0);
                                    return (
                                        <MenuItem key={c.id} value={c.id} disabled={free !== null && free <= 0}>
                                            {c.name}{free !== null ? ` — ${free} place(s) free` : ''}
                                        </MenuItem>
                                    );
                                })}
                            </TextField>

                            <Box>
                                <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 0.5 }}>
                                    Students ({placeDialog.studentIds.length} selected)
                                </Typography>
                                <Box sx={{ maxHeight: 220, overflowY: 'auto', border: '1px solid', borderColor: 'divider', borderRadius: 1, px: 1 }}>
                                    {(unassigned.data || []).map((s) => (
                                        <FormControlLabel
                                            key={s.id}
                                            sx={{ display: 'flex' }}
                                            control={
                                                <Checkbox
                                                    size="small"
                                                    checked={placeDialog.studentIds.includes(s.id)}
                                                    onChange={(e) => setPlaceDialog((d) => ({
                                                        ...d,
                                                        studentIds: e.target.checked
                                                            ? [...d.studentIds, s.id]
                                                            : d.studentIds.filter((id) => id !== s.id),
                                                    }))}
                                                />
                                            }
                                            label={<Typography variant="body2">{s.name}</Typography>}
                                        />
                                    ))}
                                </Box>
                            </Box>
                        </Stack>
                    )}
                </DialogContent>
                <DialogActions sx={{ px: 3, pb: 2 }}>
                    <Button onClick={() => setPlaceDialog(null)}>Cancel</Button>
                    <Button
                        variant="contained" onClick={handlePlaceStudents}
                        disabled={saving || !placeDialog?.classId || placeDialog?.studentIds?.length === 0}
                    >
                        Place
                    </Button>
                </DialogActions>
            </Dialog>

            <Snackbar open={Boolean(toast)} autoHideDuration={3000}
                onClose={() => setToast('')} message={toast}
                anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }} />
        </>
    );
}
