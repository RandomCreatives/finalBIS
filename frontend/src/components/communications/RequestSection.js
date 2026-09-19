import { useState } from 'react';
import {
    Alert, Box, Button, Chip, Dialog, DialogActions, DialogContent, DialogTitle,
    MenuItem, Paper, Snackbar, TextField, Typography,
} from '@mui/material';
import SendOutlinedIcon from '@mui/icons-material/SendOutlined';
import VerifiedUserOutlinedIcon from '@mui/icons-material/VerifiedUserOutlined';
import useApi from '../../hooks/useApi';
import { permissionApi } from '../../api/endpoints';

/*
 * Request (Admin Communications) — permission requests to the admin.
 *
 * Every request is tied to a roster student (picked in the class) plus a
 * reason and an optional release time — the everyday case is a parent
 * collecting a child mid-class. The admin approves or declines from the
 * Communications queue; the teacher watches the status change here and can
 * withdraw while it is still pending.
 */

export const REQUEST_STATUS_META = {
    pending: { label: 'Pending', color: 'warning' },
    approved: { label: 'Approved', color: 'success' },
    declined: { label: 'Declined', color: 'error' },
};

const fmtPickup = (iso) =>
    iso
        ? new Date(iso).toLocaleString(undefined, {
            weekday: 'short', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit',
        })
        : '';

