import { useState } from 'react';
import {
    Alert, Box, Button, Card, CardContent, Chip, Dialog, DialogActions, DialogContent,
    DialogTitle, Divider, IconButton, List, ListItem, ListItemText, MenuItem, Paper,
    Snackbar, Stack, Tab, Tabs, TextField, Tooltip, Typography,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';
import GroupsIcon from '@mui/icons-material/Groups';
import { timetableApi, classApi, assignmentApi } from '../api/endpoints';
import useApi from '../hooks/useApi';
import PageHeader from '../components/PageHeader';
import DataState from '../components/DataState';
import { useAuth } from '../auth/AuthContext';

const DAYS = [
    { value: 1, label: 'Monday', short: 'Mon' },
    { value: 2, label: 'Tuesday', short: 'Tue' },
    { value: 3, label: 'Wednesday', short: 'Wed' },
    { value: 4, label: 'Thursday', short: 'Thu' },
    { value: 5, label: 'Friday', short: 'Fri' },
];

const hhmm = (t) => (t ? t.slice(0, 5) : '');

/** Colour a period by who delivers it, so the grid reads at a glance. */
const periodTint = (slot) =>
    slot.subject?.taughtBy === 'main_teacher' ? '#eef2ff' : '#ecfdf5';

export default function Timetable() {
    const { user, isAdmin } = useAuth();

    const [tab, setTab] = useState(0);
    const [classId, setClassId] = useState('');
    const [dialog, setDialog] = useState(null);
    const [saving, setSaving] = useState(false);
    const [formError, setFormError] = useState('');
    const [toast, setToast] = useState('');

    const classes = useApi(() => classApi.list(), []);

    // Tab 0 = my own week, tab 1 = a class grid, tab 2 = who attends a class.
    const myWeek = useApi(() => (tab === 0 ? timetableApi.myWeek() : Promise.resolve([])), [tab]);
    const classGrid = useApi(
        () => (tab === 1 && classId ? timetableApi.get({ classId }) : Promise.resolve([])),
        [tab, classId]
    );
    const roster = useApi(
        () => (tab === 2 && classId ? timetableApi.roster(classId) : Promise.resolve(null)),
        [tab, classId]
    );
    const assignments = useApi(
        () => (isAdmin && classId ? assignmentApi.subjects({ classId }) : Promise.resolve(null)),
        [isAdmin, classId]
    );

    const handleAdd = async () => {
        setSaving(true);
        setFormError('');
        try {
            await timetableApi.create({
                classSubjectId: dialog.classSubjectId,
                dayOfWeek: Number(dialog.dayOfWeek),
                startsAt: dialog.startsAt,
                endsAt: dialog.endsAt,
                room: dialog.room || null,
            });
            setToast('Period added');
            setDialog(null);
            classGrid.reload();
        } catch (err) {
            setFormError(err.message);
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async (slot) => {
        try {
            await timetableApi.remove(slot.id);
            setToast('Period removed');
            classGrid.reload();
        } catch (err) {
            setToast(err.message);
        }
    };

    /** Renders a Mon–Fri grid from a flat slot list. */
    const renderGrid = (slots, { editable = false } = {}) => {
        if (slots.length === 0) {
            return (
                <Alert severity="info">
                    No periods scheduled{tab === 1 ? ' for this class' : ''} yet.
                </Alert>
            );
        }

        return (
            <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} alignItems="stretch">
                {DAYS.map((day) => {
                    const daySlots = slots
                        .filter((s) => s.dayOfWeek === day.value)
                        .sort((a, b) => a.startsAt.localeCompare(b.startsAt));

                    return (
                        <Paper key={day.value} variant="outlined" sx={{ flex: 1, p: 1.5, minWidth: 0 }}>
                            <Typography
                                variant="subtitle2"
                                sx={{ mb: 1.5, textAlign: 'center', color: 'text.secondary' }}
                            >
                                {day.label}
                            </Typography>

                            <Stack spacing={1}>
                                {daySlots.length === 0 && (
                                    <Typography variant="caption" color="text.disabled" textAlign="center">
                                        —
                                    </Typography>
                                )}

                                {daySlots.map((slot) => (
                                    <Box
                                        key={slot.id}
                                        sx={{
                                            p: 1, borderRadius: 1.5,
                                            bgcolor: periodTint(slot),
                                            border: '1px solid', borderColor: 'divider',
                                            position: 'relative',
                                        }}
                                    >
                                        <Typography variant="caption" color="text.secondary">
                                            {hhmm(slot.startsAt)}–{hhmm(slot.endsAt)}
                                        </Typography>
                                        <Typography variant="body2" sx={{ fontWeight: 600, lineHeight: 1.3 }}>
                                            {slot.subject?.name}
                                        </Typography>
                                        <Typography variant="caption" display="block" color="text.secondary">
                                            {tab === 0 ? slot.class?.name : slot.teacher?.name || 'Unassigned'}
                                        </Typography>
                                        {slot.room && (
                                            <Typography variant="caption" color="text.disabled">
                                                {slot.room}
                                            </Typography>
                                        )}

                                        {editable && (
                                            <IconButton
                                                size="small"
                                                onClick={() => handleDelete(slot)}
                                                sx={{ position: 'absolute', top: 2, right: 2, p: 0.25 }}
                                            >
                                                <DeleteIcon sx={{ fontSize: 15 }} />
                                            </IconButton>
                                        )}
                                    </Box>
                                ))}
                            </Stack>
                        </Paper>
                    );
                })}
            </Stack>
        );
    };

    const isSubjectTeacher = user?.role === 'subject_teacher';

    return (
        <>
            <PageHeader
                title="Timetable"
                subtitle={
                    isSubjectTeacher
                        ? 'Your weekly teaching schedule.'
                        : 'Weekly schedules and who attends each class.'
                }
                action={isAdmin && tab === 1 && classId && (
                    <Button
                        variant="contained" startIcon={<AddIcon />}
                        onClick={() => {
                            setFormError('');
                            setDialog({
                                classSubjectId: '', dayOfWeek: 1,
                                startsAt: '09:00', endsAt: '09:45', room: '',
                            });
                        }}
                    >
                        Add period
                    </Button>
                )}
            />

            <Card sx={{ mb: 2.5 }}>
                <Tabs value={tab} onChange={(_, v) => setTab(v)} variant="scrollable" allowScrollButtonsMobile>
                    <Tab label="My week" />
                    {/* Subject teachers get only their own lessons, so the class
                        grid would just repeat "My week" for them. */}
                    {!isSubjectTeacher && <Tab label="Class schedule" />}
                    {!isSubjectTeacher && <Tab label="Who attends" />}
                </Tabs>
            </Card>

            {tab > 0 && (
                <Card sx={{ p: 2, mb: 2.5 }}>
                    <TextField
                        select label="Class" size="small" sx={{ minWidth: 220 }}
                        value={classId} onChange={(e) => setClassId(e.target.value)}
                    >
                        {(classes.data || []).map((c) => (
                            <MenuItem key={c.id} value={c.id}>{c.name}</MenuItem>
                        ))}
                    </TextField>
                </Card>
            )}

            {/* --- My week ---------------------------------------------------- */}
            {tab === 0 && (
                <DataState loading={myWeek.loading} error={myWeek.error}>
                    <>
                        <Stack direction="row" spacing={2} sx={{ mb: 2 }} flexWrap="wrap" useFlexGap>
                            <Chip size="small" label="Main-teacher subject" sx={{ bgcolor: '#eef2ff' }} />
                            <Chip size="small" label="Subject-teacher subject" sx={{ bgcolor: '#ecfdf5' }} />
                        </Stack>
                        {renderGrid(myWeek.data || [])}
                    </>
                </DataState>
            )}

            {/* --- Class schedule --------------------------------------------- */}
            {tab === 1 && (
                !classId ? (
                    <Alert severity="info">Choose a class to view its weekly schedule.</Alert>
                ) : (
                    <DataState loading={classGrid.loading} error={classGrid.error}>
                        {renderGrid(classGrid.data || [], { editable: isAdmin })}
                    </DataState>
                )
            )}

            {/* --- Who attends ------------------------------------------------ */}
            {tab === 2 && (
                !classId ? (
                    <Alert severity="info">Choose a class to see everyone attached to it.</Alert>
                ) : (
                    <DataState loading={roster.loading} error={roster.error}>
                        {roster.data && (
                            <Stack direction={{ xs: 'column', md: 'row' }} spacing={2.5} alignItems="flex-start">
                                <Card sx={{ flex: 1, width: '100%' }}>
                                    <CardContent>
                                        <Typography variant="h6" gutterBottom>Teaching staff</Typography>

                                        <Stack spacing={1} sx={{ mb: 2 }}>
                                            <Stack direction="row" spacing={1} alignItems="center">
                                                <Chip size="small" label="Main" color="primary" sx={{ minWidth: 70 }} />
                                                <Typography variant="body2">
                                                    {roster.data.mainTeacher?.name || <em>unassigned</em>}
                                                </Typography>
                                            </Stack>
                                            <Stack direction="row" spacing={1} alignItems="center">
                                                <Chip size="small" label="Assistant" variant="outlined" sx={{ minWidth: 70 }} />
                                                <Typography variant="body2">
                                                    {roster.data.assistantTeacher?.name || <em>unassigned</em>}
                                                </Typography>
                                            </Stack>
                                        </Stack>

                                        <Divider sx={{ my: 1.5 }} />
                                        <Typography variant="caption" color="text.secondary">
                                            Subjects taught into this class
                                        </Typography>

                                        <List dense disablePadding sx={{ mt: 0.5 }}>
                                            {roster.data.teachingStaff.map((t) => (
                                                <ListItem key={t.assignmentId} disableGutters divider>
                                                    <ListItemText
                                                        primary={t.subject?.name}
                                                        secondary={t.teacher?.name || 'Unassigned'}
                                                    />
                                                    <Chip
                                                        size="small"
                                                        variant="outlined"
                                                        label={`${t.sessionsPerWeek}/wk`}
                                                    />
                                                </ListItem>
                                            ))}
                                        </List>

                                        <Typography variant="caption" color="text.secondary" sx={{ mt: 2, display: 'block' }}>
                                            {roster.data.scheduledPeriods} periods scheduled this week
                                        </Typography>
                                    </CardContent>
                                </Card>

                                <Card sx={{ flex: 1, width: '100%' }}>
                                    <CardContent>
                                        <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1 }}>
                                            <GroupsIcon fontSize="small" color="disabled" />
                                            <Typography variant="h6">
                                                Students ({roster.data.studentCount}
                                                {roster.data.class.capacity ? ` / ${roster.data.class.capacity}` : ''})
                                            </Typography>
                                        </Stack>

                                        {roster.data.students.length === 0 ? (
                                            <Typography variant="body2" color="text.secondary">
                                                No students enrolled.
                                            </Typography>
                                        ) : (
                                            <List dense disablePadding>
                                                {roster.data.students.map((s) => (
                                                    <ListItem key={s.id} disableGutters divider>
                                                        <ListItemText
                                                            primary={s.name}
                                                            secondary={s.admissionNo}
                                                        />
                                                        {s.specialNeeds && (
                                                            <Tooltip title="Special educational needs">
                                                                <Chip label="SEN" size="small" color="secondary" />
                                                            </Tooltip>
                                                        )}
                                                    </ListItem>
                                                ))}
                                            </List>
                                        )}
                                    </CardContent>
                                </Card>
                            </Stack>
                        )}
                    </DataState>
                )
            )}

            {/* Add period ------------------------------------------------------ */}
            <Dialog open={Boolean(dialog)} onClose={() => setDialog(null)} maxWidth="xs" fullWidth>
                <DialogTitle>Add a period</DialogTitle>
                <DialogContent>
                    {formError && <Alert severity="error" sx={{ mb: 2 }}>{formError}</Alert>}
                    <Stack spacing={2} sx={{ mt: 1 }}>
                        <TextField
                            select label="Subject" required fullWidth
                            value={dialog?.classSubjectId || ''}
                            onChange={(e) => setDialog((d) => ({ ...d, classSubjectId: e.target.value }))}
                            helperText={
                                (assignments.data?.assignments || []).length === 0
                                    ? 'Assign subjects to this class first, under Assignments.'
                                    : undefined
                            }
                        >
                            {(assignments.data?.assignments || []).map((a) => (
                                <MenuItem key={a.id} value={a.id}>
                                    {a.subject?.name} — {a.teacher?.name || 'unassigned'}
                                </MenuItem>
                            ))}
                        </TextField>

                        <TextField
                            select label="Day" required fullWidth
                            value={dialog?.dayOfWeek || 1}
                            onChange={(e) => setDialog((d) => ({ ...d, dayOfWeek: e.target.value }))}
                        >
                            {DAYS.map((d) => (
                                <MenuItem key={d.value} value={d.value}>{d.label}</MenuItem>
                            ))}
                        </TextField>

                        <Stack direction="row" spacing={2}>
                            <TextField
                                label="Starts" type="time" required fullWidth
                                InputLabelProps={{ shrink: true }}
                                value={dialog?.startsAt || ''}
                                onChange={(e) => setDialog((d) => ({ ...d, startsAt: e.target.value }))}
                            />
                            <TextField
                                label="Ends" type="time" required fullWidth
                                InputLabelProps={{ shrink: true }}
                                value={dialog?.endsAt || ''}
                                onChange={(e) => setDialog((d) => ({ ...d, endsAt: e.target.value }))}
                            />
                        </Stack>

                        <TextField
                            label="Room (optional)" fullWidth
                            value={dialog?.room || ''}
                            onChange={(e) => setDialog((d) => ({ ...d, room: e.target.value }))}
                        />

                        <Typography variant="caption" color="text.secondary">
                            Clashes are rejected automatically — a class cannot sit two lessons at
                            once, and a teacher cannot be in two rooms at once.
                        </Typography>
                    </Stack>
                </DialogContent>
                <DialogActions sx={{ px: 3, pb: 2 }}>
                    <Button onClick={() => setDialog(null)}>Cancel</Button>
                    <Button
                        variant="contained" onClick={handleAdd}
                        disabled={saving || !dialog?.classSubjectId || !dialog?.startsAt || !dialog?.endsAt}
                    >
                        Add
                    </Button>
                </DialogActions>
            </Dialog>

            <Snackbar open={Boolean(toast)} autoHideDuration={4000}
                onClose={() => setToast('')} message={toast}
                anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }} />
        </>
    );
}
