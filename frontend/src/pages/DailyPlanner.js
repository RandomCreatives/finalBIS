import { useEffect, useState } from 'react';
import {
    Alert, Box, Button, Card, CardContent, Checkbox, Chip, IconButton,
    List, ListItem, ListItemButton, ListItemIcon, ListItemText, Stack,
    TextField, Typography,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import TodayIcon from '@mui/icons-material/Today';
import MenuBookIcon from '@mui/icons-material/MenuBook';
import AssignmentIcon from '@mui/icons-material/Assignment';
import ChecklistIcon from '@mui/icons-material/Checklist';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import { timetableApi } from '../api/endpoints';
import useApi from '../hooks/useApi';
import PageHeader from '../components/PageHeader';
import DataState from '../components/DataState';
import { Section } from '../components/DashboardSections';
import { useAuth } from '../auth/AuthContext';

const DAY_LABEL = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

const pad = (n) => String(n).padStart(2, '0');
const now = new Date();
const TODAY_KEY = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
const DOW = ((now.getDay()) + 6) % 7 + 1; // 1=Mon … 5=Fri, 6=Sat, 7=Sun

const DEFAULT_STATE = {
    objectives: {}, // slotId -> { objective, links }
    homework: { due: [], assign: [] },
    duties: { morningIntake: false, lunchDuty: false, hallway: false, dismissal: false, notes: '' },
    todos: { mustDo: [], canWait: [] },
};

const DUTY_ITEMS = [
    { key: 'morningIntake', label: 'Morning intake' },
    { key: 'lunchDuty', label: 'Lunch duty' },
    { key: 'hallway', label: 'Hallway monitoring' },
    { key: 'dismissal', label: 'Dismissal supervision' },
];

const hhmm = (t) => (t ? t.slice(0, 5) : '');

/** Add / check-off / remove list used by Homework and To-Do sections. */
function PlannerList({ items, placeholder, addLabel, onAdd, onToggle, onRemove }) {
    const [text, setText] = useState('');

    const submit = () => {
        const t = text.trim();
        if (!t) return;
        onAdd(t);
        setText('');
    };

    return (
        <Box>
            <Stack direction="row" spacing={1} sx={{ mb: 1 }}>
                <TextField
                    size="small" fullWidth placeholder={placeholder} value={text}
                    onChange={(e) => setText(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); submit(); } }}
                />
                <Button variant="contained" onClick={submit} startIcon={<AddIcon />}>{addLabel || 'Add'}</Button>
            </Stack>

            <List dense disablePadding>
                {items.map((i) => (
                    <ListItem
                        key={i.id}
                        disableGutters
                        secondaryAction={
                            <IconButton edge="end" size="small" aria-label="Remove" onClick={() => onRemove(i.id)}>
                                <DeleteOutlineIcon fontSize="small" />
                            </IconButton>
                        }
                    >
                        <ListItemButton onClick={() => onToggle(i.id)} sx={{ borderRadius: 1 }}>
                            <ListItemIcon sx={{ minWidth: 36 }}>
                                <Checkbox edge="start" checked={i.done} tabIndex={-1} disableRipple />
                            </ListItemIcon>
                            <ListItemText
                                primary={i.text}
                                sx={{
                                    textDecoration: i.done ? 'line-through' : 'none',
                                    color: i.done ? 'text.disabled' : 'inherit',
                                }}
                            />
                        </ListItemButton>
                    </ListItem>
                ))}
                {items.length === 0 && (
                    <Typography variant="caption" color="text.disabled">Nothing listed yet.</Typography>
                )}
            </List>
        </Box>
    );
}