export default function RequestSection({ klass, classId, roster }) {
    const requests = useApi(() => permissionApi.list(), []);

    const [dialog, setDialog] = useState(false);
    const [studentId, setStudentId] = useState('');
    const [reason, setReason] = useState('');
    const [pickup, setPickup] = useState('');
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');
    const [toast, setToast] = useState('');

    const students = (roster || []).filter((s) => s && s.id);

    const openDialog = () => {
        setStudentId('');
        setReason('');
        setPickup('');
        setError('');
        setDialog(true);
    };

    const valid = studentId && reason.trim().length >= 3;

    const submit = async () => {
        if (!valid || saving) return;
        setSaving(true);
        setError('');
        try {
            await permissionApi.create({
                classId,
                studentId,
                reason: reason.trim(),
                pickupTime: pickup ? new Date(pickup).toISOString() : null,
            });
            setDialog(false);
            setToast('Request sent to the admin');
            requests.reload();
        } catch (err) {
            setError(err.message || 'Could not send the request');
        } finally {
            setSaving(false);
        }
    };

    const withdraw = async (id) => {
        try {
            await permissionApi.remove(id);
            setToast('Request withdrawn');
            requests.reload();
        } catch (err) {
            setToast(err.message || 'Could not withdraw');
        }
    };

    return (
        <Box>
            <Box sx={{ display: 'flex', alignItems: { xs: 'stretch', sm: 'center' }, gap: 1.5, mb: 2.5,
                flexDirection: { xs: 'column', sm: 'row' } }}>
                <Typography sx={{ fontSize: 13, color: 'text.secondary', flexGrow: 1 }}>
                    Ask the admin for permission on class matters — e.g. a parent collecting a
                    child in the middle of a lesson. The request always names the student.
                </Typography>
                <Button variant="contained" disableElevation startIcon={<SendOutlinedIcon sx={{ fontSize: 16 }} />}
                    onClick={openDialog} disabled={students.length === 0}
                    sx={{ fontWeight: 700, textTransform: 'none', borderRadius: 2, whiteSpace: 'nowrap' }}>
                    New permission request
                </Button>
            </Box>

            {requests.error && <Alert severity="error">Could not load your requests — please refresh.</Alert>}

            {!requests.loading && !requests.error && (requests.data || []).length === 0 && (
                <Paper variant="outlined" sx={{ p: 3.5, borderRadius: 2, textAlign: 'center',
                    borderStyle: 'dashed' }}>
                    <VerifiedUserOutlinedIcon sx={{ fontSize: 30, color: 'text.disabled', mb: 0.5 }} />
                    <Typography sx={{ fontWeight: 700, mb: 0.5 }}>No requests yet</Typography>
                    <Typography variant="body2" color="text.secondary">
                        When something needs the admin's permission, send it from here.
                    </Typography>
                </Paper>
            )}

            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                {(requests.data || []).map((r) => {
                    const meta = REQUEST_STATUS_META[r.status] || REQUEST_STATUS_META.pending;
                    return (
                        <Paper key={r.id} variant="outlined" sx={{ p: 1.75, borderRadius: 2 }}>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25, flexWrap: 'wrap' }}>
                                <Typography sx={{ fontWeight: 800, fontSize: 14 }}>
                                    {r.student?.name}
                                </Typography>
                                <Chip size="small" label={meta.label} color={meta.color}
                                    sx={{ fontWeight: 700, height: 20, fontSize: 10.5 }} />
                                {r.pickupTime && (
                                    <Chip size="small" variant="outlined" label={fmtPickup(r.pickupTime)}
                                        sx={{ fontWeight: 700, height: 20, fontSize: 10.5 }} />
                                )}
                                <Typography variant="caption" color="text.secondary" sx={{ ml: 'auto' }}>
                                    {new Date(r.createdAt).toLocaleDateString(undefined,
                                        { day: 'numeric', month: 'short' })}
                                </Typography>
                            </Box>
                            <Typography sx={{ fontSize: 13.5, mt: 0.75, color: 'text.primary' }}>
                                {r.reason}
                            </Typography>
                            {r.reviewNote && (
                                <Alert severity={r.status === 'approved' ? 'success' : 'error'}
                                    sx={{ mt: 1, py: 0 }}>
                                    Admin: {r.reviewNote}
                                </Alert>
                            )}
                            {r.status === 'pending' && (
                                <Box sx={{ mt: 0.75 }}>
                                    <Button size="small" color="inherit" onClick={() => withdraw(r.id)}
                                        sx={{ textTransform: 'none', fontWeight: 700, color: 'text.secondary' }}>
                                        Withdraw
                                    </Button>
                                </Box>
                            )}
                        </Paper>
                    );
                })}
            </Box>

            {/* new request dialog */}
            <Dialog open={dialog} onClose={() => !saving && setDialog(false)} maxWidth="sm" fullWidth>
                <DialogTitle sx={{ fontWeight: 800 }}>
                    New permission request
                    <Typography variant="caption" color="text.secondary" sx={{ display: 'block', fontWeight: 600 }}>
                        {klass.name} · goes straight to the admin
                    </Typography>
                </DialogTitle>
                <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 1 }}>
                    {error && <Alert severity="error">{error}</Alert>}
                    <TextField select label="Student *" size="small" fullWidth
                        value={studentId} onChange={(e) => setStudentId(e.target.value)}>
                        {students.map((s) => (
                            <MenuItem key={s.id} value={s.id}>{s.name}</MenuItem>
                        ))}
                    </TextField>
                    <TextField label="What needs permission? *" size="small" fullWidth multiline minRows={2}
                        placeholder="e.g. Hanna's parent will collect her at 10:30 for a dental check-up"
                        value={reason} onChange={(e) => setReason(e.target.value)} />
                    <TextField label="Release time (optional)" size="small" fullWidth
                        type="datetime-local" InputLabelProps={{ shrink: true }}
                        value={pickup} onChange={(e) => setPickup(e.target.value)} />
                </DialogContent>
                <DialogActions sx={{ px: 3, pb: 2.5 }}>
                    <Button onClick={() => setDialog(false)} disabled={saving}
                        sx={{ textTransform: 'none' }}>
                        Cancel
                    </Button>
                    <Button variant="contained" disableElevation onClick={submit}
                        disabled={!valid || saving}
                        sx={{ textTransform: 'none', fontWeight: 700 }}>
                        {saving ? 'Sending…' : 'Send to admin'}
                    </Button>
                </DialogActions>
            </Dialog>

            <Snackbar open={Boolean(toast)} autoHideDuration={3200}
                onClose={() => setToast('')} message={toast} />
        </Box>
    );
}
