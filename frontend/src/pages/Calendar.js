import { useState } from 'react';
import {
    Alert, Box, Button, Card, CardContent, Chip, Dialog, DialogActions, DialogContent,
    DialogTitle, FormControlLabel, Grid, IconButton, MenuItem, Snackbar, Stack, Switch,
    TextField, Tooltip, Typography,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import DeleteIcon from '@mui/icons-material/Delete';
import EditIcon from '@mui/icons-material/Edit';
import CalendarMonthIcon from '@mui/icons-material/CalendarMonth';
import EventNoteIcon from '@mui/icons-material/EventNote';
import DateRangeIcon from '@mui/icons-material/DateRange';
import { calendarApi, termApi, classApi } from '../api/endpoints';
import useApi from '../hooks/useApi';
import PageHeader from '../components/PageHeader';
import DataState from '../components/DataState';
import { Section, StatGrid, StatCard } from '../components/DashboardSections';
import { useAuth } from '../auth/AuthContext';

const CATEGORIES = [
    { value: 'event', label: 'Event', color: '#3b82f6' },
    { value: 'exam', label: 'Exam', color: '#b91c1c' },
    { value: 'meeting', label: 'Meeting', color: '#7c3aed' },
    { value: 'holiday', label: 'Holiday', color: '#15803d' },
    { value: 'trip', label: 'Trip', color: '#0891b2' },
    { value: 'deadline', label: 'Deadline', color: '#b45309' },
    { value: 'training', label: 'Training', color: '#4f46e5' },
];

const catColor = (c) => CATEGORIES.find((x) => x.value === c)?.color || '#6b7280';
const iso = (d) => d.toISOString().slice(0, 10);

const EMPTY = {
    title: '', description: '', category: 'event', audience: 'all',
    startsOn: iso(new Date()), endsOn: iso(new Date()),
    allDay: true, startsAt: '09:00', endsAt: '10:00', location: '', classId: '',
};

export default function Calendar() {
    const { user, isAdmin } = useAuth();
    const canPost = ['admin', 'main_teacher'].includes(user?.role);

    const [cursor, setCursor] = useState(new Date());
    const [dialog, setDialog] = useState(null);
    const [termDialog, setTermDialog] = useState(null);
    const [saving, setSaving] = useState(false);
    const [formError, setFormError] = useState('');
    const [toast, setToast] = useState('');

    const monthStart = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
    const monthEnd = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0);

    const events = useApi(
        () => calendarApi.list({ from: iso(monthStart), to: iso(monthEnd) }),
        [cursor.getFullYear(), cursor.getMonth()]
    );
    const terms = useApi(() => termApi.list(), []);
    const current = useApi(() => termApi.current(), []);
    const classes = useApi(() => classApi.list(), []);

    const setField = (f) => (e) => {
        const v = e.target.type === 'checkbox' ? e.target.checked : e.target.value;
        setDialog((d) => ({ ...d, [f]: v }));
    };

    const handleSave = async () => {
        setSaving(true);
        setFormError('');
        try {
            const payload = {
                title: dialog.title.trim(),
                description: dialog.description || null,
                category: dialog.category,
                audience: dialog.audience,
                startsOn: dialog.startsOn,
                endsOn: dialog.endsOn || dialog.startsOn,
                allDay: dialog.allDay,
                startsAt: dialog.allDay ? null : dialog.startsAt,
                endsAt: dialog.allDay ? null : dialog.endsAt,
                location: dialog.location || null,
                classId: dialog.classId || null,
            };

            if (dialog.id) {
                await calendarApi.update(dialog.id, payload);
                setToast('Event updated');
            } else {
                await calendarApi.create(payload);
                setToast('Event added');
            }
            setDialog(null);
            events.reload();
        } catch (err) {
            setFormError(err.message);
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async (event) => {
        try {
            await calendarApi.remove(event.id);
            setToast('Event deleted');
            events.reload();
        } catch (err) {
            setToast(err.message);
        }
    };

    const handleSaveTerm = async () => {
        setSaving(true);
        setFormError('');
        try {
            if (termDialog.id) {
                await termApi.update(termDialog.id, {
                    name: termDialog.name.trim(),
                    startsOn: termDialog.startsOn,
                    endsOn: termDialog.endsOn,
                });
                setToast('Term updated');
            } else {
                await termApi.create({
                    name: termDialog.name.trim(),
                    termIndex: Number(termDialog.termIndex),
                    startsOn: termDialog.startsOn,
                    endsOn: termDialog.endsOn,
                });
                setToast('Term created');
            }
            setTermDialog(null);
            terms.reload();
            current.reload();
        } catch (err) {
            setFormError(err.message);
        } finally {
            setSaving(false);
        }
    };

    const makeCurrent = async (term) => {
        try {
            await termApi.setCurrent(term.id);
            setToast(`${term.name} is now the working term`);
            terms.reload();
            current.reload();
        } catch (err) {
            setToast(err.message);
        }
    };

    /** Month grid, Monday-first, with events laid onto their days. */
    const renderMonth = () => {
        const rows = events.data?.events || [];
        const firstWeekday = (monthStart.getDay() + 6) % 7; // Monday = 0
        const daysInMonth = monthEnd.getDate();
        const today = iso(new Date());

        const cells = [
            ...Array.from({ length: firstWeekday }, () => null),
            ...Array.from({ length: daysInMonth }, (_, i) =>
                iso(new Date(cursor.getFullYear(), cursor.getMonth(), i + 1))
            ),
        ];

        return (
            <Box>
                <Grid container spacing={0.5} sx={{ mb: 0.5 }}>
                    {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((d) => (
                        <Grid item xs={12 / 7} key={d}>
                            <Typography variant="caption" color="text.secondary" align="center" display="block">
                                {d}
                            </Typography>
                        </Grid>
                    ))}
                </Grid>

                <Grid container spacing={0.5}>
                    {cells.map((date, i) => {
                        const dayEvents = date
                            ? rows.filter((e) => date >= e.startsOn && date <= e.endsOn)
                            : [];

                        return (
                            <Grid item xs={12 / 7} key={date || `pad-${i}`}>
                                <Box
                                    sx={{
                                        minHeight: 96, p: 0.75, borderRadius: 1,
                                        border: '1px solid',
                                        borderColor: date === today ? 'primary.main' : 'divider',
                                        bgcolor: date ? 'background.paper' : 'transparent',
                                    }}
                                >
                                    {date && (
                                        <>
                                            <Typography
                                                variant="caption"
                                                sx={{ fontWeight: date === today ? 700 : 400 }}
                                                color={date === today ? 'primary.main' : 'text.secondary'}
                                            >
                                                {Number(date.slice(-2))}
                                            </Typography>

                                            <Stack spacing={0.3} sx={{ mt: 0.3 }}>
                                                {dayEvents.slice(0, 3).map((e) => (
                                                    <Tooltip key={e.id} title={`${e.title}${e.location ? ` · ${e.location}` : ''}`}>
                                                        <Box
                                                            sx={{
                                                                px: 0.5, py: 0.15, borderRadius: 0.5,
                                                                bgcolor: catColor(e.category),
                                                                color: 'white', fontSize: 10,
                                                                overflow: 'hidden', textOverflow: 'ellipsis',
                                                                whiteSpace: 'nowrap', cursor: 'default',
                                                            }}
                                                        >
                                                            {e.title}
                                                        </Box>
                                                    </Tooltip>
                                                ))}
                                                {dayEvents.length > 3 && (
                                                    <Typography variant="caption" color="text.secondary" sx={{ fontSize: 9.5 }}>
                                                        +{dayEvents.length - 3} more
                                                    </Typography>
                                                )}
                                            </Stack>
                                        </>
                                    )}
                                </Box>
                            </Grid>
                        );
                    })}
                </Grid>
            </Box>
        );
    };

    return (
        <>
            <PageHeader
                title="Calendar"
                subtitle={
                    current.data?.term
                        ? `${current.data.term.name}${current.data.currentWeek ? ` · week ${current.data.currentWeek} of ${current.data.term.weekCount}` : ''}`
                        : 'Term dates, exams, meetings and events.'
                }
                action={canPost && (
                    <Button
                        variant="contained" startIcon={<AddIcon />}
                        onClick={() => { setFormError(''); setDialog({ ...EMPTY }); }}
                    >
                        Add event
                    </Button>
                )}
            />

            {/* --- Month view -------------------------------------------------- */}
            <Section title="Month" icon={<CalendarMonthIcon />} defaultExpanded>
                <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 2 }}>
                    <Stack direction="row" alignItems="center" spacing={1}>
                        <IconButton
                            onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() - 1, 1))}
                            aria-label="Previous month"
                        >
                            <ChevronLeftIcon />
                        </IconButton>
                        <Typography variant="h6" sx={{ minWidth: 190, textAlign: 'center' }}>
                            {cursor.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}
                        </Typography>
                        <IconButton
                            onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1))}
                            aria-label="Next month"
                        >
                            <ChevronRightIcon />
                        </IconButton>
                    </Stack>
                    <Button size="small" onClick={() => setCursor(new Date())}>Today</Button>
                </Stack>

                <Stack direction="row" spacing={1} sx={{ mb: 2 }} flexWrap="wrap" useFlexGap>
                    {CATEGORIES.map((c) => (
                        <Chip
                            key={c.value} label={c.label} size="small"
                            sx={{ bgcolor: c.color, color: 'white', fontSize: 11, height: 22 }}
                        />
                    ))}
                </Stack>

                <DataState loading={events.loading} error={events.error}>
                    {renderMonth()}
                </DataState>
            </Section>

            {/* --- Upcoming list ----------------------------------------------- */}
            <Section title="Upcoming" icon={<EventNoteIcon />}>
                <DataState
                    loading={events.loading}
                    error={events.error}
                    empty={(events.data?.events || []).length === 0}
                    emptyMessage="Nothing scheduled this month."
                >
                    <Stack spacing={1.5}>
                        {(events.data?.events || []).map((e) => (
                            <Card key={e.id}>
                                <CardContent sx={{ py: 1.5, '&:last-child': { pb: 1.5 } }}>
                                    <Stack direction="row" spacing={2} alignItems="flex-start">
                                        <Box
                                            sx={{
                                                width: 4, alignSelf: 'stretch', borderRadius: 2,
                                                bgcolor: catColor(e.category),
                                            }}
                                        />
                                        <Box sx={{ flexGrow: 1, minWidth: 0 }}>
                                            <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
                                                <Typography variant="body1" sx={{ fontWeight: 600 }}>{e.title}</Typography>
                                                <Chip size="small" label={e.category} variant="outlined" />
                                                {e.class && <Chip size="small" label={e.class.name} variant="outlined" color="primary" />}
                                            </Stack>
                                            <Typography variant="caption" color="text.secondary" display="block">
                                                {e.startsOn === e.endsOn ? e.startsOn : `${e.startsOn} → ${e.endsOn}`}
                                                {!e.allDay && e.startsAt ? ` · ${e.startsAt.slice(0, 5)}–${e.endsAt?.slice(0, 5)}` : ''}
                                                {e.location ? ` · ${e.location}` : ''}
                                            </Typography>
                                            {e.description && (
                                                <Typography variant="body2" sx={{ mt: 0.75 }}>{e.description}</Typography>
                                            )}
                                        </Box>

                                        {canPost && (
                                            <Stack direction="row">
                                                <IconButton
                                                    size="small"
                                                    onClick={() => {
                                                        setFormError('');
                                                        setDialog({
                                                            id: e.id, title: e.title, description: e.description || '',
                                                            category: e.category, audience: e.audience,
                                                            startsOn: e.startsOn, endsOn: e.endsOn,
                                                            allDay: e.allDay,
                                                            startsAt: e.startsAt?.slice(0, 5) || '09:00',
                                                            endsAt: e.endsAt?.slice(0, 5) || '10:00',
                                                            location: e.location || '', classId: e.classId || '',
                                                        });
                                                    }}
                                                >
                                                    <EditIcon fontSize="small" />
                                                </IconButton>
                                                <IconButton size="small" onClick={() => handleDelete(e)}>
                                                    <DeleteIcon fontSize="small" />
                                                </IconButton>
                                            </Stack>
                                        )}
                                    </Stack>
                                </CardContent>
                            </Card>
                        ))}
                    </Stack>
                </DataState>
            </Section>

            {/* --- Terms -------------------------------------------------------- */}
            {isAdmin && (
                <Section
                    title="Terms"
                    icon={<DateRangeIcon />}
                    action={
                        <Button
                            variant="contained" size="small" startIcon={<AddIcon />}
                            onClick={() => {
                                setFormError('');
                                setTermDialog({
                                    name: '', termIndex: (terms.data?.length || 0) + 1,
                                    startsOn: '', endsOn: '',
                                });
                            }}
                        >
                            Add term
                        </Button>
                    }
                >
                    <DataState
                        loading={terms.loading}
                        error={terms.error}
                        empty={(terms.data || []).length === 0}
                        emptyMessage="No terms defined yet. Add three to structure the year."
                    >
                        <StatGrid>
                            <StatCard label="Terms" value={(terms.data || []).length} />
                            <StatCard label="Current term" value={current.data?.term?.name || '—'} color="primary.main" />
                        </StatGrid>

                        <Grid container spacing={2.5}>
                            {(terms.data || []).map((t) => (
                                <Grid item xs={12} sm={6} md={4} key={t.id}>
                                    <Card sx={{ borderLeft: 4, borderLeftColor: t.isCurrent ? 'primary.main' : 'transparent' }}>
                                        <CardContent>
                                            <Stack direction="row" justifyContent="space-between" alignItems="flex-start">
                                                <Box>
                                                    <Typography variant="h6">{t.name}</Typography>
                                                    <Typography variant="caption" color="text.secondary">
                                                        {t.startsOn} → {t.endsOn}
                                                    </Typography>
                                                </Box>
                                                <IconButton
                                                    size="small"
                                                    onClick={() => {
                                                        setFormError('');
                                                        setTermDialog({
                                                            id: t.id, name: t.name, termIndex: t.termIndex,
                                                            startsOn: t.startsOn, endsOn: t.endsOn,
                                                        });
                                                    }}
                                                >
                                                    <EditIcon fontSize="small" />
                                                </IconButton>
                                            </Stack>

                                            <Stack direction="row" spacing={1} alignItems="center" sx={{ mt: 1.5 }}>
                                                <Chip size="small" label={`${t.weekCount} weeks`} variant="outlined" />
                                                {t.isCurrent ? (
                                                    <Chip size="small" label="Current" color="primary" />
                                                ) : (
                                                    <Button size="small" onClick={() => makeCurrent(t)}>
                                                        Make current
                                                    </Button>
                                                )}
                                            </Stack>
                                        </CardContent>
                                    </Card>
                                </Grid>
                            ))}
                        </Grid>
                    </DataState>
                </Section>
            )}

            {/* Event dialog ----------------------------------------------------- */}
            <Dialog open={Boolean(dialog)} onClose={() => setDialog(null)} maxWidth="sm" fullWidth>
                <DialogTitle>{dialog?.id ? 'Edit event' : 'Add event'}</DialogTitle>
                <DialogContent>
                    {formError && <Alert severity="error" sx={{ mb: 2 }}>{formError}</Alert>}
                    {dialog && (
                        <Stack spacing={2} sx={{ mt: 1 }}>
                            <TextField label="Title" required fullWidth autoFocus
                                value={dialog.title} onChange={setField('title')} />

                            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
                                <TextField select label="Category" fullWidth
                                    value={dialog.category} onChange={setField('category')}>
                                    {CATEGORIES.map((c) => (
                                        <MenuItem key={c.value} value={c.value}>{c.label}</MenuItem>
                                    ))}
                                </TextField>
                                <TextField select label="Audience" fullWidth
                                    value={dialog.audience} onChange={setField('audience')}>
                                    <MenuItem value="all">All staff</MenuItem>
                                    <MenuItem value="main_teacher">Main teachers</MenuItem>
                                    <MenuItem value="assistant_teacher">Assistant teachers</MenuItem>
                                    <MenuItem value="subject_teacher">Subject teachers</MenuItem>
                                </TextField>
                            </Stack>

                            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
                                <TextField label="From" type="date" required fullWidth
                                    InputLabelProps={{ shrink: true }}
                                    value={dialog.startsOn} onChange={setField('startsOn')} />
                                <TextField label="To" type="date" fullWidth
                                    InputLabelProps={{ shrink: true }}
                                    value={dialog.endsOn} onChange={setField('endsOn')} />
                            </Stack>

                            <FormControlLabel
                                control={<Switch checked={dialog.allDay} onChange={setField('allDay')} />}
                                label="All day"
                            />

                            {!dialog.allDay && (
                                <Stack direction="row" spacing={2}>
                                    <TextField label="Starts" type="time" fullWidth
                                        InputLabelProps={{ shrink: true }}
                                        value={dialog.startsAt} onChange={setField('startsAt')} />
                                    <TextField label="Ends" type="time" fullWidth
                                        InputLabelProps={{ shrink: true }}
                                        value={dialog.endsAt} onChange={setField('endsAt')} />
                                </Stack>
                            )}

                            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
                                <TextField label="Location" fullWidth
                                    value={dialog.location} onChange={setField('location')} />
                                <TextField select label="Class (optional)" fullWidth
                                    value={dialog.classId} onChange={setField('classId')}
                                    helperText="Leave blank for the whole school">
                                    <MenuItem value="">Whole school</MenuItem>
                                    {(classes.data || []).map((c) => (
                                        <MenuItem key={c.id} value={c.id}>{c.name}</MenuItem>
                                    ))}
                                </TextField>
                            </Stack>

                            <TextField label="Details" fullWidth multiline rows={3}
                                value={dialog.description} onChange={setField('description')} />
                        </Stack>
                    )}
                </DialogContent>
                <DialogActions sx={{ px: 3, pb: 2 }}>
                    <Button onClick={() => setDialog(null)}>Cancel</Button>
                    <Button variant="contained" onClick={handleSave}
                        disabled={saving || !dialog?.title?.trim() || !dialog?.startsOn}>
                        Save
                    </Button>
                </DialogActions>
            </Dialog>

            {/* Term dialog ------------------------------------------------------ */}
            <Dialog open={Boolean(termDialog)} onClose={() => setTermDialog(null)} maxWidth="xs" fullWidth>
                <DialogTitle>{termDialog?.id ? 'Edit term' : 'Add term'}</DialogTitle>
                <DialogContent>
                    {formError && <Alert severity="error" sx={{ mb: 2 }}>{formError}</Alert>}
                    {termDialog && (
                        <Stack spacing={2} sx={{ mt: 1 }}>
                            <TextField label="Name" required fullWidth autoFocus
                                placeholder="e.g. Term 1"
                                value={termDialog.name}
                                onChange={(e) => setTermDialog((d) => ({ ...d, name: e.target.value }))} />
                            {!termDialog.id && (
                                <TextField label="Term number" type="number" required fullWidth
                                    value={termDialog.termIndex}
                                    onChange={(e) => setTermDialog((d) => ({ ...d, termIndex: e.target.value }))} />
                            )}
                            <TextField label="Starts" type="date" required fullWidth
                                InputLabelProps={{ shrink: true }}
                                value={termDialog.startsOn}
                                onChange={(e) => setTermDialog((d) => ({ ...d, startsOn: e.target.value }))} />
                            <TextField label="Ends" type="date" required fullWidth
                                InputLabelProps={{ shrink: true }}
                                value={termDialog.endsOn}
                                onChange={(e) => setTermDialog((d) => ({ ...d, endsOn: e.target.value }))} />
                            <Typography variant="caption" color="text.secondary">
                                Teaching weeks are worked out from these dates, so a term can be any length.
                            </Typography>
                        </Stack>
                    )}
                </DialogContent>
                <DialogActions sx={{ px: 3, pb: 2 }}>
                    <Button onClick={() => setTermDialog(null)}>Cancel</Button>
                    <Button variant="contained" onClick={handleSaveTerm}
                        disabled={saving || !termDialog?.name?.trim() || !termDialog?.startsOn || !termDialog?.endsOn}>
                        Save
                    </Button>
                </DialogActions>
            </Dialog>

            <Snackbar open={Boolean(toast)} autoHideDuration={3000}
                onClose={() => setToast('')} message={toast}
                anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }} />
        </>
    );
}
