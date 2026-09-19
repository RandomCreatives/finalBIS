import { useState } from 'react';
import {
    Alert, Box, Button, Chip, Dialog, DialogActions, DialogContent, DialogTitle,
    MenuItem, Paper, Snackbar, TextField, Typography,
} from '@mui/material';
import SendOutlinedIcon from '@mui/icons-material/SendOutlined';
import ReportOutlinedIcon from '@mui/icons-material/ReportOutlined';
import useApi from '../../hooks/useApi';
import { conductApi } from '../../api/endpoints';

/*
 * Conduct report (Admin Communications) — behavior reports to the admin.
 *
 * Teachers record praise, concerns and serious incidents for roster
 * students. The admin follows the New → Acknowledged → Actioned flow from
 * the Communications queue; the teacher watches each stage here, including
 * the note on what was done.
 */

export const CONDUCT_TYPE_META = {
    praise: { label: 'Praise', color: 'success' },
    concern: { label: 'Concern', color: 'warning' },
    serious: { label: 'Serious incident', color: 'error' },
};

export const CONDUCT_STATUS_META = {
    new: { label: 'New', color: 'warning' },
    acknowledged: { label: 'Acknowledged', color: 'info' },
    actioned: { label: 'Actioned', color: 'success' },
};

export default function ConductSection({ klass, classId, roster }) {
    const reports = useApi(() => conductApi.list(), []);

    const [dialog, setDialog] = useState(false);
    const [studentId, setStudentId] = useState('');
    const [type, setType] = useState('praise');
    const [body, setBody] = useState('');
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');
    const [toast, setToast] = useState('');

    const students = (roster || []).filter((s) => s && s.id);

    const openDialog = () => {
        setStudentId('');
        setType('praise');
        setBody('');
        setError('');
        setDialog(true);
    };

    const valid = studentId && body.trim().length >= 5;

    const submit = async () => {
        if (!valid || saving) return;
        setSaving(true);
        setError('');
        try {
            await conductApi.create({ classId, studentId, type, body: body.trim() });
            setDialog(false);
            setToast('Report sent to the admin');
            reports.reload();
        } catch (err) {
            setError(err.message || 'Could not send the report');
        } finally {
            setSaving(false);
        }
    };

    const withdraw = async (id) => {
        try {
            await conductApi.remove(id);
            setToast('Report withdrawn');
            reports.reload();
        } catch (err) {
            setToast(err.message || 'Could not withdraw');
        }
    };

    return (
        <Box>
            <Box sx={{ display: 'flex', alignItems: { xs: 'stretch', sm: 'center' }, gap: 1.5, mb: 2.5,
                flexDirection: { xs: 'column', sm: 'row' } }}>
                <Typography sx={{ fontSize: 13, color: 'text.secondary', flexGrow: 1 }}>
                    Record praise, concerns and serious incidents so the admin can follow up —
                    you will see here when it is acknowledged and what action was taken.
                </Typography>
                <Button variant="contained" disableElevation startIcon={<SendOutlinedIcon sx={{ fontSize: 16 }} />}
                    onClick={openDialog} disabled={students.length === 0}
                    sx={{ fontWeight: 700, textTransform: 'none', borderRadius: 2, whiteSpace: 'nowrap' }}>
                    New conduct report
                </Button>
            </Box>

            {reports.error && <Alert severity="error">Could not load your reports — please refresh.</Alert>}

            {!reports.loading && !reports.error && (reports.data || []).length === 0 && (
                <Paper variant="outlined" sx={{ p: 3.5, borderRadius: 2, textAlign: 'center',
                    borderStyle: 'dashed' }}>
                    <ReportOutlinedIcon sx={{ fontSize: 30, color: 'text.disabled', mb: 0.5 }} />
                    <Typography sx={{ fontWeight: 700, mb: 0.5 }}>No conduct reports yet</Typography>
                    <Typography variant="body2" color="text.secondary">
                        Good and bad — both are worth recording here for the admin.
                    </Typography>
                </Paper>
            )}

            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                {(reports.data || []).map((r) => {
                    const tone = CONDUCT_TYPE_META[r.type] || CONDUCT_TYPE_META.praise;
                    const status = CONDUCT_STATUS_META[r.status] || CONDUCT_STATUS_META.new;
                    return (
                        <Paper key={r.id} variant="outlined" sx={{ p: 1.75, borderRadius: 2 }}>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25, flexWrap: 'wrap' }}>
                                <Typography sx={{ fontWeight: 800, fontSize: 14 }}>
                                    {r.student?.name}
                                </Typography>
                                <Chip size="small" label={tone.label} color={tone.color}
                                    sx={{ fontWeight: 700, height: 20, fontSize: 10.5 }} />
                                <Chip size="small" variant="outlined" label={status.label} color={status.color}
                                    sx={{ fontWeight: 700, height: 20, fontSize: 10.5 }} />
                                <Typography variant="caption" color="text.secondary" sx={{ ml: 'auto' }}>
                                    {new Date(r.createdAt).toLocaleDateString(undefined,
                                        { day: 'numeric', month: 'short' })}
                                </Typography>
                            </Box>
                            <Typography sx={{ fontSize: 13.5, mt: 0.75, color: 'text.primary' }}>
                                {r.body}
                            </Typography>
                            {r.actionNote && (
                                <Alert severity="info" sx={{ mt: 1, py: 0 }}>
                                    Admin: {r.actionNote}
                                </Alert>
                            )}
                            {r.status === 'new' && (
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

            {/* new report dialog */}
            <Dialog open={dialog} onClose={() => !saving && setDialog(false)} maxWidth="sm" fullWidth>
                <DialogTitle sx={{ fontWeight: 800 }}>
                    New conduct report
                    <Typography variant="caption" color="text.secondary" sx={{ display: 'block', fontWeight: 600 }}>
                        {klass.name} · goes straight to the admin
                    </Typography>
                </DialogTitle>
                <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 1 }}>
                    {error && <Alert severity="error">{error}</Alert>}
                    <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                        {Object.entries(CONDUCT_TYPE_META).map(([value, meta]) => (
                            <Chip key={value} label={meta.label} color={meta.color} clickable
                                variant={type === value ? 'filled' : 'outlined'}
                                onClick={() => setType(value)}
                                sx={{ fontWeight: 700 }} />
                        ))}
                    </Box>
                    <TextField select label="Student *" size="small" fullWidth
                        value={studentId} onChange={(e) => setStudentId(e.target.value)}>
                        {students.map((s) => (
                            <MenuItem key={s.id} value={s.id}>{s.name}</MenuItem>
                        ))}
                    </TextField>
                    <TextField label="What happened? *" size="small" fullWidth multiline minRows={3}
                        placeholder={type === 'praise'
                            ? "e.g. Hanna led the clean-up and helped two classmates finish"
                            : "e.g. Hanna has disrupted group work three times this week"}
                        value={body} onChange={(e) => setBody(e.target.value)} />
                </DialogContent>
                <DialogActions sx={{ px: 3, pb: 2.5 }}>
                    <Button onClick={() => setDialog(false)} disabled={saving}
                        sx={{ textTransform: 'none' }}>
                        Cancel
                    </Button>
                    <Button variant="contained" disableElevation onClick={submit}
                        disabled={!valid || saving} color={CONDUCT_TYPE_META[type].color}
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
