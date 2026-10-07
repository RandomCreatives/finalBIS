import { useEffect, useState } from 'react';
import {
    Alert, Box, Button, Chip, MenuItem, Paper, Stack, Table, TableBody,
    TableCell, TableContainer, TableRow, TextField, Typography,
} from '@mui/material';
import SaveIcon from '@mui/icons-material/Save';
import SendIcon from '@mui/icons-material/Send';
import CancelIcon from '@mui/icons-material/Cancel';
import useApi from '../../hooks/useApi';
import { planningApi } from '../../api/endpoints';

const SCHEME_FIELDS = [
    ['topic', 'Unit / Topic'],
    ['objectives', 'Lesson Objectives'],
    ['resources', 'Resources'],
    ['assessment', 'Assessment'],
    ['evaluation', 'Remark / Evaluation'],
];

const PLAN_FIELDS = [
    ['topic', 'Topic'],
    ['objectives', 'Learning objectives'],
    ['successCriteria', 'Success criteria'],
    ['starter', 'Starter'],
    ['introduction', 'Introduction'],
    ['development', 'Development'],
    ['plenary', 'Plenary'],
    ['senPlanning', 'Planning for SEN'],
    ['activities', 'Activities / practical assessment'],
    ['resources', 'Resources'],
    ['homework', 'Homework'],
    ['reflection', 'Reflection / evaluation'],
];

const blankPlan = (currentWeek) => ({
    classSubjectId: '',
    weekNumber: currentWeek || 1,
    ...Object.fromEntries(PLAN_FIELDS.map(([field]) => [field, ''])),
});

const assignmentOptions = (assignments = []) => assignments.filter((a) => a?.id && a.subject?.name && a.class?.name);

export function InlineSchemeCreator({ assignments, term, weekCount, saving, error, onCreate, onCancel }) {
    const [form, setForm] = useState({ classSubjectId: '', title: '', aims: '' });
    const options = assignmentOptions(assignments);
    const setField = (field) => (event) => setForm((current) => ({ ...current, [field]: event.target.value }));

    return (
        <Paper variant="outlined" sx={{ p: { xs: 1.5, md: 2 }, mb: 2 }}>
            <Typography variant="subtitle1" fontWeight={800} sx={{ mb: 1.5 }}>
                New scheme of work
            </Typography>
            {error && <Alert severity="error" sx={{ mb: 1.5 }}>{error}</Alert>}
            <Stack direction={{ xs: 'column', md: 'row' }} spacing={1.5} alignItems={{ md: 'flex-start' }}>
                <TextField
                    select label="Subject and class" required fullWidth
                    value={form.classSubjectId} onChange={setField('classSubjectId')}
                    helperText={options.length === 0 ? 'You have no subjects assigned this year.' : undefined}
                >
                    {options.map((a) => (
                        <MenuItem key={a.id} value={a.id}>{a.subject.name} — {a.class.name}</MenuItem>
                    ))}
                </TextField>
                <TextField
                    label="Title" required fullWidth
                    placeholder={term ? `English — ${term.name}` : 'Scheme title'}
                    value={form.title} onChange={setField('title')}
                />
                <TextField
                    label="Aims for the term" fullWidth multiline minRows={2}
                    value={form.aims} onChange={setField('aims')}
                />
                <Stack direction="row" spacing={1} sx={{ pt: { md: 1 } }}>
                    <Button
                        variant="contained" startIcon={<SaveIcon />} onClick={() => onCreate(form)}
                        disabled={saving || !form.classSubjectId || !form.title.trim()}
                    >
                        Create
                    </Button>
                    <Button startIcon={<CancelIcon />} onClick={onCancel} disabled={saving}>Cancel</Button>
                </Stack>
            </Stack>
            <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 1 }}>
                {weekCount} weekly rows will appear below for direct editing.
            </Typography>
        </Paper>
    );
}

