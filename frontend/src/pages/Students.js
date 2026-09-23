import { useEffect, useState } from 'react';
import {
    Alert, Box, Button, Card, Chip, Dialog, DialogActions, DialogContent, DialogTitle,
    FormControlLabel, IconButton, MenuItem, Paper, Snackbar, Stack, Switch, Table, TableBody,
    TableCell, TableContainer, TableHead, TableRow, TextField, Typography, Tooltip,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import SwapHorizIcon from '@mui/icons-material/SwapHoriz';
import FileUploadIcon from '@mui/icons-material/FileUpload';
import DownloadIcon from '@mui/icons-material/Download';
import { studentApi, studentRequestApi, classApi, termApi, paymentApi } from '../api/endpoints';
import useApi from '../hooks/useApi';
import PageHeader from '../components/PageHeader';
import DataState from '../components/DataState';
import { useAuth } from '../auth/AuthContext';
import { PaymentChip, paymentLabel } from '../utils/payments';

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
    const [importDialog, setImportDialog] = useState(false);
    const [importFile, setImportFile] = useState(null);
    const [importing, setImporting] = useState(false);

    const classes = useApi(() => classApi.list(), []);
    const students = useApi(
        () => studentApi.list({ classId: classFilter || undefined, search: search || undefined }),
        [classFilter, search]
    );

    // Term payment statuses across the school — admins confirm the data the
    // class teachers record (decision: Mike, 2026-09-22).
    const term = useApi(() => termApi.current(), []);
    const termId = term.data?.term?.id;
    const termName = term.data?.term?.name || 'Term 1';
    const payments = useApi(
        () => (termId ? paymentApi.list({ termId }) : Promise.resolve(null)),
        [termId],
    );
    const [payMap, setPayMap] = useState({});
    useEffect(() => {
        if (Array.isArray(payments.data))
            setPayMap(Object.fromEntries(payments.data.map((p) => [p.studentId, p])));
    }, [payments.data]);

    const [payTarget, setPayTarget] = useState(null); // student being corrected
    const [paySaving, setPaySaving] = useState(false);
    const setPaymentStatus = async (status) => {
        if (!payTarget || !termId) return;
        setPaySaving(true);
        try {
            const row = await paymentApi.set(payTarget.id, termId, status);
            setPayMap((m) => {
                const next = { ...m };
                if (status === 'unpaid') delete next[payTarget.id]; else next[payTarget.id] = row;
                return next;
            });
            setToast(status === 'unpaid' ? 'Payment cleared' : `Payment recorded for ${payTarget.name}`);
            setPayTarget(null);
        } catch (err) {
            setToast(err.message || 'Could not record the payment');
        } finally {
            setPaySaving(false);
        }
    };

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

    const handleImport = async () => {
        if (!importFile) return;
        setImporting(true);
        setFormError('');
        const formData = new FormData();
        formData.append('file', importFile);
        try {
            const data = await studentApi.import(formData);
            setToast(data.message || `${data.imported} students imported`);
            students.reload();
            setImportDialog(false);
            setImportFile(null);
        } catch (err) {
            setFormError(err.message);
        } finally {
            setImporting(false);
        }
    };

    const downloadTemplate = () => {
        const csv = [
            'admissionNo,name,rollNum,dateOfBirth,gender,guardianName,guardianPhone,guardianEmail,specialNeeds,specialNeedsNote',
            'STU001,"John Doe",1,2010-05-15,male,"Jane Doe","+251 91 123 4567","jane@example.com",yes,"Needs extra math support"',
            'STU002,"Mary Smith",2,2010-08-22,female,"Mark Smith","+251 92 234 5678","mark@example.com",no,',
        ].join('\n');
        const blob = new Blob([csv], { type: 'text/csv' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'student-import-template.csv';
        a.click();
        window.URL.revokeObjectURL(url);
    };

    // Office queue: main-teacher intake waiting for approval (migration 019).
    const pendingReqs = useApi(
        () => (user?.role === 'admin'
            ? studentRequestApi.list({ status: 'pending' }).catch(() => [])
            : Promise.resolve([])),
        [user?.role],
    );
    const [reqSaving, setReqSaving] = useState(false);
    const [declineTarget, setDeclineTarget] = useState(null);
    const [declineNote, setDeclineNote] = useState('');

    const approveRequest = async (r) => {
        if (reqSaving) return;
        setReqSaving(true);
        try {
            const res = await studentRequestApi.approve(r.id);
            setToast(`${r.name} added to ${res.request.className} — roll ${res.student.rollNum} · ${res.student.admissionNo}`);
            await pendingReqs.reload();
            await students.reload();
        } catch (err) {
            setToast(err.message || 'Could not approve the request');
        } finally {
            setReqSaving(false);
        }
    };

    const declineRequest = async () => {
        if (!declineTarget || reqSaving) return;
        setReqSaving(true);
        try {
            await studentRequestApi.reject(declineTarget.id, declineNote.trim());
            setToast(`Request for ${declineTarget.name} declined`);
            setDeclineTarget(null);
            setDeclineNote('');
            await pendingReqs.reload();
        } catch (err) {
            setToast(err.message || 'Could not decline the request');
        } finally {
            setReqSaving(false);
        }
    };

    const rows = students.data || [];

    return (
        <>
            <PageHeader
                title="Students"
                subtitle="Enrolment records, guardians and class placement."
                action={canEdit && (
                    <>
                        <Button variant="contained" startIcon={<AddIcon />} onClick={openCreate}>
                            Add student
                        </Button>
                        <Button variant="outlined" startIcon={<FileUploadIcon />} onClick={() => setImportDialog(true)}>
                            Import Excel
                        </Button>
                    </>
                )}
            />

            {user?.role === 'admin' && !pendingReqs.error && (pendingReqs.data || []).length > 0 && (
                <Card sx={{ p: 2, mb: 2.5, borderLeft: 4, borderColor: 'warning.main' }} data-testid="student-requests">
                    <Typography sx={{ fontWeight: 800, mb: 1.5 }}>
                        New student requests ({pendingReqs.data.length})
                    </Typography>
                    <Stack spacing={1.5}>
                        {pendingReqs.data.map((r) => (
                            <Box key={r.id} sx={{ display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap' }}>
                                <Box sx={{ minWidth: 240 }}>
                                    <Typography sx={{ fontWeight: 700 }}>{r.name}</Typography>
                                    <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                                        {r.requestedByName} · {new Date(r.createdAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                                        {r.guardianPhone ? ` · ${r.guardianPhone}` : ''}
                                    </Typography>
                                </Box>
                                <Chip size="small" label={r.className} sx={{ fontWeight: 600 }} />
                                <Box sx={{ ml: 'auto', display: 'flex', gap: 1 }}>
                                    <Button size="small" variant="contained" color="success" disableElevation
                                        data-testid={`approve-${r.id}`} disabled={reqSaving}
                                        onClick={() => approveRequest(r)}
                                        sx={{ fontWeight: 700, textTransform: 'none' }}>
                                        Approve
                                    </Button>
                                    <Button size="small" variant="outlined" color="error"
                                        data-testid={`decline-${r.id}`} disabled={reqSaving}
                                        onClick={() => setDeclineTarget(r)}
                                        sx={{ fontWeight: 700, textTransform: 'none' }}>
                                        Decline
                                    </Button>
                                </Box>
                            </Box>
                        ))}
                    </Stack>
                </Card>
            )}

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

            {termId && !payments.error && (
                <Typography variant="caption" color="text.secondary" sx={{ mt: 1.5, display: 'block' }}>
                    {rows.filter((s) => payMap[s.id]?.status).length} of {rows.length} shown are paid for {termName}
                    {user?.role === 'admin' ? ' — tap a status chip to confirm or correct it.' : '.'}
                </Typography>
            )}

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
                                <TableCell>Payment</TableCell>
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
                                    <TableCell>
                                        {payments.error || !termId ? <span>—</span> : (
                                            <PaymentChip
                                                status={payMap[s.id]?.status || 'unpaid'}
                                                termName={termName}
                                                dataTestId={`admin-payment-chip-${s.id}`}
                                                onClick={user?.role === 'admin' ? () => setPayTarget(s) : undefined}
                                            />
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
            {/* Payment confirmation / correction ---------------------------- */}
            <Dialog open={Boolean(payTarget)} onClose={() => setPayTarget(null)} maxWidth="xs" fullWidth>
                <DialogTitle sx={{ fontWeight: 800, pb: 1 }}>
                    Payment — {payTarget?.name}
                    <Typography variant="caption" color="text.secondary" sx={{ display: 'block', fontWeight: 600 }}>
                        {payTarget?.class?.name || 'Unassigned'} · {termName}
                    </Typography>
                </DialogTitle>
                <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 1 }}>
                    <Box
                        data-testid="payment-receipt"
                        sx={{
                            px: 2, py: 1.5, borderRadius: 1.25,
                            border: '1.5px dashed', borderColor: 'divider',
                            bgcolor: 'rgba(237,108,2,.04)',
                        }}
                    >
                        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                            <Typography sx={{ fontSize: 10.5, fontWeight: 800, letterSpacing: 1.4,
                                color: 'text.secondary', fontFamily: 'monospace' }}>
                                PAYMENT · {termName.toUpperCase()}
                            </Typography>
                            <PaymentChip status={payMap[payTarget?.id]?.status || 'unpaid'} termName={termName} />
                        </Box>
                        <Typography sx={{ fontSize: 11.5, color: 'text.secondary', mt: .75 }}>
                            {payMap[payTarget?.id]?.status
                                ? `Recorded by ${payMap[payTarget.id].markedBy || 'staff'}${payMap[payTarget.id].markedAt
                                    ? ` · ${new Date(payMap[payTarget.id].markedAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}`
                                    : ''}`
                                : 'No payment recorded for this term yet.'}
                        </Typography>
                    </Box>
                    <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                        {['unpaid', 'paid_term', 'paid_annum'].map((st) => {
                            const current = payMap[payTarget?.id]?.status || 'unpaid';
                            return (
                                <Button
                                    key={st}
                                    size="small"
                                    variant={current === st ? 'contained' : 'outlined'}
                                    disableElevation
                                    disabled={paySaving}
                                    onClick={() => current !== st && setPaymentStatus(st)}
                                    sx={{ fontWeight: 700, textTransform: 'none' }}
                                >
                                    {paymentLabel(st, termName)}
                                </Button>
                            );
                        })}
                    </Box>
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setPayTarget(null)} sx={{ textTransform: 'none' }}>Close</Button>
                </DialogActions>
            </Dialog>

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

            {/* Import Excel -------------------------------------------------------- */}
            <Dialog open={importDialog} onClose={() => setImportDialog(false)} maxWidth="sm" fullWidth>
                <DialogTitle>Import Students from Excel</DialogTitle>
                <DialogContent>
                    {formError && <Alert severity="error" sx={{ mb: 2 }}>{formError}</Alert>}
                    <Stack spacing={3} sx={{ mt: 1 }}>
                        <TextField
                            type="file"
                            accept=".xlsx,.xls,.csv"
                            onChange={(e) => {
                                setImportFile(e.target.files[0]);
                                setFormError('');
                            }}
                            size="small"
                            helperText="Columns: admissionNo, name, rollNum, dateOfBirth, gender, guardianName, guardianPhone, guardianEmail, specialNeeds, specialNeedsNote"
                        />
                        <Box>
                            <Button
                                variant="text"
                                size="small"
                                startIcon={<DownloadIcon />}
                                onClick={downloadTemplate}
                            >
                                Download template CSV
                            </Button>
                        </Box>
                        <Alert severity="info" sx={{ fontSize: '0.8rem' }}>
                            Required columns: <strong>admissionNo</strong>, <strong>name</strong>.
                            All other columns are optional. Students without a class are placed in the unassigned pool.
                        </Alert>
                    </Stack>
                </DialogContent>
                <DialogActions sx={{ px: 3, pb: 2 }}>
                    <Button onClick={() => setImportDialog(false)}>Cancel</Button>
                    <Button
                        variant="contained"
                        onClick={handleImport}
                        disabled={importing || !importFile}
                        startIcon={importing ? undefined : <FileUploadIcon />}
                    >
                        {importing ? 'Importing...' : 'Import'}
                    </Button>
                </DialogActions>
            </Dialog>

            <Dialog open={Boolean(declineTarget)} onClose={() => setDeclineTarget(null)} maxWidth="xs" fullWidth>
                <DialogTitle sx={{ fontWeight: 800 }}>Decline {declineTarget?.name}?</DialogTitle>
                <DialogContent>
                    <TextField
                        label="Note for the teacher (optional)" fullWidth multiline minRows={2}
                        value={declineNote} onChange={(e) => setDeclineNote(e.target.value)}
                        inputProps={{ 'data-testid': 'decline-note' }}
                    />
                </DialogContent>
                <DialogActions sx={{ px: 3, pb: 2.5, gap: 1 }}>
                    <Button onClick={() => setDeclineTarget(null)}
                        sx={{ fontWeight: 700, textTransform: 'none', color: 'text.secondary' }}>
                        Cancel
                    </Button>
                    <Button color="error" variant="contained" disableElevation onClick={declineRequest}
                        disabled={reqSaving} data-testid="decline-confirm"
                        sx={{ fontWeight: 700, textTransform: 'none', px: 3 }}>
                        Decline request
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
