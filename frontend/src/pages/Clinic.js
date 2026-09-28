import { useState } from 'react';
import {
    Alert, Autocomplete, Button, Card, CardContent, Chip, Dialog, DialogActions, DialogContent, DialogTitle,
    Grid, MenuItem, Paper, Snackbar, Stack, Table, TableBody, TableCell, TableContainer,
    TableHead, TableRow, TextField, Typography,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import { clinicApi } from '../api/endpoints';
import useApi from '../hooks/useApi';
import PageHeader from '../components/PageHeader';
import DataState from '../components/DataState';
import { useAuth } from '../auth/AuthContext';
import { useSearchParams } from 'react-router-dom';

const INCIDENT_TYPES = [
    'illness', 'injury', 'accident', 'emergency',
    'routine_checkup', 'medication', 'first_aid', 'other',
];
const OUTCOMES = ['returned_to_class', 'sent_home', 'referred_to_hospital', 'observation'];
const SEVERITIES = ['minor', 'moderate', 'severe', 'critical'];

const titleise = (s) => s.replace(/_/g, ' ').replace(/^\w/, (c) => c.toUpperCase());

const SEVERITY_COLOR = { minor: 'default', moderate: 'info', severe: 'warning', critical: 'error' };

const EMPTY = {
    studentId: '', complaint: '', incidentType: 'illness', severity: 'minor',
    diagnosis: '', treatment: '', outcome: 'returned_to_class',
    parentNotified: false, requestLeave: false,
};

export default function Clinic() {
    const { user, isAdmin } = useAuth();
    const isNurse = user?.role === 'nurse';
    const canRecord = ['admin', 'nurse'].includes(user?.role);
    const [searchParams] = useSearchParams();
    const admittedView = searchParams.get('view') === 'admitted';

    const [selectedStudent, setSelectedStudent] = useState(null);
    const [dialog, setDialog] = useState(null);
    const [saving, setSaving] = useState(false);
    const [formError, setFormError] = useState('');
    const [toast, setToast] = useState('');

    const visits = useApi(() => clinicApi.visits(), []);
    const summary = useApi(() => clinicApi.summary(), []);
    const students = useApi(() => clinicApi.students(), []);

    const refresh = () => { visits.reload(); summary.reload(); };

    const setField = (field) => (e) =>
        setDialog((d) => ({ ...d, [field]: e.target.value }));

    const handleSave = async () => {
        setSaving(true);
        setFormError('');
        try {
            await clinicApi.record({
                ...dialog,
                complaint: dialog.complaint.trim(),
                diagnosis: dialog.diagnosis || null,
                treatment: dialog.treatment || null,
            });
            setToast('Visit recorded');
            setDialog(null);
            refresh();
        } catch (err) {
            setFormError(err.message);
        } finally {
            setSaving(false);
        }
    };

    const handleLeave = async (visit, decision) => {
        try {
            await clinicApi.reviewLeave(visit.id, decision);
            setToast(`Leave request ${decision}`);
            refresh();
        } catch (err) {
            setToast(err.message);
        }
    };

    const rows = visits.data || [];

    return (
        <>
            <PageHeader
                title={isNurse ? (admittedView ? 'Admitted' : 'Nurse') : 'Clinic'}
                subtitle={isNurse
                    ? (admittedView ? 'Students admitted to the nurse.' : 'Search a student and admit them for care.')
                    : 'Medical visits and leave approvals.'}
            />

            {canRecord && !admittedView && (
                <Paper variant="outlined" sx={{ p: 2, mb: 2.5 }}>
                    <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} alignItems={{ sm: 'center' }}>
                        <Autocomplete
                            options={students.data || []}
                            value={selectedStudent}
                            onChange={(_, value) => setSelectedStudent(value)}
                            getOptionLabel={(option) => `${option.name} — ${option.class?.name || 'No class'}`}
                            isOptionEqualToValue={(option, value) => option.id === value.id}
                            loading={students.loading}
                            sx={{ minWidth: { sm: 360 }, flexGrow: 1 }}
                            renderInput={(params) => (
                                <TextField {...params} label="Search student" placeholder="Name or class" size="small" />
                            )}
                        />
                        <Button
                            variant="contained" startIcon={<AddIcon />}
                            disabled={!selectedStudent}
                            onClick={() => {
                                setFormError('');
                                setDialog({ ...EMPTY, studentId: selectedStudent.id, studentName: selectedStudent.name, classId: selectedStudent.class?.id || null });
                            }}
                            sx={{ whiteSpace: 'nowrap' }}
                        >
                            Admit student
                        </Button>
                    </Stack>
                    {selectedStudent && (
                        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1 }}>
                            Selected: <strong>{selectedStudent.name}</strong> · {selectedStudent.class?.name || 'No class'}
                        </Typography>
                    )}
                </Paper>
            )}

            {summary.data && (
                <Grid container spacing={2.5} sx={{ mb: 2.5 }}>
                    <Grid item xs={6} md={3}>
                        <Card><CardContent>
                            <Typography variant="body2" color="text.secondary">Total visits</Typography>
                            <Typography variant="h5">{summary.data.totalVisits}</Typography>
                        </CardContent></Card>
                    </Grid>
                    <Grid item xs={6} md={3}>
                        <Card><CardContent>
                            <Typography variant="body2" color="text.secondary">Pending leave</Typography>
                            <Typography
                                variant="h5"
                                color={summary.data.pendingLeaveRequests > 0 ? 'warning.main' : 'text.primary'}
                            >
                                {summary.data.pendingLeaveRequests}
                            </Typography>
                        </CardContent></Card>
                    </Grid>
                </Grid>
            )}

            <DataState
                loading={visits.loading}
                error={visits.error}
                empty={rows.length === 0}
                emptyMessage="No clinic visits recorded."
            >
                <TableContainer component={Paper} variant="outlined">
                    <Table size="small">
                        <TableHead>
                            <TableRow>
                                <TableCell>Date</TableCell>
                                <TableCell>Student</TableCell>
                                <TableCell>Complaint</TableCell>
                                <TableCell>Type</TableCell>
                                <TableCell>Severity</TableCell>
                                <TableCell>Outcome</TableCell>
                                <TableCell align="right">Leave</TableCell>
                            </TableRow>
                        </TableHead>
                        <TableBody>
                            {rows.map((v) => (
                                <TableRow key={v.id} hover>
                                    <TableCell>{new Date(v.visitDate).toLocaleDateString()}</TableCell>
                                    <TableCell sx={{ fontWeight: 500 }}>{v.student?.name}</TableCell>
                                    <TableCell>{v.complaint}</TableCell>
                                    <TableCell>{titleise(v.incidentType)}</TableCell>
                                    <TableCell>
                                        <Chip
                                            size="small" label={titleise(v.severity)}
                                            color={SEVERITY_COLOR[v.severity]}
                                            variant={v.severity === 'minor' ? 'outlined' : 'filled'}
                                        />
                                    </TableCell>
                                    <TableCell>{titleise(v.outcome)}</TableCell>
                                    <TableCell align="right">
                                        {!v.leaveStatus ? (
                                            '—'
                                        ) : v.leaveStatus === 'pending' ? (
                                            isAdmin ? (
                                                <Stack direction="row" spacing={0.5} justifyContent="flex-end">
                                                    <Button size="small" color="success" onClick={() => handleLeave(v, 'approved')}>
                                                        Approve
                                                    </Button>
                                                    <Button size="small" color="error" onClick={() => handleLeave(v, 'rejected')}>
                                                        Reject
                                                    </Button>
                                                </Stack>
                                            ) : (
                                                <Chip size="small" label="Pending" color="warning" />
                                            )
                                        ) : (
                                            <Chip
                                                size="small"
                                                label={titleise(v.leaveStatus)}
                                                color={v.leaveStatus === 'approved' ? 'success' : 'default'}
                                                variant="outlined"
                                            />
                                        )}
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </TableContainer>
            </DataState>

            <Dialog open={Boolean(dialog)} onClose={() => setDialog(null)} maxWidth="sm" fullWidth>
                <DialogTitle>Record clinic visit</DialogTitle>
                <DialogContent>
                    {formError && <Alert severity="error" sx={{ mb: 2 }}>{formError}</Alert>}
                    <Stack spacing={2} sx={{ mt: 1 }}>
                        <Typography variant="body2" color="text.secondary">
                            Student admitted: <strong>{dialog?.studentName}</strong>
                        </Typography>
                        <TextField
                            label="Case / complaint" required fullWidth multiline rows={2}
                            value={dialog?.complaint || ''} onChange={setField('complaint')}
                        />
                        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
                            <TextField select label="Incident type" fullWidth
                                value={dialog?.incidentType || ''} onChange={setField('incidentType')}>
                                {INCIDENT_TYPES.map((t) => (
                                    <MenuItem key={t} value={t}>{titleise(t)}</MenuItem>
                                ))}
                            </TextField>
                            <TextField select label="Severity" fullWidth
                                value={dialog?.severity || ''} onChange={setField('severity')}>
                                {SEVERITIES.map((t) => (
                                    <MenuItem key={t} value={t}>{titleise(t)}</MenuItem>
                                ))}
                            </TextField>
                        </Stack>
                        <TextField label="Diagnosis" fullWidth
                            value={dialog?.diagnosis || ''} onChange={setField('diagnosis')} />
                        <TextField label="Treatment given" fullWidth multiline rows={2}
                            value={dialog?.treatment || ''} onChange={setField('treatment')} />
                        <TextField select label="Outcome" required fullWidth
                            value={dialog?.outcome || ''} onChange={setField('outcome')}>
                            {OUTCOMES.map((t) => (
                                <MenuItem key={t} value={t}>{titleise(t)}</MenuItem>
                            ))}
                        </TextField>
                        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
                            <TextField select label="Parent notified" fullWidth
                                value={dialog?.parentNotified ? 'yes' : 'no'}
                                onChange={(e) => setDialog((d) => ({ ...d, parentNotified: e.target.value === 'yes' }))}>
                                <MenuItem value="no">No</MenuItem>
                                <MenuItem value="yes">Yes</MenuItem>
                            </TextField>
                            <TextField select label="Request leave" fullWidth
                                helperText="Requires admin approval"
                                value={dialog?.requestLeave ? 'yes' : 'no'}
                                onChange={(e) => setDialog((d) => ({ ...d, requestLeave: e.target.value === 'yes' }))}>
                                <MenuItem value="no">No</MenuItem>
                                <MenuItem value="yes">Yes</MenuItem>
                            </TextField>
                        </Stack>
                    </Stack>
                </DialogContent>
                <DialogActions sx={{ px: 3, pb: 2 }}>
                    <Button onClick={() => setDialog(null)}>Cancel</Button>
                    <Button
                        variant="contained" onClick={handleSave}
                        disabled={saving || !dialog?.studentId || !dialog?.complaint?.trim()}
                    >
                        Save
                    </Button>
                </DialogActions>
            </Dialog>

            <Snackbar open={Boolean(toast)} autoHideDuration={4000}
                onClose={() => setToast('')} message={toast}
                anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }} />
        </>
    );
}