export function InlineSchemeTable({ scheme, userId, onSaveWeek, onSubmit, submitting }) {
    const detail = useApi(() => planningApi.scheme(scheme.id), [scheme.id]);
    const [drafts, setDrafts] = useState({});
    const [savingWeek, setSavingWeek] = useState(null);
    const editable = scheme.authorId === userId && scheme.status !== 'approved';
    const weeks = detail.data?.weeks || scheme.weeks || [];

    useEffect(() => {
        if (detail.data) setDrafts({});
    }, [detail.data]);

    const valueFor = (week, field) => drafts[week.weekNumber]?.[field] ?? week[field] ?? '';
    const changeField = (week, field, value) => {
        setDrafts((current) => ({
            ...current,
            [week.weekNumber]: {
                ...(current[week.weekNumber] || week),
                [field]: value,
            },
        }));
    };
    const saveWeek = async (week) => {
        setSavingWeek(week.weekNumber);
        try {
            const draft = drafts[week.weekNumber] || week;
            await onSaveWeek(scheme.id, week.weekNumber, draft);
            await detail.reload();
        } finally {
            setSavingWeek(null);
        }
    };

    return (
        <Paper variant="outlined" sx={{ overflow: 'hidden' }}>
            <Box sx={{ p: { xs: 1.5, md: 2 }, borderBottom: 1, borderColor: 'divider' }}>
                <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} alignItems={{ sm: 'center' }}>
                    <Box sx={{ flex: 1 }}>
                        <Typography variant="h6" sx={{ fontWeight: 800 }}>{scheme.title}</Typography>
                        <Typography variant="caption" color="text.secondary">
                            {scheme.subject?.name} · {scheme.class?.name}
                        </Typography>
                    </Box>
                    <Chip size="small" label={scheme.status === 'changes_requested' ? 'Changes requested' : scheme.status === 'submitted' ? 'Awaiting review' : scheme.status === 'approved' ? 'Approved' : 'Draft'}
                        color={scheme.status === 'approved' ? 'success' : scheme.status === 'changes_requested' ? 'warning' : scheme.status === 'submitted' ? 'info' : 'default'}
                        variant={scheme.status === 'draft' ? 'outlined' : 'filled'} />
                    {['draft', 'changes_requested'].includes(scheme.status) && (
                        <Button size="small" startIcon={<SendIcon />} onClick={() => onSubmit('schemes', scheme.id)} disabled={submitting}>
                            Submit scheme
                        </Button>
                    )}
                </Stack>
                {scheme.reviewNote && scheme.status === 'changes_requested' && (
                    <Alert severity="warning" sx={{ mt: 1.5, py: 0.5 }}>{scheme.reviewNote}</Alert>
                )}
            </Box>
            {detail.error && <Alert severity="error" sx={{ m: 2 }}>{detail.error}</Alert>}
            {detail.loading ? (
                <Typography color="text.secondary" sx={{ p: 2 }}>Loading weekly rows…</Typography>
            ) : (
                <TableContainer sx={{ overflowX: 'auto' }}>
                    <Table size="small" sx={{ minWidth: 980 }}>
                        <TableBody>
                            <TableRow sx={{ bgcolor: 'action.hover' }}>
                                <TableCell sx={{ fontWeight: 800, width: 80 }}>Week</TableCell>
                                {SCHEME_FIELDS.map(([, label]) => (
                                    <TableCell key={label} sx={{ fontWeight: 800, minWidth: label === 'Lesson Objectives' ? 260 : 180 }}>
                                        {label}
                                    </TableCell>
                                ))}
                                <TableCell sx={{ fontWeight: 800, width: 90 }}>Save</TableCell>
                            </TableRow>
                            {weeks.map((week) => (
                                <TableRow key={week.weekNumber} hover sx={week.weekNumber === detail.data?.currentWeek ? { bgcolor: '#eff6ff' } : undefined}>
                                    <TableCell sx={{ verticalAlign: 'top', fontWeight: 700 }}>Week {week.weekNumber}</TableCell>
                                    {SCHEME_FIELDS.map(([field, label]) => (
                                        <TableCell key={field} sx={{ verticalAlign: 'top' }}>
                                            <TextField
                                                hiddenLabel size="small" fullWidth multiline minRows={field === 'topic' ? 1 : 2}
                                                placeholder={label}
                                                value={valueFor(week, field)}
                                                onChange={(event) => changeField(week, field, event.target.value)}
                                                disabled={!editable}
                                            />
                                        </TableCell>
                                    ))}
                                    <TableCell sx={{ verticalAlign: 'top' }}>
                                        {editable && (
                                            <Button size="small" startIcon={<SaveIcon />} onClick={() => saveWeek(week)} disabled={savingWeek === week.weekNumber}>
                                                {savingWeek === week.weekNumber ? 'Saving…' : 'Save'}
                                            </Button>
                                        )}
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </TableContainer>
            )}
            <Typography variant="caption" color="text.secondary" display="block" sx={{ px: 2, py: 1.25 }}>
                {editable ? 'Edit the cells directly, then save each week.' : 'Read-only after approval.'}
            </Typography>
        </Paper>
    );
}

export function InlineLessonPlanTable({ plan, assignments, currentWeek, weekCount, saving, onSave, onSubmit, onCancel }) {
    const isNew = !plan;
    const [draft, setDraft] = useState(() => plan ? { ...blankPlan(currentWeek), ...plan } : blankPlan(currentWeek));
    const readOnly = plan?.status === 'approved';
    const options = assignmentOptions(assignments);

    useEffect(() => {
        setDraft(plan ? { ...blankPlan(currentWeek), ...plan } : blankPlan(currentWeek));
    }, [plan, currentWeek]);

    const setField = (field) => (event) => setDraft((current) => ({ ...current, [field]: event.target.value }));

    return (
        <Paper variant="outlined" sx={{ overflow: 'hidden' }}>
            <Box sx={{ p: { xs: 1.5, md: 2 }, borderBottom: 1, borderColor: 'divider' }}>
                <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} alignItems={{ sm: 'center' }}>
                    <Box sx={{ flex: 1 }}>
                        <Typography variant="subtitle1" sx={{ fontWeight: 800 }}>
                            {isNew ? 'New weekly lesson plan' : `Week ${plan.weekNumber} · ${plan.subject?.name || 'Lesson plan'}`}
                        </Typography>
                        {!isNew && <Typography variant="caption" color="text.secondary">{plan.class?.name}</Typography>}
                    </Box>
                    {!isNew && <Chip size="small" label={plan.status === 'changes_requested' ? 'Changes requested' : plan.status === 'submitted' ? 'Awaiting review' : plan.status === 'approved' ? 'Approved' : 'Draft'}
                        color={plan.status === 'approved' ? 'success' : plan.status === 'changes_requested' ? 'warning' : plan.status === 'submitted' ? 'info' : 'default'}
                        variant={plan.status === 'draft' ? 'outlined' : 'filled'} />}
                </Stack>
            </Box>
            <TableContainer>
                <Table size="small">
                    <TableBody>
                        <TableRow>
                            <TableCell sx={{ width: { xs: 150, md: 260 }, fontWeight: 700 }}>Subject and class</TableCell>
                            <TableCell>
                                <TextField select hiddenLabel size="small" fullWidth value={draft.classSubjectId} onChange={setField('classSubjectId')} disabled={readOnly}>
                                    {options.map((a) => <MenuItem key={a.id} value={a.id}>{a.subject.name} — {a.class.name}</MenuItem>)}
                                </TextField>
                            </TableCell>
                        </TableRow>
                        <TableRow>
                            <TableCell sx={{ fontWeight: 700 }}>Week</TableCell>
                            <TableCell>
                                <TextField select hiddenLabel size="small" value={draft.weekNumber} onChange={setField('weekNumber')} disabled={readOnly}>
                                    {Array.from({ length: weekCount }, (_, i) => i + 1).map((number) => (
                                        <MenuItem key={number} value={number}>Week {number}{number === currentWeek ? ' (current)' : ''}</MenuItem>
                                    ))}
                                </TextField>
                            </TableCell>
                        </TableRow>
                        {PLAN_FIELDS.map(([field, label]) => (
                            <TableRow key={field}>
                                <TableCell sx={{ verticalAlign: 'top', fontWeight: 700 }}>{label}</TableCell>
                                <TableCell>
                                    <TextField hiddenLabel size="small" fullWidth multiline minRows={field === 'development' ? 3 : 2}
                                        value={draft[field] || ''} onChange={setField(field)} disabled={readOnly} />
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </TableContainer>
            {!readOnly && (
                <Stack direction="row" spacing={1} sx={{ p: 1.5 }}>
                    <Button variant="contained" startIcon={<SaveIcon />} onClick={() => onSave(draft, isNew)} disabled={saving || !draft.classSubjectId || !String(draft.topic || '').trim()}>
                        {saving ? 'Saving…' : 'Save draft'}
                    </Button>
                    {isNew && <Button startIcon={<CancelIcon />} onClick={onCancel} disabled={saving}>Cancel</Button>}
                    {!isNew && ['draft', 'changes_requested'].includes(plan.status) && (
                        <Button startIcon={<SendIcon />} onClick={() => onSubmit('lesson-plans', plan.id)} disabled={saving}>Submit for review</Button>
                    )}
                </Stack>
            )}
            {readOnly && <Typography variant="caption" color="text.secondary" sx={{ display: 'block', p: 1.5 }}>Approved plans are read-only.</Typography>}
        </Paper>
    );
}
