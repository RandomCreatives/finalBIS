import { useEffect, useMemo, useState } from 'react';
import { Link as RouterLink } from 'react-router-dom';
import {
    Alert, Box, Button, Checkbox, Chip, Container, Dialog, Divider, FormControlLabel,
    IconButton, MenuItem, Paper, Snackbar, TextField, Tooltip, Typography, useTheme,
} from '@mui/material';
import { alpha } from '@mui/material/styles';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import LightModeIcon from '@mui/icons-material/LightMode';
import DarkModeIcon from '@mui/icons-material/DarkMode';
import SchoolIcon from '@mui/icons-material/School';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import RestartAltIcon from '@mui/icons-material/RestartAlt';
import CloseIcon from '@mui/icons-material/Close';
import EventBusyIcon from '@mui/icons-material/EventBusy';
import HelpOutlineIcon from '@mui/icons-material/HelpOutline';
import { useColorScheme } from '../theme';
import {
    CATEGORIES, SEED_EVENTS, TERM_SPANS, CALENDAR_MONTHS, CALENDAR_STORE_KEY,
} from '../data/academicCalendar';

/*
 * Public academic calendar 2026/27 — seeded from the approved calendar PDF,
 * editable by everyone (demo-stage persistence in the browser, with a
 * one-click reset back to the approved version).
 */