export default function DailyPlanner() {
    const { user } = useAuth();
    const storageKey = `planner:${user?.id}:${TODAY_KEY}`;

    const [state, setState] = useState(() => {
        try {
            const raw = localStorage.getItem(storageKey);
            if (raw) return { ...DEFAULT_STATE, ...JSON.parse(raw) };
        } catch { /* ignore */ }
        return DEFAULT_STATE;
    });

    useEffect(() => {
        try { localStorage.setItem(storageKey, JSON.stringify(state)); } catch { /* ignore */ }
    }, [storageKey, state]);

    const myWeek = useApi(() => timetableApi.myWeek(), []);
    const todaySlots = (myWeek.data || [])
        .filter((s) => s.dayOfWeek === DOW)
        .sort((a, b) => (a.startsAt || '').localeCompare(b.endsAt || ''));

    const setObjective = (slotId, field, value) =>
        setState((s) => ({
            ...s,
            objectives: { ...s.objectives, [slotId]: { ...(s.objectives[slotId] || {}), [field]: value } },
        }));

    const listOp = (group, key) => ({
        add: (text) => setState((s) => ({
            ...s,
            [group]: { ...s[group], [key]: [...s[group][key], { id: crypto.randomUUID(), text, done: false }] },
        })),
        toggle: (id) => setState((s) => ({
            ...s,
            [group]: { ...s[group], [key]: s[group][key].map((i) => (i.id === id ? { ...i, done: !i.done } : i)) },
        })),
        remove: (id) => setState((s) => ({
            ...s,
            [group]: { ...s[group], [key]: s[group][key].filter((i) => i.id !== id) },
        })),
    });

    const setDuty = (name, value) =>
        setState((s) => ({ ...s, duties: { ...s.duties, [name]: value } }));

    return (
        <>
            <PageHeader
                title="Daily Planner"
                subtitle={`${DAY_LABEL[now.getDay()]}, ${TODAY_KEY} — ${user?.name}`}
                action={<Chip icon={<TodayIcon />} label="Saved on this device" variant="outlined" />}
            />

            <Alert severity="info" sx={{ mb: 2.5 }}>
                This planner is saved in your browser for today only. Lesson periods are pulled from
                your timetable; the rest is your free-form working space.
            </Alert>

            {/* --- Core Schedule & Instruction ------------------------------- */}
            <Section title="Lesson Objectives & Links" icon={<MenuBookIcon />} defaultExpanded>
                <DataState
                    loading={myWeek.loading}
                    error={myWeek.error}
                    empty={!myWeek.loading && todaySlots.length === 0}
                    emptyMessage={DOW > 5 ? 'No school days on weekends.' : 'No periods scheduled for you today.'}
                >
                    <Stack spacing={1.5}>
                        {todaySlots.map((slot) => {
                            const obj = state.objectives[slot.id] || {};
                            return (
                                <Card key={slot.id} variant="outlined" sx={{ bgcolor: '#fafbff' }}>
                                    <CardContent sx={{ py: 1.5, '&:last-child': { pb: 1.5 } }}>
                                        <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1 }} flexWrap="wrap" useFlexGap>
                                            <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
                                                {hhmm(slot.startsAt)}–{hhmm(slot.endsAt)}
                                            </Typography>
                                            <Chip size="small" label={slot.subject?.name || 'Untitled'} color="primary" />
                                            {slot.class?.name && (
                                                <Chip size="small" variant="outlined" label={slot.class.name} />
                                            )}
                                            {slot.room && (
                                                <Chip size="small" variant="outlined" label={`Room ${slot.room}`} />
                                            )}
                                        </Stack>

                                        <Stack spacing={1.5} sx={{ mt: 0.5 }}>
                                            <TextField
                                                size="small" label="Lesson objective (1–2 sentences)"
                                                fullWidth multiline minRows={2}
                                                value={obj.objective || ''}
                                                onChange={(e) => setObjective(slot.id, 'objective', e.target.value)}
                                            />
                                            <TextField
                                                size="small" label="Links / materials (slides, printouts, digital)"
                                                fullWidth placeholder="Paste URLs or short references"
                                                value={obj.links || ''}
                                                onChange={(e) => setObjective(slot.id, 'links', e.target.value)}
                                            />
                                        </Stack>
                                    </CardContent>
                                </Card>
                            );
                        })}
                    </Stack>
                </DataState>
            </Section>

            {/* --- Homework & Assignments ------------------------------------ */}
            <Section title="Homework & Assignments" icon={<AssignmentIcon />} defaultExpanded>
                <Stack direction={{ xs: 'column', md: 'row' }} spacing={3} alignItems="flex-start">
                    <Box sx={{ flex: 1, width: '100%' }}>
                        <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 1 }}>
                            Due today
                        </Typography>
                        <PlannerList
                            items={state.homework.due}
                            placeholder="e.g. Math worksheet p. 24"
                            addLabel="Add"
                            {...listOp('homework', 'due')}
                        />
                    </Box>
                    <Box sx={{ flex: 1, width: '100%' }}>
                        <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 1 }}>
                            Assigning for tomorrow
                        </Typography>
                        <PlannerList
                            items={state.homework.assign}
                            placeholder="e.g. Science project brief"
                            addLabel="Add"
                            {...listOp('homework', 'assign')}
                        />
                    </Box>
                </Stack>
            </Section>

            {/* --- Administrative & Classroom Operations -------------------- */}
            <Section title="Duty Tracking" icon={<ChecklistIcon />} defaultExpanded>
                <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap sx={{ mb: 2 }}>
                    {DUTY_ITEMS.map((d) => (
                        <Chip
                            key={d.key}
                            label={d.label}
                            clickable
                            color={state.duties[d.key] ? 'success' : 'default'}
                            variant={state.duties[d.key] ? 'filled' : 'outlined'}
                            onClick={() => setDuty(d.key, !state.duties[d.key])}
                        />
                    ))}
                </Stack>
                <TextField
                    size="small" label="Other duties / notes" fullWidth multiline minRows={2}
                    value={state.duties.notes}
                    onChange={(e) => setDuty('notes', e.target.value)}
                />
            </Section>

            {/* --- Daily To-Do ----------------------------------------------- */}
            <Section title="Daily To-Do List" icon={<CheckCircleIcon />} defaultExpanded>
                <Stack direction={{ xs: 'column', md: 'row' }} spacing={3} alignItems="flex-start">
                    <Box sx={{ flex: 1, width: '100%' }}>
                        <Typography variant="subtitle2" color="error.main" sx={{ mb: 1 }}>
                            Must-Do Today
                        </Typography>
                        <PlannerList
                            items={state.todos.mustDo}
                            placeholder="e.g. Submit grades, printer run"
                            addLabel="Add"
                            {...listOp('todos', 'mustDo')}
                        />
                    </Box>
                    <Box sx={{ flex: 1, width: '100%' }}>
                        <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 1 }}>
                            Can Wait
                        </Typography>
                        <PlannerList
                            items={state.todos.canWait}
                            placeholder="e.g. Long-term unit prep"
                            addLabel="Add"
                            {...listOp('todos', 'canWait')}
                        />
                    </Box>
                </Stack>
            </Section>
        </>
    );
}
