import { useState } from 'react';
import {
    Alert, Button, Chip, Dialog, DialogActions, DialogContent, DialogTitle, IconButton,
    Paper, Snackbar, Stack, Table, TableBody, TableCell, TableContainer, TableHead,
    TableRow, TextField, Tooltip, Typography,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import { subjectApi } from '../api/endpoints';
import useApi from '../hooks/useApi';
import PageHeader from '../components/PageHeader';
import DataState from '../components/DataState';
import { useAuth } from '../auth/AuthContext';

/**
 * The school's subject catalogue. "English" is one entry here; which classes
 * take it and who teaches each is set on the Assignments page.
 */
export default function Subjects() {
    const { isAdmin } = useAuth();
    const [dialog, setDialog] = useState(null);
    const [confirm, setConfirm] = useState(null);
    const [saving, setSaving] = useState(false);
    const [formError, setFormError] = useState('');
    const [toast, setToast] = useState('');

    const subjects = useApi(() => subjectApi.list(), []);

    const handleSave = async () => {
        setSaving(true);
        setFormError('');
        try {
            const payload = { name: dialog.name.trim(), code: dialog.code.trim() };
            if (dialog.id) {
                await subjectApi.update(dialog.id, payload);
                setToast('Subject updated');
            } else {
                await subjectApi.create(payload);
                setToast('Subject added');
            }
            setDialog(null);
            subjects.reload();
        } catch (err) {
            setFormError(err.message);
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async () => {
        setSaving(true);
        try {
            await subjectApi.remove(confirm.id);
            setToast('Subject deleted');
            setConfirm(null);
            subjects.reload();
        } catch (err) {
            setConfirm((c) => ({ ...c, error: err.message }));
        } finally {
            setSaving(false);
        }
    };

    const rows = subjects.data || [];

    return (
        <>
            <PageHeader
                title="Subjects"
                subtitle="The school's subject catalogue. Assign teachers under Assignments."
                action={isAdmin && (
                    <Button
                        variant="contained" startIcon={<AddIcon />}
                        onClick={() => { setFormError(''); setDialog({ name: '', code: '' }); }}
                    >
                        Add subject
                    </Button>
                )}
            />

            <DataState
                loading={subjects.loading}
                error={subjects.error}
                empty={rows.length === 0}
                emptyMessage="No subjects yet. Add English, Amharic, Maths and so on, then assign teachers."
            >
                <TableContainer component={Paper} variant="outlined">
                    <Table size="small">
                        <TableHead>
                            <TableRow>
                                <TableCell>Code</TableCell>
                                <TableCell>Subject</TableCell>
                                <TableCell align="right">Classes taking it</TableCell>
                                {isAdmin && <TableCell align="right">Actions</TableCell>}
                            </TableRow>
                        </TableHead>
                        <TableBody>
                            {rows.map((s) => (
                                <TableRow key={s.id} hover>
                                    <TableCell>{s.code}</TableCell>
                                    <TableCell sx={{ fontWeight: 500 }}>{s.name}</TableCell>
                                    <TableCell align="right">
                                        <Chip
                                            size="small"
                                            label={s.classCount ?? 0}
                                            variant="outlined"
                                            color={s.classCount ? 'default' : 'warning'}
                                        />
                                    </TableCell>
                                    {isAdmin && (
                                        <TableCell align="right">
                                            <Tooltip title="Edit">
                                                <IconButton
                                                    size="small"
                                                    onClick={() => {
                                                        setFormError('');
                                                        setDialog({ id: s.id, name: s.name, code: s.code });
                                                    }}
                                                >
                                                    <EditIcon fontSize="small" />
                                                </IconButton>
                                            </Tooltip>
                                            <Tooltip title="Delete">
                                                <IconButton size="small" onClick={() => setConfirm(s)}>
                                                    <DeleteIcon fontSize="small" />
                                                </IconButton>
                                            </Tooltip>
                                        </TableCell>
                                    )}
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </TableContainer>
            </DataState>

            <Dialog open={Boolean(dialog)} onClose={() => setDialog(null)} maxWidth="xs" fullWidth>
                <DialogTitle>{dialog?.id ? 'Edit subject' : 'Add subject'}</DialogTitle>
                <DialogContent>
                    {formError && <Alert severity="error" sx={{ mb: 2 }}>{formError}</Alert>}
                    <Stack spacing={2} sx={{ mt: 1 }}>
                        <TextField
                            label="Subject name" required fullWidth autoFocus
                            placeholder="e.g. English"
                            value={dialog?.name || ''}
                            onChange={(e) => setDialog((d) => ({ ...d, name: e.target.value }))}
                        />
                        <TextField
                            label="Subject code" required fullWidth
                            placeholder="e.g. ENG"
                            value={dialog?.code || ''}
                            onChange={(e) => setDialog((d) => ({ ...d, code: e.target.value }))}
                        />
                    </Stack>
                </DialogContent>
                <DialogActions sx={{ px: 3, pb: 2 }}>
                    <Button onClick={() => setDialog(null)}>Cancel</Button>
                    <Button
                        variant="contained" onClick={handleSave}
                        disabled={saving || !dialog?.name?.trim() || !dialog?.code?.trim()}
                    >
                        Save
                    </Button>
                </DialogActions>
            </Dialog>

            <Dialog open={Boolean(confirm)} onClose={() => setConfirm(null)} maxWidth="xs" fullWidth>
                <DialogTitle>Delete {confirm?.name}?</DialogTitle>
                <DialogContent>
                    {confirm?.error && <Alert severity="error" sx={{ mb: 2 }}>{confirm.error}</Alert>}
                    <Typography variant="body2" color="text.secondary">
                        Its teaching assignments and recorded marks will be removed too.
                    </Typography>
                </DialogContent>
                <DialogActions sx={{ px: 3, pb: 2 }}>
                    <Button onClick={() => setConfirm(null)}>Cancel</Button>
                    <Button color="error" variant="contained" onClick={handleDelete} disabled={saving}>
                        Delete
                    </Button>
                </DialogActions>
            </Dialog>

            <Snackbar open={Boolean(toast)} autoHideDuration={3000}
                onClose={() => setToast('')} message={toast}
                anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }} />
        </>
    );
}