const toStr = (y, m, d) => `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
const todayStr = () => {
    const n = new Date();
    return toStr(n.getFullYear(), n.getMonth(), n.getDate());
};
const coversDay = (e, day) => e.date <= day && (e.endDate || e.date) >= day;
const rgba = (hex, a) => {
    const n = parseInt(hex.slice(1), 16);
    return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
};
const fmtDay = (d) => new Date(`${d}T00:00:00Z`)
    .toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' });
const fmtLong = (d) => new Date(`${d}T00:00:00Z`)
    .toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });

const monthCells = (year, month) => {
    const firstDow = (new Date(Date.UTC(year, month, 1)).getUTCDay() + 6) % 7; // Monday-first
    const daysInMonth = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
    const cells = [];
    for (let i = 0; i < firstDow; i += 1) cells.push(null);
    for (let d = 1; d <= daysInMonth; d += 1) cells.push(toStr(year, month, d));
    while (cells.length % 7 !== 0) cells.push(null);
    return cells;
};

const termForDay = (day) => TERM_SPANS.find((t) => day >= t.startsOn && day <= t.endsOn) ?? null;

const EMPTY_FORM = { title: '', date: '', endDate: '', category: 'milestone', note: '', closed: false, tentative: false };

/* ── event form (add/edit) ────────────────────────────────── */

function EventForm({ initial, onSave, onCancel }) {
    const [form, setForm] = useState(initial);
    const [error, setError] = useState('');

    const set = (key) => (value) => setForm((f) => ({ ...f, [key]: value }));

    const submit = (e) => {
        e.preventDefault();
        if (!form.title.trim()) { setError('Give the event a title.'); return; }
        if (!form.date) { setError('Pick a date.'); return; }
        if (form.endDate && form.endDate < form.date) { setError('The end date is before the start date.'); return; }
        onSave({ ...form, title: form.title.trim(), note: form.note.trim() });
    };

    return (
        <Box component="form" onSubmit={submit}>
            <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1.5 }}>
                <Box sx={{ gridColumn: 'span 2' }}>
                    <TextField label="Event title" size="small" fullWidth value={form.title}
                        onChange={(e) => { set('title')(e.target.value); setError(''); }}
                        sx={{ '& .MuiInputBase-input': { fontSize: 13 } }} />
                </Box>
                <TextField label="Date" type="date" size="small" value={form.date}
                    onChange={(e) => { set('date')(e.target.value); setError(''); }}
                    InputLabelProps={{ shrink: true }}
                    sx={{ '& .MuiInputBase-input': { fontSize: 13 } }} />
                <TextField label="End date (ranges)" type="date" size="small" value={form.endDate}
                    onChange={(e) => { set('endDate')(e.target.value); setError(''); }}
                    InputLabelProps={{ shrink: true }}
                    sx={{ '& .MuiInputBase-input': { fontSize: 13 } }} />
                <Box sx={{ gridColumn: 'span 2' }}>
                    <TextField select label="Category" size="small" fullWidth value={form.category}
                        onChange={(e) => set('category')(e.target.value)}
                        sx={{ '& .MuiInputBase-input': { fontSize: 13 } }}>
                        {Object.entries(CATEGORIES).map(([key, c]) => (
                            <MenuItem key={key} value={key}>
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                    <Box sx={{ width: 10, height: 10, borderRadius: '50%', bgcolor: c.color }} />
                                    {c.label}
                                </Box>
                            </MenuItem>
                        ))}
                    </TextField>
                </Box>
                <Box sx={{ gridColumn: 'span 2' }}>
                    <TextField label="Note (optional)" size="small" fullWidth value={form.note}
                        onChange={(e) => set('note')(e.target.value)}
                        sx={{ '& .MuiInputBase-input': { fontSize: 13 } }} />
                </Box>
                <FormControlLabel sx={{ '& .MuiFormControlLabel-label': { fontSize: 13 } }}
                    control={<Checkbox size="small" checked={form.closed} onChange={(e) => set('closed')(e.target.checked)} />}
                    label="School closed" />
                <FormControlLabel sx={{ '& .MuiFormControlLabel-label': { fontSize: 13 } }}
                    control={<Checkbox size="small" checked={form.tentative} onChange={(e) => set('tentative')(e.target.checked)} />}
                    label="Tentative" />
            </Box>
            {error && <Typography sx={{ fontSize: 12, color: 'error.main', mt: 1 }}>{error}</Typography>}
            <Box sx={{ display: 'flex', gap: 1, mt: 2 }}>
                <Button type="submit" size="small" variant="contained" disableElevation
                    sx={{ fontWeight: 700, textTransform: 'none', borderRadius: 1 }}>
                    Save event
                </Button>
                <Button size="small" onClick={onCancel}
                    sx={{ fontWeight: 700, textTransform: 'none', color: 'text.secondary' }}>
                    Cancel
                </Button>
            </Box>
        </Box>
    );
}

/* ── single event row (inside the day popup) ──────────────── */

function EventRow({ event, onEdit, onDelete }) {
    const cat = CATEGORIES[event.category] || CATEGORIES.milestone;
    return (
        <Box sx={{ p: 1.75, borderRadius: 1.25, border: '1px solid', borderColor: 'divider', mb: 1.25 }}>
            <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1.25 }}>
                <Box sx={{ width: 4, alignSelf: 'stretch', borderRadius: 2, bgcolor: cat.color, flexShrink: 0 }} />
                <Box sx={{ minWidth: 0, flexGrow: 1 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: .75, flexWrap: 'wrap' }}>
                        <Chip label={cat.label} size="small"
                            sx={{ height: 18, fontSize: 10, fontWeight: 800, borderRadius: .75,
                                bgcolor: rgba(cat.color, 0.12), color: cat.color }} />
                        {event.closed && (
                            <Chip icon={<EventBusyIcon sx={{ fontSize: '12px !important' }} />} label="School closed" size="small"
                                sx={{ height: 18, fontSize: 10, fontWeight: 700, borderRadius: .75,
                                    bgcolor: 'rgba(220,38,38,.1)', color: '#dc2626' }} />
                        )}
                        {event.tentative && (
                            <Chip icon={<HelpOutlineIcon sx={{ fontSize: '12px !important' }} />} label="Tentative" size="small"
                                sx={{ height: 18, fontSize: 10, fontWeight: 700, borderRadius: .75,
                                    bgcolor: 'rgba(100,116,139,.12)', color: 'text.secondary' }} />
                        )}
                    </Box>
                    <Typography sx={{ fontWeight: 700, fontSize: 14, mt: .5 }}>{event.title}</Typography>
                    <Typography sx={{ fontSize: 12, color: 'text.secondary' }}>
                        {fmtDay(event.date)}{event.endDate && event.endDate !== event.date ? ` → ${fmtDay(event.endDate)}` : ''}
                    </Typography>
                    {event.note && (
                        <Typography sx={{ fontSize: 12, color: 'text.secondary', mt: .35 }}>{event.note}</Typography>
                    )}
                </Box>
                <Box sx={{ display: 'flex', gap: .25, flexShrink: 0 }}>
                    <Tooltip title="Edit">
                        <IconButton size="small" onClick={onEdit}><EditIcon sx={{ fontSize: 16 }} /></IconButton>
                    </Tooltip>
                    <Tooltip title="Delete">
                        <IconButton size="small" onClick={onDelete}><DeleteOutlineIcon sx={{ fontSize: 16 }} /></IconButton>
                    </Tooltip>
                </Box>
            </Box>
        </Box>
    );
}

/* ── page ─────────────────────────────────────────────────── */

export default function PublicCalendar() {
    const theme = useTheme();
    const dark = theme.palette.mode === 'dark';
    const { toggleColorScheme } = useColorScheme();
    const surface = dark ? theme.palette.background.paper : '#ffffff';
    const border = dark ? theme.palette.divider : '#e2e8f0';

    const [events, setEvents] = useState(() => {
        try {
            const saved = JSON.parse(localStorage.getItem(CALENDAR_STORE_KEY));
            return Array.isArray(saved?.events) && saved.events.length > 0 ? saved.events : SEED_EVENTS;
        } catch { return SEED_EVENTS; }
    });
    const today = todayStr();
    const [monthIdx, setMonthIdx] = useState(() => {
        const ym = today.slice(0, 7);
        const idx = CALENDAR_MONTHS.findIndex(({ year, month }) => `${year}-${String(month + 1).padStart(2, '0')}` === ym);
        return idx >= 0 ? idx : 0;
    });
    const [dialogDay, setDialogDay] = useState(null);
    const [adding, setAdding] = useState(false);
    const [editingId, setEditingId] = useState(null);
    const [addDefault, setAddDefault] = useState(null);
    const [toast, setToast] = useState('');

    useEffect(() => {
        localStorage.setItem(CALENDAR_STORE_KEY, JSON.stringify({ events }));
    }, [events]);

    const { year, month } = CALENDAR_MONTHS[monthIdx];
    const cells = useMemo(() => monthCells(year, month), [year, month]);
    const monthLabel = new Date(Date.UTC(year, month, 1))
        .toLocaleDateString('en-GB', { month: 'long', year: 'numeric', timeZone: 'UTC' });

    const eventsOnDay = (day) => events.filter((e) => coversDay(e, day));

    const upcoming = useMemo(() => events
        .filter((e) => (e.endDate || e.date) >= today)
        .sort((a, b) => (a.date.localeCompare(b.date)) || a.title.localeCompare(b.title))
        .slice(0, 10), [events, today]);

    /* ── actions ── */

    const persist = (next) => setEvents(next);

    const saveEvent = (form) => {
        if (editingId) {
            persist(events.map((e) => (e.id === editingId ? { ...e, ...form } : e)));
            setToast('Event updated');
        } else {
            persist([...events, { ...form, id: `evt-${Date.now()}` }]);
            setToast('Event added');
        }
        setEditingId(null);
        setAdding(false);
    };

    const deleteEvent = (id) => {
        persist(events.filter((e) => e.id !== id));
        setToast('Event removed');
    };

    const resetCalendar = () => {
        // eslint-disable-next-line no-alert
        if (window.confirm('Reset the calendar to the approved 2026/27 version? Your edits will be cleared.')) {
            persist(SEED_EVENTS);
            setToast('Calendar reset to the approved version');
        }
    };

    const openAdd = (date) => {
        setEditingId(null);
        setAddDefault(date);
        setAdding(true);
        if (date) setDialogDay(date);
    };

    const closeDialog = () => {
        setDialogDay(null);
        setAdding(false);
        setEditingId(null);
    };

    /* ── render ── */

    return (
        <Box sx={{ minHeight: '100vh', display: 'flex', flexDirection: 'column',
            bgcolor: 'background.default', color: 'text.primary' }}>
            {/* ── header ── */}
            <Box component="header" sx={{ position: 'sticky', top: 0, zIndex: 100,
                borderBottom: `1px solid ${border}`, bgcolor: alpha(surface, 0.9),
                backdropFilter: 'blur(12px)' }}>
                <Container maxWidth="xl">
                    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                        minHeight: 68, gap: 2 }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                            <Button component={RouterLink} to="/" size="small"
                                startIcon={<ArrowBackIcon />}
                                sx={{ fontWeight: 700, borderRadius: 1, textTransform: 'none',
                                    color: 'text.secondary', '&:hover': { color: 'primary.main' } }}>
                                Back
                            </Button>
                            <Box sx={{ width: 1, height: 26, bgcolor: border }} />
                            <Box sx={{ width: 38, height: 38, borderRadius: 1, bgcolor: 'primary.main',
                                color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                <SchoolIcon />
                            </Box>
                            <Box>
                                <Typography sx={{ fontWeight: 800, fontSize: 16, lineHeight: 1.1 }}>
                                    BIS NOC Gerji
                                </Typography>
                                <Typography sx={{ fontSize: 11, fontWeight: 600, color: 'text.secondary',
                                    letterSpacing: .5 }}>
                                    British International School
                                </Typography>
                            </Box>
                        </Box>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                            <Box onClick={toggleColorScheme} sx={{ display: 'flex', alignItems: 'center',
                                justifyContent: 'center', width: 38, height: 38, borderRadius: 1,
                                border: `1px solid ${border}`, cursor: 'pointer', color: 'text.secondary',
                                '&:hover': { color: 'primary.main', borderColor: 'primary.main' } }}
                                aria-label="Toggle theme">
                                {dark ? <LightModeIcon sx={{ fontSize: 18 }} /> : <DarkModeIcon sx={{ fontSize: 18 }} />}
                            </Box>
                        </Box>
                    </Box>
                </Container>
            </Box>

            {/* ── content ── */}
            <Container maxWidth="xl" sx={{ py: { xs: 5, md: 7 } }}>
                <Box sx={{ mb: 4 }}>
                    <Typography variant="h3" sx={{ fontWeight: 800, letterSpacing: '-.02em' }}>
                        Academic Calendar 2026/27
                    </Typography>
                    <Typography sx={{ mt: 1.5, color: 'text.secondary', maxWidth: 680 }}>
                        The approved school year at a glance — terms, holidays, assessments, conferences and
                        payments. Everyone can add, edit or remove events; reset any time to the approved version.
                    </Typography>
                    <Box sx={{ display: 'flex', gap: .75, mt: 2, flexWrap: 'wrap' }}>
                        {Object.entries(CATEGORIES).map(([key, c]) => (
                            <Chip key={key} size="small" label={c.label}
                                sx={{ fontWeight: 700, borderRadius: 1, height: 22, fontSize: 11.5,
                                    bgcolor: rgba(c.color, 0.1), color: c.color }} />
                        ))}
                    </Box>
                </Box>

                <Box sx={{ display: 'flex', gap: 3, flexDirection: { xs: 'column', lg: 'row' },
                    alignItems: 'flex-start' }}>
                    {/* ── month grid ── */}
                    <Box sx={{ flexGrow: 1, minWidth: 0, width: '100%' }}>
                        {/* toolbar */}
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2, flexWrap: 'wrap' }}>
                            <IconButton size="small" disabled={monthIdx === 0}
                                onClick={() => setMonthIdx((i) => Math.max(0, i - 1))}
                                sx={{ border: `1px solid ${border}`, borderRadius: 1 }}>
                                <ChevronLeftIcon fontSize="small" />
                            </IconButton>
                            <Typography sx={{ fontWeight: 800, fontSize: 17, minWidth: 165, textAlign: 'center' }}>
                                {monthLabel}
                            </Typography>
                            <IconButton size="small" disabled={monthIdx === CALENDAR_MONTHS.length - 1}
                                onClick={() => setMonthIdx((i) => Math.min(CALENDAR_MONTHS.length - 1, i + 1))}
                                sx={{ border: `1px solid ${border}`, borderRadius: 1 }}>
                                <ChevronRightIcon fontSize="small" />
                            </IconButton>
                            <Button size="small" onClick={() => {
                                const idx = CALENDAR_MONTHS.findIndex(({ year: y, month: m }) =>
                                    `${y}-${String(m + 1).padStart(2, '0')}` === today.slice(0, 7));
                                if (idx >= 0) setMonthIdx(idx);
                            }} sx={{ fontWeight: 700, textTransform: 'none', color: 'text.secondary' }}>
                                Today
                            </Button>
                            <Box sx={{ ml: 'auto', display: 'flex', gap: 1 }}>
                                <Button size="small" startIcon={<RestartAltIcon sx={{ fontSize: 15 }} />}
                                    onClick={resetCalendar}
                                    sx={{ fontWeight: 700, textTransform: 'none', color: 'text.secondary' }}>
                                    Reset to approved
                                </Button>
                                <Button size="small" variant="contained" disableElevation
                                    startIcon={<AddIcon sx={{ fontSize: 16 }} />}
                                    onClick={() => openAdd(today)}
                                    sx={{ fontWeight: 700, textTransform: 'none', borderRadius: 1 }}>
                                    Add event
                                </Button>
                            </Box>
                        </Box>

                        {/* weekday header */}
                        <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: .75, mb: .75 }}>
                            {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((d) => (
                                <Typography key={d} sx={{ fontSize: 11, fontWeight: 800, color: 'text.secondary',
                                    textTransform: 'uppercase', letterSpacing: .6, textAlign: 'center' }}>
                                    {d}
                                </Typography>
                            ))}
                        </Box>

                        {/* cells */}
                        <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: .75 }}>
                            {cells.map((day, i) => {
                                if (!day) return <Box key={`b-${i}`} sx={{ minHeight: { xs: 56, md: 96 } }} />;
                                const evts = eventsOnDay(day);
                                const term = termForDay(day);
                                const isToday = day === today;
                                return (
                                    <Paper key={day} variant="outlined" onClick={() => setDialogDay(day)}
                                        sx={{ minHeight: { xs: 56, md: 96 }, p: .75, borderRadius: 1, cursor: 'pointer',
                                            bgcolor: term ? rgba(term.color, dark ? 0.1 : 0.05) : surface,
                                            borderColor: isToday ? 'primary.main' : border,
                                            borderWidth: isToday ? 2 : 1,
                                            transition: 'border-color .15s, transform .15s',
                                            '&:hover': { borderColor: 'primary.main', transform: 'translateY(-1px)' } }}>
                                        <Box sx={{ display: 'flex', alignItems: 'center', gap: .5 }}>
                                            <Typography sx={{ fontSize: 12, fontWeight: isToday ? 800 : 700,
                                                color: isToday ? 'primary.main' : 'text.secondary' }}>
                                                {Number(day.slice(8))}
                                            </Typography>
                                            {isToday && (
                                                <Chip label="Today" size="small" sx={{ height: 14, fontSize: 8.5,
                                                    fontWeight: 800, bgcolor: 'primary.main', color: '#fff' }} />
                                            )}
                                        </Box>
                                        <Box sx={{ display: 'flex', flexDirection: 'column', gap: .35, mt: .4, overflow: 'hidden' }}>
                                            {evts.slice(0, 2).map((e) => {
                                                const cat = CATEGORIES[e.category] || CATEGORIES.milestone;
                                                return (
                                                    <Box key={`${day}-${e.id}`} sx={{ display: 'flex', alignItems: 'center',
                                                        gap: .5, minWidth: 0 }}>
                                                        <Box sx={{ width: 6, height: 6, borderRadius: '50%',
                                                            bgcolor: cat.color, flexShrink: 0 }} />
                                                        <Typography sx={{ fontSize: 10, fontWeight: 600, lineHeight: 1.2,
                                                            whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                                            {e.title}
                                                        </Typography>
                                                    </Box>
                                                );
                                            })}
                                            {evts.length > 2 && (
                                                <Typography sx={{ fontSize: 9.5, fontWeight: 700, color: 'text.secondary' }}>
                                                    +{evts.length - 2} more
                                                </Typography>
                                            )}
                                        </Box>
                                    </Paper>
                                );
                            })}
                        </Box>

                        {/* term legend */}
                        <Box sx={{ display: 'flex', gap: 1, mt: 2, flexWrap: 'wrap' }}>
                            {TERM_SPANS.map((t) => (
                                <Chip key={t.name} size="small"
                                    label={`${t.name}: ${fmtDay(t.startsOn)} → ${fmtDay(t.endsOn)}`}
                                    sx={{ fontWeight: 700, borderRadius: 1, height: 24, fontSize: 11,
                                        bgcolor: rgba(t.color, 0.1), color: t.color }} />
                            ))}
                        </Box>
                    </Box>

                    {/* ── upcoming events ── */}
                    <Paper variant="outlined" sx={{ borderRadius: 1.5, p: 2.25, flexShrink: 0,
                        width: { lg: 320 }, maxWidth: '100%' }}>
                        <Typography sx={{ fontWeight: 800, fontSize: 15, mb: 1.75 }}>Upcoming</Typography>
                        {upcoming.length === 0 ? (
                            <Alert severity="info" sx={{ borderRadius: 1.25 }}>No upcoming events.</Alert>
                        ) : upcoming.map((e) => {
                            const cat = CATEGORIES[e.category] || CATEGORIES.milestone;
                            return (
                                <Box key={e.id} onClick={() => setDialogDay(e.date)}
                                    sx={{ display: 'flex', gap: 1.25, py: 1.1, cursor: 'pointer',
                                        borderBottom: `1px solid ${border}`,
                                        '&:last-of-type': { borderBottom: 'none' },
                                        '&:hover .ev-title': { color: 'primary.main' } }}>
                                    <Box sx={{ width: 44, flexShrink: 0, textAlign: 'center', borderRadius: 1,
                                        py: .5, bgcolor: rgba(cat.color, 0.08), alignSelf: 'flex-start' }}>
                                        <Typography sx={{ fontSize: 16, fontWeight: 800, lineHeight: 1.1, color: cat.color }}>
                                            {Number(e.date.slice(8))}
                                        </Typography>
                                        <Typography sx={{ fontSize: 9.5, fontWeight: 700, color: cat.color,
                                            textTransform: 'uppercase' }}>
                                            {new Date(`${e.date}T00:00:00Z`).toLocaleDateString('en-GB', { month: 'short', timeZone: 'UTC' })}
                                        </Typography>
                                    </Box>
                                    <Box sx={{ minWidth: 0 }}>
                                        <Typography className="ev-title" sx={{ fontSize: 13, fontWeight: 700,
                                            lineHeight: 1.25, transition: 'color .15s' }}>
                                            {e.title}
                                        </Typography>
                                        <Box sx={{ display: 'flex', gap: .5, mt: .4, flexWrap: 'wrap', alignItems: 'center' }}>
                                            <Typography sx={{ fontSize: 10.5, fontWeight: 700, color: cat.color,
                                                textTransform: 'uppercase', letterSpacing: .4 }}>
                                                {cat.label}
                                            </Typography>
                                            {e.closed && (
                                                <Typography sx={{ fontSize: 10.5, fontWeight: 700, color: '#dc2626' }}>
                                                    · School closed
                                                </Typography>
                                            )}
                                            {e.tentative && (
                                                <Typography sx={{ fontSize: 10.5, fontWeight: 700, color: 'text.secondary' }}>
                                                    · Tentative
                                                </Typography>
                                            )}
                                        </Box>
                                    </Box>
                                </Box>
                            );
                        })}
                    </Paper>
                </Box>
            </Container>

            {/* ── day popup ── */}
            <Dialog open={Boolean(dialogDay)} onClose={closeDialog} maxWidth="sm" fullWidth
                PaperProps={{ sx: { borderRadius: 2, p: .5 } }}>
                {dialogDay && (
                    <Box sx={{ p: 2.5 }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: .5, flexWrap: 'wrap' }}>
                            <Typography sx={{ fontWeight: 800, fontSize: 17 }}>{fmtLong(dialogDay)}</Typography>
                            {termForDay(dialogDay) && (
                                <Chip size="small" label={termForDay(dialogDay).name}
                                    sx={{ fontWeight: 700, borderRadius: 1, height: 22, fontSize: 11,
                                        bgcolor: rgba(termForDay(dialogDay).color, 0.1),
                                        color: termForDay(dialogDay).color }} />
                            )}
                            <IconButton size="small" onClick={closeDialog} sx={{ ml: 'auto' }} aria-label="Close">
                                <CloseIcon sx={{ fontSize: 18 }} />
                            </IconButton>
                        </Box>

                        {!adding && !editingId && (
                            <>
                                <Divider sx={{ mb: 1.5 }} />
                                {eventsOnDay(dialogDay).length === 0 ? (
                                    <Alert severity="info" sx={{ borderRadius: 1.25, mb: 1.5 }}>
                                        Nothing scheduled on this day.
                                    </Alert>
                                ) : eventsOnDay(dialogDay).map((e) => (
                                    <EventRow key={e.id} event={e}
                                        onEdit={() => { setEditingId(e.id); setAdding(false); }}
                                        onDelete={() => deleteEvent(e.id)} />
                                ))}
                                <Button size="small" variant="outlined" startIcon={<AddIcon sx={{ fontSize: 15 }} />}
                                    onClick={() => { setAdding(true); setEditingId(null); }}
                                    sx={{ fontWeight: 700, textTransform: 'none', borderRadius: 1 }}>
                                    Add event on this day
                                </Button>
                            </>
                        )}

                        {(adding || editingId) && (
                            <Box sx={{ mt: 1 }}>
                                <EventForm
                                    initial={editingId
                                        ? (() => {
                                            const e = events.find((x) => x.id === editingId);
                                            return { ...EMPTY_FORM, ...e };
                                        })()
                                        : { ...EMPTY_FORM, date: addDefault || dialogDay }}
                                    onSave={saveEvent}
                                    onCancel={() => { setAdding(false); setEditingId(null); }}
                                />
                            </Box>
                        )}
                    </Box>
                )}
            </Dialog>

            <Snackbar open={Boolean(toast)} autoHideDuration={3000}
                onClose={() => setToast('')} message={toast} />

            {/* ── footer ── */}
            <Box sx={{ py: 4, borderTop: `1px solid ${border}`, bgcolor: surface, mt: 'auto' }}>
                <Container maxWidth="xl">
                    <Typography sx={{ fontSize: 12, color: 'text.secondary', textAlign: 'center' }}>
                        &copy; {new Date().getFullYear()} British International School, Gerji Primary II
                        &nbsp;·&nbsp; Academic Calendar 2026/27 (Approved)
                    </Typography>
                </Container>
            </Box>
        </Box>
    );
}
