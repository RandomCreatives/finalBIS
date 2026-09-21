import { useState } from 'react';
import {
    Alert, Box, Button, Card, CardContent, Chip, Dialog, DialogActions, DialogContent,
    DialogTitle, Grid, LinearProgress, MenuItem, Paper, Snackbar, Stack, Tab, Table,
    TableBody, TableCell, TableContainer, TableHead, TableRow, Tabs, TextField, Typography,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import SendIcon from '@mui/icons-material/Send';
import MenuBookIcon from '@mui/icons-material/MenuBook';
import AutoStoriesIcon from '@mui/icons-material/AutoStories';
import InboxIcon from '@mui/icons-material/MoveToInbox';
import GroupsIcon from '@mui/icons-material/Groups';
import { planningApi, termApi, assignmentApi } from '../api/endpoints';
import useApi from '../hooks/useApi';
import PageHeader from '../components/PageHeader';
import DataState from '../components/DataState';
import { Section, StatGrid, StatCard } from '../components/DashboardSections';
import { useAuth } from '../auth/AuthContext';

const STATUS_META = {
    draft: { label: 'Draft', color: 'default' },
    submitted: { label: 'Awaiting review', color: 'info' },
    approved: { label: 'Approved', color: 'success' },
    changes_requested: { label: 'Changes requested', color: 'warning' },
    missing: { label: 'Not started', color: 'error' },
};

const StatusChip = ({ status }) => {
    const meta = STATUS_META[status] || STATUS_META.draft;
    return <Chip size="small" label={meta.label} color={meta.color} variant={status === 'draft' ? 'outlined' : 'filled'} />;
};

const TAB_SX = { minHeight: 44, textTransform: 'none', fontWeight: 700, fontSize: 14 };

const fmtSubmitted = (iso) => {
    if (!iso) return 'just now';
    return new Date(iso).toLocaleString('en-GB', {
        day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
    });
};

/** Red flag for a teacher who has not handed in a due weekly plan. */
const MissingChip = ({ missingWeeks }) => {
    if (!missingWeeks?.length) {
        return <Chip size="small" label="Up to date" color="success" variant="outlined" />;
    }
    const label = missingWeeks.length === 1
        ? `Missing week ${missingWeeks[0]}`
        : `Missing weeks ${missingWeeks.slice(0, 3).join(', ')}${missingWeeks.length > 3 ? '…' : ''}`;
    return <Chip size="small" label={label} color="error" />;
};

export default function Planning() {
    const { user } = useAuth();
    const isAdmin = user?.role === 'admin';

    const [tab, setTab] = useState(0);
    const [schemeDialog, setSchemeDialog] = useState(null);
    const [openScheme, setOpenScheme] = useState(null);
    const [planDialog, setPlanDialog] = useState(null);
    const [readDoc, setReadDoc] = useState(null); // admin reading one submission
    const [reviewDialog, setReviewDialog] = useState(null);
    const [saving, setSaving] = useState(false);
    const [formError, setFormError] = useState('');
    const [toast, setToast] = useState('');

    const current = useApi(() => termApi.current(), []);
    // Teachers author here; the admin only reviews, so these stay empty for them.
    const schemes = useApi(
        () => (isAdmin ? Promise.resolve([]) : planningApi.schemes({ mine: 'true' })),
        [isAdmin]
    );
    const plans = useApi(
        () => (isAdmin ? Promise.resolve([]) : planningApi.lessonPlans({ mine: 'true' })),
        [isAdmin]
    );
    const overview = useApi(
        () => (isAdmin ? planningApi.overview() : Promise.resolve(null)),
        [isAdmin]
    );
    // Subjects the signed-in teacher actually teaches.
    const myAssignments = useApi(
        () => (isAdmin ? Promise.resolve(null) : assignmentApi.subjects({ teacherId: user?.id })),
        [isAdmin, user?.id]
    );

    const term = current.data?.term;
    const weekCount = term?.weekCount || 0;
    const currentWeek = current.data?.currentWeek;

    const refresh = () => { schemes.reload(); plans.reload(); overview.reload(); };

    const handleCreateScheme = async () => {
        setSaving(true);
        setFormError('');
        try {
            await planningApi.createScheme({
                classSubjectId: schemeDialog.classSubjectId,
                title: schemeDialog.title.trim(),
                aims: schemeDialog.aims || null,
            });
            setToast('Scheme created — fill in each week');
            setSchemeDialog(null);
            refresh();
        } catch (err) {
            setFormError(err.message);
        } finally {
            setSaving(false);
        }
    };

    const openSchemeDetail = async (scheme) => {
        try {
            setOpenScheme(await planningApi.scheme(scheme.id ?? scheme.schemeId));
        } catch (err) {
            setToast(err.message);
        }
    };

    const saveWeek = async (weekNumber, topic, objectives) => {
        try {
            await planningApi.saveSchemeWeek(openScheme.id, weekNumber, { topic, objectives });
            setOpenScheme(await planningApi.scheme(openScheme.id));
            setToast(`Week ${weekNumber} saved`);
        } catch (err) {
            setToast(err.message);
        }
    };

    const submit = async (kind, id) => {
        try {
            await planningApi.submit(kind, id);
            setToast('Submitted for review');
            refresh();
            if (openScheme?.id === id) setOpenScheme(await planningApi.scheme(id));
        } catch (err) {
            setToast(err.message);
        }
    };

    /** Admin: read one inbox item before deciding. */
    const openSubmission = async (doc) => {
        if (doc.kind === 'schemes') {
            try {
                const full = await planningApi.scheme(doc.id);
                setReadDoc({ kind: 'schemes', ...full, author: doc.author, class: doc.class, subject: doc.subject });
            } catch (err) {
                setToast(err.message);
            }
        } else {
            setReadDoc(doc);
        }
    };

    /** Admin: one-click approve, from the inbox row or the reading dialog. */
    const approve = async (doc) => {
        try {
            await planningApi.review(doc.kind, doc.id, 'approved', null);
            setToast(`Approved — ${doc.kind === 'schemes' ? 'scheme of work' : `week ${doc.weekNumber} plan`}`);
            setReadDoc(null);
            refresh();
        } catch (err) {
            setToast(err.message);
        }
    };

    /** Admin: send back with a note explaining what to fix. */
    const handleSendBack = async () => {
        setSaving(true);
        try {
            await planningApi.review(reviewDialog.kind, reviewDialog.id, 'changes_requested', reviewDialog.note.trim());
            setToast('Sent back with your note');
            setReviewDialog(null);
            setReadDoc(null);
            refresh();
        } catch (err) {
            setToast(err.message);
        } finally {
            setSaving(false);
        }
    };

    const handleSavePlan = async () => {
        setSaving(true);
        setFormError('');
        try {
            await planningApi.saveLessonPlan({
                classSubjectId: planDialog.classSubjectId,
                weekNumber: Number(planDialog.weekNumber),
                topic: planDialog.topic.trim(),
                objectives: planDialog.objectives || null,
                activities: planDialog.activities || null,
                resources: planDialog.resources || null,
                homework: planDialog.homework || null,
                reflection: planDialog.reflection || null,
            });
            setToast('Lesson plan saved');
            setPlanDialog(null);
            refresh();
        } catch (err) {
            setFormError(err.message);
        } finally {
            setSaving(false);
        }
    };

    if (!current.loading && !term) {
        return (
            <>
                <PageHeader title="Planning" />
                <Alert severity="info">
                    No current term is set. An administrator can create one under Calendar → Terms.
                </Alert>
            </>
        );
    }

    const awaiting = overview.data?.awaiting || [];
    const summary = overview.data?.summary || {};
    const progressRows = [...(overview.data?.rows || [])].sort(
        (a, b) => (b.missingWeeks?.length || 0) - (a.missingWeeks?.length || 0)
            || String(a.teacher?.name).localeCompare(String(b.teacher?.name))
    );

    return (
        <>
            <PageHeader
                title="Planning"
                subtitle={
                    term
                        ? `${term.name} · ${weekCount} teaching weeks${currentWeek ? ` · currently week ${currentWeek}` : ''}`
                        : 'Schemes of work and weekly lesson plans.'
                }
            />

            {isAdmin ? (
                <>
                    <Tabs value={tab} onChange={(_, v) => setTab(v)} aria-label="Planning views"
                        sx={{ mb: 2, borderBottom: 1, borderColor: 'divider', minHeight: 44 }}>
                        <Tab
                            icon={<InboxIcon fontSize="small" />} iconPosition="start"
                            label={awaiting.length ? `Waiting for approval (${awaiting.length})` : 'Waiting for approval'}
                            sx={TAB_SX}
                        />
                        <Tab icon={<GroupsIcon fontSize="small" />} iconPosition="start"
                            label="Teacher progress" sx={TAB_SX} />
                    </Tabs>

                    {/* Tab 1 — the review inbox --------------------------------- */}
                    {tab === 0 && (
                        <DataState
                            loading={overview.loading}
                            error={overview.error}
                            empty={awaiting.length === 0}
                            emptyMessage="All caught up — nothing is waiting for your review."
                        >
                            <Stack spacing={1.5}>
                                {awaiting.map((d) => (
                                    <Paper key={`${d.kind}-${d.id}`} variant="outlined" sx={{ p: 2 }}>
                                        <Stack direction={{ xs: 'column', md: 'row' }} spacing={1.5}
                                            alignItems={{ md: 'center' }}>
                                            <Chip
                                                size="small" variant="outlined"
                                                color={d.kind === 'schemes' ? 'primary' : 'secondary'}
                                                label={d.kind === 'schemes' ? 'Scheme of work' : `Week ${d.weekNumber} plan`}
                                                sx={{ alignSelf: 'flex-start' }}
                                            />
                                            <Box sx={{ flex: 1, minWidth: 0 }}>
                                                <Typography variant="subtitle1" fontWeight={600}>
                                                    {d.kind === 'schemes' ? d.title : d.topic}
                                                </Typography>
                                                <Typography variant="caption" color="text.secondary">
                                                    {d.author?.name ?? 'Unknown teacher'}
                                                    {d.subject?.name ? ` · ${d.subject.name}` : ''}
                                                    {d.class?.name ? ` · ${d.class.name}` : ''}
                                                    {' · handed in '}{fmtSubmitted(d.submittedAt)}
                                                </Typography>
                                            </Box>
                                            <Stack direction="row" spacing={1}>
                                                <Button size="small" onClick={() => openSubmission(d)}>Read</Button>
                                                <Button size="small" color="warning"
                                                    onClick={() => setReviewDialog({
                                                        kind: d.kind, id: d.id, note: '',
                                                        title: `${d.kind === 'schemes' ? d.title : `Week ${d.weekNumber}: ${d.topic}`} — ${d.author?.name ?? ''}`,
                                                    })}>
                                                    Send back
                                                </Button>
                                                <Button size="small" variant="contained" color="success"
                                                    onClick={() => approve(d)}>
                                                    Approve
                                                </Button>
                                            </Stack>
                                        </Stack>
                                    </Paper>
                                ))}
                            </Stack>
                        </DataState>
                    )}

                    {/* Tab 2 — who is on track, who is late ---------------------- */}
                    {tab === 1 && (
                        <DataState loading={overview.loading} error={overview.error}>
                            {overview.data && (
                                <>
                                    <StatGrid>
                                        <StatCard label="Teaching seats" value={summary.assignments} />
                                        <StatCard label="Schemes missing" value={summary.schemesMissing} color={summary.schemesMissing > 0 ? 'error.main' : 'success.main'} />
                                        <StatCard label="Awaiting review" value={summary.awaitingReview} color="warning.main" />
                                        <StatCard label="Behind this week" value={summary.lateTeachers} color={summary.lateTeachers > 0 ? 'error.main' : 'success.main'} />
                                    </StatGrid>

                                    <TableContainer component={Paper} variant="outlined">
                                        <Table size="small">
                                            <TableHead>
                                                <TableRow>
                                                    <TableCell>Teacher</TableCell>
                                                    <TableCell>Subject</TableCell>
                                                    <TableCell>Class</TableCell>
                                                    <TableCell>Scheme</TableCell>
                                                    <TableCell>Weekly plans</TableCell>
                                                    <TableCell>This week</TableCell>
                                                    <TableCell align="right">Actions</TableCell>
                                                </TableRow>
                                            </TableHead>
                                            <TableBody>
                                                {progressRows.map((r) => {
                                                    const dueWeeks = (r.submittedWeeks?.length || 0) + (r.missingWeeks?.length || 0);
                                                    return (
                                                        <TableRow key={r.classSubjectId} hover
                                                            sx={r.missingWeeks?.length ? { bgcolor: '#fef7f7' } : undefined}>
                                                            <TableCell sx={{ fontWeight: 500 }}>{r.teacher?.name}</TableCell>
                                                            <TableCell>{r.subject?.name}</TableCell>
                                                            <TableCell>{r.class?.name}</TableCell>
                                                            <TableCell><StatusChip status={r.schemeStatus} /></TableCell>
                                                            <TableCell sx={{ minWidth: 150 }}>
                                                                <Stack spacing={0.5}>
                                                                    <Typography variant="caption" color="text.secondary">
                                                                        {r.submittedWeeks?.length || 0} of {dueWeeks || r.expectedWeeks} due weeks in
                                                                    </Typography>
                                                                    <LinearProgress
                                                                        variant="determinate"
                                                                        value={dueWeeks ? Math.min(100, ((r.submittedWeeks?.length || 0) / dueWeeks) * 100) : 0}
                                                                        color={r.missingWeeks?.length ? 'error' : 'success'}
                                                                        sx={{ height: 5, borderRadius: 3 }}
                                                                    />
                                                                </Stack>
                                                            </TableCell>
                                                            <TableCell><MissingChip missingWeeks={r.missingWeeks} /></TableCell>
                                                            <TableCell align="right">
                                                                {r.schemeId && (
                                                                    <Button size="small"
                                                                        onClick={() => openSubmission({ kind: 'schemes', id: r.schemeId, author: r.teacher, class: r.class, subject: r.subject })}>
                                                                        Open scheme
                                                                    </Button>
                                                                )}
                                                            </TableCell>
                                                        </TableRow>
                                                    );
                                                })}
                                            </TableBody>
                                        </Table>
                                    </TableContainer>
                                </>
                            )}
                        </DataState>
                    )}
                </>
            ) : (
                <>
                    <Section title="My schemes of work" icon={<MenuBookIcon />} defaultExpanded
                        action={
                            <Button
                                variant="contained" size="small" startIcon={<AddIcon />}
                                onClick={() => {
                                    setFormError('');
                                    setSchemeDialog({ classSubjectId: '', title: '', aims: '' });
                                }}
                            >
                                New scheme of work
                            </Button>
                        }
                    >
                        <DataState
                            loading={schemes.loading}
                            error={schemes.error}
                            empty={(schemes.data || []).length === 0}
                            emptyMessage="No schemes yet. Create one for each subject you teach this term."
                        >
                            <Grid container spacing={2.5}>
                                {(schemes.data || []).map((s) => (
                                    <Grid item xs={12} md={6} key={s.id}>
                                        <Card>
                                            <CardContent>
                                                <Stack direction="row" justifyContent="space-between" alignItems="flex-start">
                                                    <Box>
                                                        <Typography variant="h6">{s.title}</Typography>
                                                        <Typography variant="caption" color="text.secondary">
                                                            {s.subject?.name} · {s.class?.name}
                                                        </Typography>
                                                    </Box>
                                                    <StatusChip status={s.status} />
                                                </Stack>

                                                {s.reviewNote && s.status === 'changes_requested' && (
                                                    <Alert severity="warning" sx={{ mt: 1.5, py: 0.5 }}>
                                                        {s.reviewNote}
                                                    </Alert>
                                                )}

                                                <Stack direction="row" spacing={1} sx={{ mt: 2 }}>
                                                    <Button size="small" onClick={() => openSchemeDetail(s)}>
                                                        Open weeks
                                                    </Button>
                                                    {['draft', 'changes_requested'].includes(s.status) && (
                                                        <Button
                                                            size="small" startIcon={<SendIcon />}
                                                            onClick={() => submit('schemes', s.id)}
                                                        >
                                                            Submit
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

                    <Section title="My lesson plans" icon={<AutoStoriesIcon />}
                        action={
                            <Button
                                variant="contained" size="small" startIcon={<AddIcon />}
                                onClick={() => {
                                    setFormError('');
                                    setPlanDialog({
                                        classSubjectId: '', weekNumber: currentWeek || 1, topic: '',
                                        objectives: '', activities: '', resources: '', homework: '', reflection: '',
                                    });
                                }}
                            >
                                New lesson plan
                            </Button>
                        }
                    >
                        <DataState
                            loading={plans.loading}
                            error={plans.error}
                            empty={(plans.data || []).length === 0}
                            emptyMessage="No lesson plans yet for this term."
                        >
                            <TableContainer component={Paper} variant="outlined">
                                <Table size="small">
                                    <TableHead>
                                        <TableRow>
                                            <TableCell align="center">Week</TableCell>
                                            <TableCell>Subject</TableCell>
                                            <TableCell>Class</TableCell>
                                            <TableCell>Topic</TableCell>
                                            <TableCell>Status</TableCell>
                                            <TableCell align="right">Actions</TableCell>
                                        </TableRow>
                                    </TableHead>
                                    <TableBody>
                                        {(plans.data || []).map((p) => (
                                            <TableRow
                                                key={p.id}
                                                hover
                                                sx={p.weekNumber === currentWeek ? { bgcolor: '#eff6ff' } : undefined}
                                            >
                                                <TableCell align="center" sx={{ fontWeight: 600 }}>{p.weekNumber}</TableCell>
                                                <TableCell>{p.subject?.name}</TableCell>
                                                <TableCell>{p.class?.name}</TableCell>
                                                <TableCell>{p.topic}</TableCell>
                                                <TableCell><StatusChip status={p.status} /></TableCell>
                                                <TableCell align="right">
                                                    <Stack direction="row" spacing={0.5} justifyContent="flex-end">
                                                        <Button
                                                            size="small"
                                                            disabled={p.status === 'approved'}
                                                            onClick={() => {
                                                                setFormError('');
                                                                setPlanDialog({
                                                                    classSubjectId: p.classSubjectId,
                                                                    weekNumber: p.weekNumber,
                                                                    topic: p.topic || '',
                                                                    objectives: p.objectives || '',
                                                                    activities: p.activities || '',
                                                                    resources: p.resources || '',
                                                                    homework: p.homework || '',
                                                                    reflection: p.reflection || '',
                                                                });
                                                            }}
                                                        >
                                                            Edit
                                                        </Button>
                                                        {['draft', 'changes_requested'].includes(p.status) && (
                                                            <Button size="small" onClick={() => submit('lesson-plans', p.id)}>
                                                                Submit
                                                            </Button>
                                                        )}
                                                    </Stack>
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </TableContainer>
                        </DataState>
                    </Section>
                </>
            )}

            {/* New scheme -------------------------------------------------------- */}
            <Dialog open={Boolean(schemeDialog)} onClose={() => setSchemeDialog(null)} maxWidth="sm" fullWidth>
                <DialogTitle>New scheme of work</DialogTitle>
                <DialogContent>
                    {formError && <Alert severity="error" sx={{ mb: 2 }}>{formError}</Alert>}
                    {schemeDialog && (
                        <Stack spacing={2} sx={{ mt: 1 }}>
                            <TextField
                                select label="Subject and class" required fullWidth
                                value={schemeDialog.classSubjectId}
                                onChange={(e) => setSchemeDialog((d) => ({ ...d, classSubjectId: e.target.value }))}
                                helperText={
                                    (myAssignments.data?.assignments || []).length === 0
                                        ? 'You have no subjects assigned this year.'
                                        : undefined
                                }
                            >
                                {(myAssignments.data?.assignments || []).map((a) => (
                                    <MenuItem key={a.id} value={a.id}>
                                        {a.subject?.name} — {a.class?.name}
                                    </MenuItem>
                                ))}
                            </TextField>
                            <TextField label="Title" required fullWidth
                                placeholder={term ? `English — ${term.name}` : 'Scheme title'}
                                value={schemeDialog.title}
                                onChange={(e) => setSchemeDialog((d) => ({ ...d, title: e.target.value }))} />
                            <TextField label="Aims for the term" fullWidth multiline rows={3}
                                value={schemeDialog.aims}
                                onChange={(e) => setSchemeDialog((d) => ({ ...d, aims: e.target.value }))} />
                            <Typography variant="caption" color="text.secondary">
                                {weekCount} weekly rows will be created for you to fill in.
                            </Typography>
                        </Stack>
                    )}
                </DialogContent>
                <DialogActions sx={{ px: 3, pb: 2 }}>
                    <Button onClick={() => setSchemeDialog(null)}>Cancel</Button>
                    <Button variant="contained" onClick={handleCreateScheme}
                        disabled={saving || !schemeDialog?.classSubjectId || !schemeDialog?.title?.trim()}>
                        Create
                    </Button>
                </DialogActions>
            </Dialog>

            {/* Scheme weeks ------------------------------------------------------ */}
            <Dialog open={Boolean(openScheme)} onClose={() => setOpenScheme(null)} maxWidth="md" fullWidth>
                <DialogTitle>
                    {openScheme?.title}
                    <Typography variant="caption" color="text.secondary" display="block">
                        {openScheme?.subject?.name} · {openScheme?.class?.name}
                    </Typography>
                </DialogTitle>
                <DialogContent>
                    {openScheme?.status === 'approved' && (
                        <Alert severity="success" sx={{ mb: 2 }}>
                            Approved — this scheme is now read-only.
                        </Alert>
                    )}
                    <Stack spacing={1.5} sx={{ mt: 1 }}>
                        {(openScheme?.weeks || []).map((w) => {
                            const canEdit = openScheme?.authorId === user?.id && openScheme?.status !== 'approved';
                            return (
                                <Paper key={w.weekNumber} variant="outlined" sx={{ p: 1.5 }}>
                                    <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} alignItems="flex-start">
                                        <Chip label={`Week ${w.weekNumber}`} size="small" sx={{ minWidth: 74 }} />
                                        <TextField
                                            label="Topic" size="small" fullWidth
                                            defaultValue={w.topic}
                                            disabled={!canEdit}
                                            onBlur={(e) => {
                                                if (e.target.value !== w.topic) {
                                                    saveWeek(w.weekNumber, e.target.value, w.objectives);
                                                }
                                            }}
                                        />
                                        <TextField
                                            label="Objectives" size="small" fullWidth
                                            defaultValue={w.objectives || ''}
                                            disabled={!canEdit}
                                            onBlur={(e) => {
                                                if (e.target.value !== (w.objectives || '')) {
                                                    saveWeek(w.weekNumber, w.topic, e.target.value);
                                                }
                                            }}
                                        />
                                    </Stack>
                                </Paper>
                            );
                        })}
                    </Stack>
                </DialogContent>
                <DialogActions sx={{ px: 3, pb: 2 }}>
                    <Typography variant="caption" color="text.secondary" sx={{ mr: 'auto' }}>
                        {openScheme?.authorId === user?.id ? 'Changes save when you leave a field.' : 'Read-only — only the author can edit.'}
                    </Typography>
                    <Button onClick={() => setOpenScheme(null)}>Close</Button>
                </DialogActions>
            </Dialog>

            {/* Reading one submission (admin) ------------------------------------- */}
            <Dialog open={Boolean(readDoc)} onClose={() => setReadDoc(null)} maxWidth="md" fullWidth>
                <DialogTitle>
                    {readDoc?.kind === 'schemes' ? readDoc?.title : `Week ${readDoc?.weekNumber} lesson plan`}
                    <Typography variant="caption" color="text.secondary" display="block">
                        {readDoc?.author?.name ?? ''}
                        {readDoc?.subject?.name ? ` · ${readDoc.subject.name}` : ''}
                        {readDoc?.class?.name ? ` · ${readDoc.class.name}` : ''}
                    </Typography>
                </DialogTitle>
                <DialogContent dividers>
                    {readDoc?.kind === 'schemes' ? (
                        <Stack spacing={1.5}>
                            {readDoc?.aims && (
                                <Alert severity="info" sx={{ py: 0.5 }}>Aims: {readDoc.aims}</Alert>
                            )}
                            {(readDoc?.weeks || []).map((w) => (
                                <Paper key={w.weekNumber} variant="outlined" sx={{ p: 1.5 }}>
                                    <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} alignItems="flex-start">
                                        <Chip label={`Week ${w.weekNumber}`} size="small" sx={{ minWidth: 74 }} />
                                        <Box sx={{ flex: 1 }}>
                                            <Typography variant="body2" fontWeight={600}>{w.topic || '—'}</Typography>
                                            {w.objectives && (
                                                <Typography variant="caption" color="text.secondary">{w.objectives}</Typography>
                                            )}
                                        </Box>
                                    </Stack>
                                </Paper>
                            ))}
                        </Stack>
                    ) : (
                        <Stack spacing={2}>
                            {[
                                ['Topic', readDoc?.topic],
                                ['Learning objectives', readDoc?.objectives],
                                ['Activities', readDoc?.activities],
                                ['Resources', readDoc?.resources],
                                ['Homework', readDoc?.homework],
                                ['Reflection', readDoc?.reflection],
                            ].map(([label, value]) => (
                                <Box key={label}>
                                    <Typography variant="caption" color="text.secondary">{label}</Typography>
                                    <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>
                                        {value || '—'}
                                    </Typography>
                                </Box>
                            ))}
                        </Stack>
                    )}
                </DialogContent>
                <DialogActions sx={{ px: 3, pb: 2 }}>
                    <Button onClick={() => setReadDoc(null)}>Close</Button>
                    {readDoc && (
                        <>
                            <Button color="warning"
                                onClick={() => setReviewDialog({
                                    kind: readDoc.kind, id: readDoc.id, note: '',
                                    title: `${readDoc.kind === 'schemes' ? readDoc.title : `Week ${readDoc.weekNumber}: ${readDoc.topic}`} — ${readDoc.author?.name ?? ''}`,
                                })}>
                                Send back
                            </Button>
                            <Button variant="contained" color="success" onClick={() => approve(readDoc)}>
                                Approve
                            </Button>
                        </>
                    )}
                </DialogActions>
            </Dialog>

            {/* Lesson plan (teacher editing) -------------------------------------- */}
            <Dialog open={Boolean(planDialog)} onClose={() => setPlanDialog(null)} maxWidth="sm" fullWidth>
                <DialogTitle>Lesson plan</DialogTitle>
                <DialogContent>
                    {formError && <Alert severity="error" sx={{ mb: 2 }}>{formError}</Alert>}
                    {planDialog && (
                        <Stack spacing={2} sx={{ mt: 1 }}>
                            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
                                <TextField
                                    select label="Subject and class" required fullWidth
                                    value={planDialog.classSubjectId}
                                    onChange={(e) => setPlanDialog((d) => ({ ...d, classSubjectId: e.target.value }))}
                                >
                                    {(myAssignments.data?.assignments || []).map((a) => (
                                        <MenuItem key={a.id} value={a.id}>
                                            {a.subject?.name} — {a.class?.name}
                                        </MenuItem>
                                    ))}
                                </TextField>
                                <TextField
                                    select label="Week" required sx={{ minWidth: 120 }}
                                    value={planDialog.weekNumber}
                                    onChange={(e) => setPlanDialog((d) => ({ ...d, weekNumber: e.target.value }))}
                                >
                                    {Array.from({ length: weekCount }, (_, i) => i + 1).map((n) => (
                                        <MenuItem key={n} value={n}>
                                            Week {n}{n === currentWeek ? ' (now)' : ''}
                                        </MenuItem>
                                    ))}
                                </TextField>
                            </Stack>

                            <TextField label="Topic" required fullWidth
                                value={planDialog.topic}
                                onChange={(e) => setPlanDialog((d) => ({ ...d, topic: e.target.value }))} />
                            <TextField label="Learning objectives" fullWidth multiline rows={2}
                                value={planDialog.objectives}
                                onChange={(e) => setPlanDialog((d) => ({ ...d, objectives: e.target.value }))} />
                            <TextField label="Activities" fullWidth multiline rows={3}
                                value={planDialog.activities}
                                onChange={(e) => setPlanDialog((d) => ({ ...d, activities: e.target.value }))} />
                            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
                                <TextField label="Resources" fullWidth
                                    value={planDialog.resources}
                                    onChange={(e) => setPlanDialog((d) => ({ ...d, resources: e.target.value }))} />
                                <TextField label="Homework" fullWidth
                                    value={planDialog.homework}
                                    onChange={(e) => setPlanDialog((d) => ({ ...d, homework: e.target.value }))} />
                            </Stack>
                            <TextField label="Reflection (after teaching)" fullWidth multiline rows={2}
                                value={planDialog.reflection}
                                onChange={(e) => setPlanDialog((d) => ({ ...d, reflection: e.target.value }))} />
                        </Stack>
                    )}
                </DialogContent>
                <DialogActions sx={{ px: 3, pb: 2 }}>
                    <Button onClick={() => setPlanDialog(null)}>Cancel</Button>
                    <Button variant="contained" onClick={handleSavePlan}
                        disabled={saving || !planDialog?.classSubjectId || !planDialog?.topic?.trim()}>
                        Save
                    </Button>
                </DialogActions>
            </Dialog>

            {/* Send back for changes ---------------------------------------------- */}
            <Dialog open={Boolean(reviewDialog)} onClose={() => setReviewDialog(null)} maxWidth="xs" fullWidth>
                <DialogTitle>Send back for changes</DialogTitle>
                <DialogContent>
                    {reviewDialog && (
                        <Stack spacing={2} sx={{ mt: 1 }}>
                            <Typography variant="body2" color="text.secondary">{reviewDialog.title}</Typography>
                            <TextField
                                label="What should they fix?" required fullWidth multiline rows={3}
                                value={reviewDialog.note}
                                onChange={(e) => setReviewDialog((d) => ({ ...d, note: e.target.value }))}
                                autoFocus
                            />
                        </Stack>
                    )}
                </DialogContent>
                <DialogActions sx={{ px: 3, pb: 2 }}>
                    <Button onClick={() => setReviewDialog(null)}>Cancel</Button>
                    <Button variant="contained" color="warning" onClick={handleSendBack}
                        disabled={saving || !reviewDialog?.note?.trim()}>
                        Send back
                    </Button>
                </DialogActions>
            </Dialog>

            <Snackbar open={Boolean(toast)} autoHideDuration={3000}
                onClose={() => setToast('')} message={toast}
                anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }} />
        </>
    );
}
