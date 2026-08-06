import { useState } from 'react';
import {
    Alert, Box, Button, Card, CardContent, Checkbox, Chip, Dialog, DialogActions,
    DialogContent, DialogTitle, IconButton, MenuItem, Snackbar, Stack, Tab, Tabs,
    TextField, Tooltip, Typography,
} from '@mui/material';
import AddTaskIcon from '@mui/icons-material/AddTask';
import DeleteIcon from '@mui/icons-material/Delete';
import { taskApi, userApi, classApi, studentApi } from '../api/endpoints';
import useApi from '../hooks/useApi';
import PageHeader from '../components/PageHeader';
import DataState from '../components/DataState';
import { useAuth } from '../auth/AuthContext';

const PRIORITY_COLOR = { high: 'error', normal: 'default', low: 'info' };

const EMPTY = {
    title: '', description: '', assignedTo: '', dueOn: '',
    priority: 'normal', classId: '', studentId: '',
};

export default function Tasks() {
    const { user, isAdmin } = useAuth();
    const canAssign = ['admin', 'main_teacher'].includes(user?.role);

    const [tab, setTab] = useState(0);
    const [dialog, setDialog] = useState(null);
    const [saving, setSaving] = useState(false);
    const [formError, setFormError] = useState('');
    const [toast, setToast] = useState('');

    // 0 = mine, 1 = everything I can see, 2 = completed
    const params = [{ mine: 'true' }, {}, { status: 'done' }][tab];
    const tasks = useApi(() => taskApi.list(params), [tab]);

    const staff = useApi(() => (canAssign && isAdmin ? userApi.list() : Promise.resolve([])), [canAssign, isAdmin]);
    const classes = useApi(() => classApi.list(), []);
    const students = useApi(() => studentApi.list(), []);

    const setField = (f) => (e) => setDialog((d) => ({ ...d, [f]: e.target.value }));

    const handleCreate = async () => {
        setSaving(true);
        setFormError('');
        try {
            await taskApi.create({
                title: dialog.title.trim(),
                description: dialog.description || null,
                assignedTo: dialog.assignedTo,
                dueOn: dialog.dueOn || null,
                priority: dialog.priority,
                classId: dialog.classId || null,
                studentId: dialog.studentId || null,
            });
            setToast('Task assigned');
            setDialog(null);
            tasks.reload();
        } catch (err) {
            setFormError(err.message);
        } finally {
            setSaving(false);
        }
    };

    const toggleDone = async (task) => {
        try {
            await taskApi.update(task.id, { status: task.status === 'done' ? 'pending' : 'done' });
            tasks.reload();
        } catch (err) {
            setToast(err.message);
        }
    };

    const advance = async (task, status) => {
        try {
            await taskApi.update(task.id, { status });
            tasks.reload();
        } catch (err) {
            setToast(err.message);
        }
    };

    const remove = async (task) => {
        try {
            await taskApi.remove(task.id);
            setToast('Task deleted');
            tasks.reload();
        } catch (err) {
            setToast(err.message);
        }
    };

    const rows = tasks.data || [];
    const overdueCount = rows.filter((t) => t.isOverdue).length;

    return (
        <>
            <PageHeader
                title="Tasks"
                subtitle="Action items between the office and teaching staff."
                action={canAssign && (
                    <Button
                        variant="contained" startIcon={<AddTaskIcon />}
                        onClick={() => { setFormError(''); setDialog({ ...EMPTY }); }}
                    >
                        Assign task
                    </Button>
                )}
            />

            {overdueCount > 0 && (
                <Alert severity="warning" sx={{ mb: 2 }}>
                    {overdueCount} task{overdueCount === 1 ? ' is' : 's are'} past their due date.
                </Alert>
            )}

            <Card sx={{ mb: 2.5 }}>
                <Tabs value={tab} onChange={(_, v) => setTab(v)}>
                    <Tab label="Assigned to me" />
                    <Tab label="All" />
                    <Tab label="Completed" />
                </Tabs>
            </Card>

            <DataState
                loading={tasks.loading}
                error={tasks.error}
                empty={rows.length === 0}
                emptyMessage="Nothing here."
            >
                <Stack spacing={1.5}>
                    {rows.map((t) => {
                        const done = t.status === 'done';
                        const isAssignee = t.assignee?.id === user?.id;
                        const canDelete = isAdmin || t.assigner?.id === user?.id;

                        return (
                            <Card key={t.id} sx={{ borderLeft: 4, borderLeftColor: t.isOverdue ? 'error.main' : 'transparent' }}>
                                <CardContent sx={{ py: 1.5, '&:last-child': { pb: 1.5 } }}>
                                    <Stack direction="row" spacing={1.5} alignItems="flex-start">
                                        <Checkbox
                                            checked={done}
                                            onChange={() => toggleDone(t)}
                                            disabled={!isAssignee && !canDelete}
                                            sx={{ mt: -0.5 }}
                                        />

                                        <Box sx={{ flexGrow: 1, minWidth: 0 }}>
                                            <Typography
                                                variant="body1"
                                                sx={{
                                                    fontWeight: 500,
                                                    textDecoration: done ? 'line-through' : 'none',
                                                    color: done ? 'text.disabled' : 'text.primary',
                                                }}
                                            >
                                                {t.title}
                                            </Typography>

                                            {t.description && (
                                                <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                                                    {t.description}
                                                </Typography>
                                            )}

                                            <Stack direction="row" spacing={1} sx={{ mt: 1 }} flexWrap="wrap" useFlexGap>
                                                {t.dueOn && (
                                                    <Chip
                                                        size="small"
                                                        label={`Due ${t.dueOn}`}
                                                        color={t.isOverdue ? 'error' : 'default'}
                                                        variant={t.isOverdue ? 'filled' : 'outlined'}
                                                    />
                                                )}
                                                <Chip
                                                    size="small" label={t.priority}
                                                    color={PRIORITY_COLOR[t.priority]} variant="outlined"
                                                />
                                                {t.status === 'in_progress' && (
                                                    <Chip size="small" label="In progress" color="info" />
                                                )}
                                                {t.class && <Chip size="small" label={t.class.name} variant="outlined" />}
                                                {t.student && <Chip size="small" label={t.student.name} variant="outlined" />}
                                            </Stack>

                                            <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 1 }}>
                                                {isAssignee ? 'Assigned to you' : `For ${t.assignee?.name}`}
                                                {t.assigner ? ` · by ${t.assigner.name}` : ''}
                                            </Typography>
                                        </Box>

                                        <Stack direction="row" spacing={0.5}>
                                            {isAssignee && t.status === 'pending' && (
                                                <Button size="small" onClick={() => advance(t, 'in_progress')}>
                                                    Start
                                                </Button>
                                            )}
                                            {canDelete && (
                                                <Tooltip title="Delete">
                                                    <IconButton size="small" onClick={() => remove(t)}>
                                                        <DeleteIcon fontSize="small" />
                                                    </IconButton>
                                                </Tooltip>
                                            )}
                                        </Stack>
                                    </Stack>
                                </CardContent>
                            </Card>
                        );
                    })}
                </Stack>
            </DataState>

            <Dialog open={Boolean(dialog)} onClose={() => setDialog(null)} maxWidth="sm" fullWidth>
                <DialogTitle>Assign a task</DialogTitle>
                <DialogContent>
                    {formError && <Alert severity="error" sx={{ mb: 2 }}>{formError}</Alert>}
                    <Stack spacing={2} sx={{ mt: 1 }}>
                        <TextField label="Title" required fullWidth autoFocus
                            value={dialog?.title || ''} onChange={setField('title')} />
                        <TextField label="Details" fullWidth multiline rows={3}
                            value={dialog?.description || ''} onChange={setField('description')} />
                        <TextField select label="Assign to" required fullWidth
                            value={dialog?.assignedTo || ''} onChange={setField('assignedTo')}>
                            {(staff.data || []).map((s) => (
                                <MenuItem key={s.id} value={s.id}>
                                    {s.name} — {s.role.replace(/_/g, ' ')}
                                </MenuItem>
                            ))}
                        </TextField>
                        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
                            <TextField
                                label="Due date" type="date" fullWidth
                                InputLabelProps={{ shrink: true }}
                                value={dialog?.dueOn || ''} onChange={setField('dueOn')}
                            />
                            <TextField select label="Priority" fullWidth
                                value={dialog?.priority || 'normal'} onChange={setField('priority')}>
                                <MenuItem value="low">Low</MenuItem>
                                <MenuItem value="normal">Normal</MenuItem>
                                <MenuItem value="high">High</MenuItem>
                            </TextField>
                        </Stack>
                        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
                            <TextField select label="Class (optional)" fullWidth
                                value={dialog?.classId || ''} onChange={setField('classId')}>
                                <MenuItem value="">None</MenuItem>
                                {(classes.data || []).map((c) => (
                                    <MenuItem key={c.id} value={c.id}>{c.name}</MenuItem>
                                ))}
                            </TextField>
                            <TextField select label="Student (optional)" fullWidth
                                value={dialog?.studentId || ''} onChange={setField('studentId')}>
                                <MenuItem value="">None</MenuItem>
                                {(students.data || []).map((s) => (
                                    <MenuItem key={s.id} value={s.id}>{s.name}</MenuItem>
                                ))}
                            </TextField>
                        </Stack>
                    </Stack>
                </DialogContent>
                <DialogActions sx={{ px: 3, pb: 2 }}>
                    <Button onClick={() => setDialog(null)}>Cancel</Button>
                    <Button
                        variant="contained" onClick={handleCreate}
                        disabled={saving || !dialog?.title?.trim() || !dialog?.assignedTo}
                    >
                        Assign
                    </Button>
                </DialogActions>
            </Dialog>

            <Snackbar open={Boolean(toast)} autoHideDuration={3000}
                onClose={() => setToast('')} message={toast}
                anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }} />
        </>
    );
}
