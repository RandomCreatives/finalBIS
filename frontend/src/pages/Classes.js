import { useState } from 'react';
import { Link as RouterLink } from 'react-router-dom';
import {
    Alert, Box, Button, Card, CardContent, Chip, Dialog, DialogActions, DialogContent,
    DialogTitle, Grid, IconButton, Snackbar, Stack, TextField, Tooltip, Typography,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import GroupsIcon from '@mui/icons-material/Groups';
import { classApi } from '../api/endpoints';
import useApi from '../hooks/useApi';
import PageHeader from '../components/PageHeader';
import DataState from '../components/DataState';
import { useAuth } from '../auth/AuthContext';

export default function Classes() {
    const { isAdmin } = useAuth();
    const [dialog, setDialog] = useState(null);
    const [confirm, setConfirm] = useState(null);
    const [saving, setSaving] = useState(false);
    const [formError, setFormError] = useState('');
    const [toast, setToast] = useState('');

    const classes = useApi(() => classApi.list(), []);

    const handleSave = async () => {
        setSaving(true);
        setFormError('');
        try {
            const payload = {
                name: dialog.name.trim(),
                yearLevel: dialog.yearLevel === '' ? null : Number(dialog.yearLevel),
                capacity: dialog.capacity === '' ? null : Number(dialog.capacity),
            };
            if (dialog.id) {
                await classApi.update(dialog.id, payload);
                setToast('Class updated');
            } else {
                await classApi.create(payload);
                setToast('Class created');
            }
            setDialog(null);
            classes.reload();
        } catch (err) {
            setFormError(err.message);
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async () => {
        setSaving(true);
        try {
            await classApi.remove(confirm.id);
            setToast('Class deleted');
            setConfirm(null);
            classes.reload();
        } catch (err) {
            setConfirm((c) => ({ ...c, error: err.message }));
        } finally {
            setSaving(false);
        }
    };

    const rows = classes.data || [];

    return (
        <>
            <PageHeader
                title="Classes"
                subtitle="Homeroom groups and their teaching staff."
                action={isAdmin && (
                    <Button
                        variant="contained" startIcon={<AddIcon />}
                        onClick={() => {
                            setFormError('');
                            setDialog({ name: '', yearLevel: '', capacity: '' });
                        }}
                    >
                        Add class
                    </Button>
                )}
            />

            <DataState
                loading={classes.loading}
                error={classes.error}
                empty={rows.length === 0}
                emptyMessage="No classes have been created yet."
            >
                <Grid container spacing={2.5}>
                    {rows.map((c) => (
                        <Grid item xs={12} sm={6} md={4} key={c.id}>
                            <Card sx={{ height: '100%' }}>
                                <CardContent>
                                    <Stack direction="row" justifyContent="space-between" alignItems="flex-start">
                                        <Box>
                                            <Typography variant="h6">{c.name}</Typography>
                                            <Stack direction="row" spacing={0.75} alignItems="center" sx={{ mt: 0.5 }}>
                                                <GroupsIcon fontSize="small" color="disabled" />
                                                <Typography variant="body2" color="text.secondary">
                                                    {c.studentCount ?? 0} student{c.studentCount === 1 ? '' : 's'}
                                                    {c.capacity ? ` / ${c.capacity}` : ''}
                                                </Typography>
                                            </Stack>
                                        </Box>

                                        {isAdmin && (
                                            <Stack direction="row">
                                                <Tooltip title="Edit">
                                                    <IconButton
                                                        size="small"
                                                        onClick={() => {
                                                            setFormError('');
                                                            setDialog({
                                                                id: c.id, name: c.name,
                                                                yearLevel: c.yearLevel ?? '',
                                                                capacity: c.capacity ?? '',
                                                            });
                                                        }}
                                                    >
                                                        <EditIcon fontSize="small" />
                                                    </IconButton>
                                                </Tooltip>
                                                <Tooltip title="Delete">
                                                    <IconButton size="small" onClick={() => setConfirm(c)}>
                                                        <DeleteIcon fontSize="small" />
                                                    </IconButton>
                                                </Tooltip>
                                            </Stack>
                                        )}
                                    </Stack>

                                    <Stack spacing={0.75} sx={{ mt: 2 }}>
                                        <Stack direction="row" spacing={1} alignItems="center">
                                            <Chip size="small" label="Main" color="primary" sx={{ minWidth: 68 }} />
                                            <Typography variant="body2">
                                                {c.mainTeacher?.name || (
                                                    <Box component="em" sx={{ color: 'warning.main' }}>unassigned</Box>
                                                )}
                                            </Typography>
                                        </Stack>
                                        <Stack direction="row" spacing={1} alignItems="center">
                                            <Chip size="small" label="Assistant" variant="outlined" sx={{ minWidth: 68 }} />
                                            <Typography variant="body2">
                                                {c.assistantTeacher?.name || (
                                                    <Box component="em" sx={{ color: 'text.disabled' }}>unassigned</Box>
                                                )}
                                            </Typography>
                                        </Stack>
                                    </Stack>

                                    {isAdmin && (
                                        <Button
                                            size="small" sx={{ mt: 1.5 }}
                                            component={RouterLink} to="/app/assignments"
                                        >
                                            Manage staffing
                                        </Button>
                                    )}
                                </CardContent>
                            </Card>
                        </Grid>
                    ))}
                </Grid>
            </DataState>

            <Dialog open={Boolean(dialog)} onClose={() => setDialog(null)} maxWidth="xs" fullWidth>
                <DialogTitle>{dialog?.id ? 'Edit class' : 'Add class'}</DialogTitle>
                <DialogContent>
                    {formError && <Alert severity="error" sx={{ mb: 2 }}>{formError}</Alert>}
                    <Stack spacing={2} sx={{ mt: 1 }}>
                        <TextField
                            label="Class name" required fullWidth autoFocus
                            placeholder="e.g. Year 3A"
                            value={dialog?.name || ''}
                            onChange={(e) => setDialog((d) => ({ ...d, name: e.target.value }))}
                        />
                        <Stack direction="row" spacing={2}>
                            <TextField
                                label="Year level" type="number" fullWidth
                                value={dialog?.yearLevel ?? ''}
                                onChange={(e) => setDialog((d) => ({ ...d, yearLevel: e.target.value }))}
                            />
                            <TextField
                                label="Capacity" type="number" fullWidth
                                value={dialog?.capacity ?? ''}
                                onChange={(e) => setDialog((d) => ({ ...d, capacity: e.target.value }))}
                            />
                        </Stack>
                        <Typography variant="caption" color="text.secondary">
                            Teachers are assigned on the Assignments page.
                        </Typography>
                    </Stack>
                </DialogContent>
                <DialogActions sx={{ px: 3, pb: 2 }}>
                    <Button onClick={() => setDialog(null)}>Cancel</Button>
                    <Button variant="contained" onClick={handleSave} disabled={saving || !dialog?.name?.trim()}>
                        Save
                    </Button>
                </DialogActions>
            </Dialog>

            <Dialog open={Boolean(confirm)} onClose={() => setConfirm(null)} maxWidth="xs" fullWidth>
                <DialogTitle>Delete {confirm?.name}?</DialogTitle>
                <DialogContent>
                    {confirm?.error && <Alert severity="error" sx={{ mb: 2 }}>{confirm.error}</Alert>}
                    <Typography variant="body2" color="text.secondary">
                        A class can only be deleted once no students are enrolled in it.
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
