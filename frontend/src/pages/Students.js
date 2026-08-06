import { useState } from 'react';
import {
    Alert, Box, Button, Card, Chip, Dialog, DialogActions, DialogContent, DialogTitle,
    FormControlLabel, IconButton, MenuItem, Paper, Snackbar, Stack, Switch, Table, TableBody,
    TableCell, TableContainer, TableHead, TableRow, TextField, Tooltip,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import SwapHorizIcon from '@mui/icons-material/SwapHoriz';
import { studentApi, classApi } from '../api/endpoints';
import useApi from '../hooks/useApi';
import PageHeader from '../components/PageHeader';
import DataState from '../components/DataState';
import { useAuth } from '../auth/AuthContext';

const EMPTY = {
    admissionNo: '', name: '', rollNum: '', classId: '', gender: '',
    guardianName: '', guardianPhone: '', guardianEmail: '',
    specialNeeds: false, specialNeedsNote: '',
};

export default function Students() {
    const { user } = useAuth();
    const canEdit = ['admin', 'main_teacher', 'assistant_teacher'].includes(user?.role);
    const canTransfer = ['admin', 'main_teacher'].includes(user?.role);

    const [classFilter, setClassFilter] = useState('');
    const [search, setSearch] = useState('');
    const [dialog, setDialog] = useState(null);   // { mode: 'create'|'edit', values }
    const [transfer, setTransfer] = useState(null);
    const [saving, setSaving] = useState(false);
    const [formError, setFormError] = useState('');
    const [toast, setToast] = useState('');

    const classes = useApi(() => classApi.list(), []);
    const students = useApi(
        () => studentApi.list({ classId: classFilter || undefined, search: search || undefined }),
        [classFilter, search]
    );

    const openCreate = () => { setFormError(''); setDialog({ mode: 'create', values: { ...EMPTY } }); };
    const openEdit = (s) => {
        setFormError('');
        setDialog({
            mode: 'edit',
            id: s.id,
            values: {
                admissionNo: s.admissionNo || '',
                name: s.name || '',
                rollNum: s.rollNum ?? '',
                classId: s.classId || '',
                gender: s.gender || '',
                guardianName: s.guardianName || '',
                guardianPhone: s.guardianPhone || '',
                guardianEmail: s.guardianEmail || '',
                specialNeeds: Boolean(s.specialNeeds),
                specialNeedsNote: s.specialNeedsNote || '',
            },
        });
    };

    const setField = (field) => (e) => {
        const value = e.target.type === 'checkbox' ? e.target.checked : e.target.value;
        setDialog((d) => ({ ...d, values: { ...d.values, [field]: value } }));
    };

    const handleSave = async () => {
        setSaving(true);
        setFormError('');
        const v = dialog.values;

        // Strip empty optionals so the API's `optional()` validators apply.
        const payload = {
            admissionNo: v.admissionNo.trim(),
            name: v.name.trim(),
            rollNum: v.rollNum === '' ? null : Number(v.rollNum),
            classId: v.classId || null,
            gender: v.gender || null,
            guardianName: v.guardianName || null,
            guardianPhone: v.guardianPhone || null,
            guardianEmail: v.guardianEmail || null,
            specialNeeds: v.specialNeeds,
            specialNeedsNote: v.specialNeedsNote || null,
        };

        try {
            if (dialog.mode === 'create') {
                await studentApi.create(payload);
                setToast('Student added');
            } else {
                await studentApi.update(dialog.id, payload);
                setToast('Student updated');
            }
            setDialog(null);
            students.reload();
        } catch (err) {
            setFormError(err.message);
        } finally {
            setSaving(false);
        }
    };

    const handleTransfer = async () => {
        setSaving(true);
        setFormError('');
        try {
            await studentApi.transfer(transfer.student.id, transfer.toClassId, transfer.reason || null);
            setToast(`${transfer.student.name} transferred`);
            setTransfer(null);
            students.reload();
        } catch (err) {
            setFormError(err.message);
        } finally {
            setSaving(false);
        }
    };

    const rows = students.data || [];

    return (
        <>
            <PageHeader
                title="Students"
                subtitle="Enrolment records, guardians and class placement."
                action={canEdit && (
                    <Button variant="contained" startIcon={<AddIcon />} onClick={openCreate}>
                        Add student
                    </Button>
                )}
            />

            <Card sx={{ p: 2, mb: 2.5 }}>
                <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
                    <TextField
                        label="Search by name or admission no."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        size="small"
                        sx={{ flexGrow: 1 }}
                    />
                    <TextField
                        select
                        label="Class"
                        value={classFilter}
                        onChange={(e) => setClassFilter(e.target.value)}
                        size="small"
                        sx={{ minWidth: 200 }}
                    >
                        <MenuItem value="">All classes</MenuItem>
                        {(classes.data || []).map((c) => (
                            <MenuItem key={c.id} value={c.id}>{c.name}</MenuItem>
                        ))}
                    </TextField>
                </Stack>
            </Card>

            <DataState
                loading={students.loading}
                error={students.error}
                empty={rows.length === 0}
                emptyMessage="No students match this view."
            >
                <TableContainer component={Paper} variant="outlined">
                    <Table size="small">
                        <TableHead>
                            <TableRow>
                                <TableCell>Admission no.</TableCell>
                                <TableCell>Name</TableCell>
                                <TableCell>Class</TableCell>
                                <TableCell>Guardian</TableCell>
                                <TableCell>Flags</TableCell>
                                <TableCell align="right">Actions</TableCell>
                            </TableRow>
                        </TableHead>
                        <TableBody>
                            {rows.map((s) => (
                                <TableRow key={s.id} hover>
                                    <TableCell>{s.admissionNo}</TableCell>
                                    <TableCell sx={{ fontWeight: 500 }}>{s.name}</TableCell>
                                    <TableCell>{s.class?.name || <em>Unassigned</em>}</TableCell>
                                    <TableCell>
                                        {s.guardianName || '—'}
                                        {s.guardianPhone && (
                                            <Box component="span" sx={{ color: 'text.secondary', fontSize: 12, display: 'block' }}>
                                                {s.guardianPhone}
                                            </Box>
                                        )}
                                    </TableCell>
                                    <TableCell>
                                        {s.specialNeeds && (
                                            <Tooltip title={s.specialNeedsNote || 'Special educational needs'}>
                                                <Chip label="SEN" size="small" color="secondary" />
                                            </Tooltip>
                                        )}
                                    </TableCell>
                                    <TableCell align="right">
                                        {canEdit && (
                                            <Tooltip title="Edit">
                                                <IconButton size="small" onClick={() => openEdit(s)}>
                                                    <EditIcon fontSize="small" />
                                                </IconButton>
                                            </Tooltip>
                                        )}
                                        {canTransfer && (
                                            <Tooltip title="Transfer to another class">
                                                <IconButton
                                                    size="small"
                                                    onClick={() => {
                                                        setFormError('');
                                                        setTransfer({ student: s, toClassId: '', reason: '' });
                                                    }}
                                                >
                                                    <SwapHorizIcon fontSize="small" />
                                                </IconButton>
                                            </Tooltip>
                                        )}
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </TableContainer>
            </DataState>

            {/* Create / edit ---------------------------------------------------- */}
            <Dialog open={Boolean(dialog)} onClose={() => setDialog(null)} maxWidth="sm" fullWidth>
                <DialogTitle>{dialog?.mode === 'create' ? 'Add student' : 'Edit student'}</DialogTitle>
                <DialogContent>
                    {formError && <Alert severity="error" sx={{ mb: 2 }}>{formError}</Alert>}
                    {dialog && (
                        <Stack spacing={2} sx={{ mt: 1 }}>
                            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
                                <TextField
                                    label="Admission number" required fullWidth
                                    value={dialog.values.admissionNo} onChange={setField('admissionNo')}
                                />
                                <TextField
                                    label="Roll number" type="number" fullWidth
                                    value={dialog.values.rollNum} onChange={setField('rollNum')}
                                />
                            </Stack>
                            <TextField
                                label="Full name" required fullWidth
                                value={dialog.values.name} onChange={setField('name')}
                            />
                            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
                                <TextField
                                    select label="Class" fullWidth
                                    value={dialog.values.classId} onChange={setField('classId')}
                                >
                                    <MenuItem value="">Unassigned</MenuItem>
                                    {(classes.data || []).map((c) => (
                                        <MenuItem key={c.id} value={c.id}>{c.name}</MenuItem>
                                    ))}
                                </TextField>
                                <TextField
                                    select label="Gender" fullWidth
                                    value={dialog.values.gender} onChange={setField('gender')}
                                >
                                    <MenuItem value="">Not specified</MenuItem>
                                    <MenuItem value="male">Male</MenuItem>
                                    <MenuItem value="female">Female</MenuItem>
                                    <MenuItem value="other">Other</MenuItem>
                                </TextField>
                            </Stack>
                            <TextField
                                label="Guardian name" fullWidth
                                value={dialog.values.guardianName} onChange={setField('guardianName')}
                            />
                            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
                                <TextField
                                    label="Guardian phone" fullWidth
                                    value={dialog.values.guardianPhone} onChange={setField('guardianPhone')}
                                />
                                <TextField
                                    label="Guardian email" type="email" fullWidth
                                    value={dialog.values.guardianEmail} onChange={setField('guardianEmail')}
                                />
                            </Stack>
                            <FormControlLabel
                                control={<Switch checked={dialog.values.specialNeeds} onChange={setField('specialNeeds')} />}
                                label="Has special educational needs"
                            />
                            {dialog.values.specialNeeds && (
                                <TextField
                                    label="Support notes" multiline rows={2} fullWidth
                                    value={dialog.values.specialNeedsNote} onChange={setField('specialNeedsNote')}
                                />
                            )}
                        </Stack>
                    )}
                </DialogContent>
                <DialogActions sx={{ px: 3, pb: 2 }}>
                    <Button onClick={() => setDialog(null)}>Cancel</Button>
                    <Button
                        variant="contained"
                        onClick={handleSave}
                        disabled={saving || !dialog?.values.name || !dialog?.values.admissionNo}
                    >
                        Save
                    </Button>
                </DialogActions>
            </Dialog>

            {/* Transfer --------------------------------------------------------- */}
            <Dialog open={Boolean(transfer)} onClose={() => setTransfer(null)} maxWidth="xs" fullWidth>
                <DialogTitle>Transfer student</DialogTitle>
                <DialogContent>
                    {formError && <Alert severity="error" sx={{ mb: 2 }}>{formError}</Alert>}
                    {transfer && (
                        <Stack spacing={2} sx={{ mt: 1 }}>
                            <Alert severity="info">
                                Moving <strong>{transfer.student.name}</strong> from{' '}
                                {transfer.student.class?.name || 'no class'}. Past attendance and marks stay
                                with the class where they were recorded.
                            </Alert>
                            <TextField
                                select label="Move to class" required fullWidth
                                value={transfer.toClassId}
                                onChange={(e) => setTransfer((t) => ({ ...t, toClassId: e.target.value }))}
                            >
                                {(classes.data || [])
                                    .filter((c) => c.id !== transfer.student.classId)
                                    .map((c) => (
                                        <MenuItem key={c.id} value={c.id}>{c.name}</MenuItem>
                                    ))}
                            </TextField>
                            <TextField
                                label="Reason (optional)" multiline rows={2} fullWidth
                                value={transfer.reason}
                                onChange={(e) => setTransfer((t) => ({ ...t, reason: e.target.value }))}
                            />
                        </Stack>
                    )}
                </DialogContent>
                <DialogActions sx={{ px: 3, pb: 2 }}>
                    <Button onClick={() => setTransfer(null)}>Cancel</Button>
                    <Button variant="contained" onClick={handleTransfer} disabled={saving || !transfer?.toClassId}>
                        Transfer
                    </Button>
                </DialogActions>
            </Dialog>

            <Snackbar
                open={Boolean(toast)}
                autoHideDuration={3000}
                onClose={() => setToast('')}
                message={toast}
                anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
            />
        </>
    );
}
