import { useState } from 'react';
import {
    Alert, Box, Button, Card, CardContent, Chip, Dialog, DialogActions, DialogContent,
    DialogTitle, Grid, LinearProgress, MenuItem, Paper, Snackbar, Stack, Tab, Table,
    TableBody, TableCell, TableContainer, TableHead, TableRow, Tabs, TextField, Typography,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import SendIcon from '@mui/icons-material/Send';
import { planningApi, termApi, assignmentApi } from '../api/endpoints';
import useApi from '../hooks/useApi';
import PageHeader from '../components/PageHeader';
import DataState from '../components/DataState';
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

export default function Planning() {
    const { user } = useAuth();
    const canReview = ['admin', 'main_teacher'].includes(user?.role);

    const [tab, setTab] = useState(0);
    const [schemeDialog, setSchemeDialog] = useState(null);
    const [openScheme, setOpenScheme] = useState(null);
    const [planDialog, setPlanDialog] = useState(null);
    const [reviewDialog, setReviewDialog] = useState(null);
    const [saving, setSaving] = useState(false);
    const [formError, setFormError] = useState('');
    const [toast, setToast] = useState('');

    const current = useApi(() => termApi.current(), []);
    const schemes = useApi(() => planningApi.schemes({ mine: 'true' }), []);
    const plans = useApi(() => planningApi.lessonPlans({ mine: 'true' }), []);
    const overview = useApi(
        () => (canReview && tab === 2 ? planningApi.overview() : Promise.resolve(null)),
        [canReview, tab]
    );
    // Subjects the signed-in teacher actually teaches.
    const myAssignments = useApi(
        () => assignmentApi.subjects({ teacherId: user?.id }),
        [user?.id]
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
            setOpenScheme(await planningApi.scheme(scheme.id));
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

    const handleReview = async () => {
        setSaving(true);
        try {
            await planningApi.review(
                reviewDialog.kind, reviewDialog.id, reviewDialog.decision, reviewDialog.note
            );
            setToast(`Marked ${reviewDialog.decision === 'approved' ? 'approved' : 'for changes'}`);
            setReviewDialog(null);
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

            <Card sx={{ mb: 2.5 }}>
                <Tabs value={tab} onChange={(_, v) => setTab(v)} variant="scrollable" allowScrollButtonsMobile>
                    <Tab label="My schemes of work" />
                    <Tab label="My lesson plans" />
                    {canReview && <Tab label="Staff overview" />}
                </Tabs>
            </Card>

            {/* --- Schemes ------------------------------------------------------ */}
            {tab === 0 && (
                <>
                    <Stack direction="row" justifyContent="flex-end" sx={{ mb: 2 }}>
                        <Button
                            variant="contained" startIcon={<AddIcon />}
                            onClick={() => {
                                setFormError('');
                                setSchemeDialog({ classSubjectId: '', title: '', aims: '' });
                            }}
                        >
                            New scheme of work
                        </Button>
                    </Stack>

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
                </>
            )}

            {/* --- Lesson plans -------------------------------------------------- */}
            {tab === 1 && (
                <>
                    <Stack direction="row" justifyContent="flex-end" sx={{ mb: 2 }}>
                        <Button
                            variant="contained" startIcon={<AddIcon />}
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
                    </Stack>

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
                </>
            )}

            {/* --- Staff overview ------------------------------------------------ */}
            {tab === 2 && canReview && (
                <DataState loading={overview.loading} error={overview.error}>
                    {overview.data && (
                        <>
                            <Grid container spacing={2.5} sx={{ mb: 2.5 }}>
                                {[
                                    { label: 'Assignments', value: overview.data.summary.assignments },
                                    { label: 'Schemes missing', value: overview.data.summary.schemesMissing, warn: true },
                                    { label: 'Awaiting review', value: overview.data.summary.awaitingReview },
                                    { label: 'Approved', value: overview.data.summary.schemesApproved },
                                ].map((s) => (
                                    <Grid item xs={6} md={3} key={s.label}>
                                        <Card>
                                            <CardContent>
                                                <Typography variant="body2" color="text.secondary">{s.label}</Typography>
                                                <Typography
                                                    variant="h5"
                                                    color={s.warn && s.value > 0 ? 'error.main' : 'text.primary'}
                                                >
                                                    {s.value}
                                                </Typography>
                                            </CardContent>
                                        </Card>
                                    </Grid>
                                ))}
                            </Grid>

                            <TableContainer component={Paper} variant="outlined">
                                <Table size="small">
                                    <TableHead>
                                        <TableRow>
                                            <TableCell>Teacher</TableCell>
                                            <TableCell>Subject</TableCell>
                                            <TableCell>Class</TableCell>
                                            <TableCell>Scheme</TableCell>
                                            <TableCell>Weekly plans</TableCell>
                                            <TableCell align="right">Actions</TableCell>
                                        </TableRow>
                                    </TableHead>
                                    <TableBody>
                                        {overview.data.rows.map((r) => (
                                            <TableRow key={r.classSubjectId} hover>
                                                <TableCell sx={{ fontWeight: 500 }}>{r.teacher?.name}</TableCell>
                                                <TableCell>{r.subject?.name}</TableCell>
                                                <TableCell>{r.class?.name}</TableCell>
                                                <TableCell><StatusChip status={r.schemeStatus} /></TableCell>
                                                <TableCell sx={{ minWidth: 130 }}>
                                                    <Stack spacing={0.5}>
                                                        <Typography variant="caption" color="text.secondary">
                                                            {r.lessonPlanCount} of {r.expectedWeeks}
                                                        </Typography>
                                                        <LinearProgress
                                                            variant="determinate"
                                                            value={Math.min(100, (r.lessonPlanCount / r.expectedWeeks) * 100)}
                                                            sx={{ height: 5, borderRadius: 3 }}
                                                        />
                                                    </Stack>
                                                </TableCell>
                                                <TableCell align="right">
                                                    {r.schemeStatus === 'submitted' && (
                                                        <Button
                                                            size="small"
                                                            onClick={() => setReviewDialog({
                                                                kind: 'schemes', id: r.schemeId,
                                                                decision: 'approved', note: '',
                                                                title: `${r.subject?.name} — ${r.teacher?.name}`,
                                                            })}
                                                        >
                                                            Review
                                                        </Button>
                                                    )}
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </TableContainer>
                        </>
                    )}
                </DataState>
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
                        {(openScheme?.weeks || []).map((w) => (
                            <Paper key={w.weekNumber} variant="outlined" sx={{ p: 1.5 }}>
                                <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} alignItems="flex-start">
                                    <Chip label={`Week ${w.weekNumber}`} size="small" sx={{ minWidth: 74 }} />
                                    <TextField
                                        label="Topic" size="small" fullWidth
                                        defaultValue={w.topic}
                                        disabled={openScheme?.status === 'approved'}
                                        onBlur={(e) => {
                                            if (e.target.value !== w.topic) {
                                                saveWeek(w.weekNumber, e.target.value, w.objectives);
                                            }
                                        }}
                                    />
                                    <TextField
                                        label="Objectives" size="small" fullWidth
                                        defaultValue={w.objectives || ''}
                                        disabled={openScheme?.status === 'approved'}
                                        onBlur={(e) => {
                                            if (e.target.value !== (w.objectives || '')) {
                                                saveWeek(w.weekNumber, w.topic, e.target.value);
                                            }
                                        }}
                                    />
                                </Stack>
                            </Paper>
                        ))}
                    </Stack>
                </DialogContent>
                <DialogActions sx={{ px: 3, pb: 2 }}>
                    <Typography variant="caption" color="text.secondary" sx={{ mr: 'auto' }}>
                        Changes save when you leave a field.
                    </Typography>
                    <Button onClick={() => setOpenScheme(null)}>Close</Button>
                </DialogActions>
            </Dialog>

            {/* Lesson plan ------------------------------------------------------- */}
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

            {/* Review ------------------------------------------------------------ */}
            <Dialog open={Boolean(reviewDialog)} onClose={() => setReviewDialog(null)} maxWidth="xs" fullWidth>
                <DialogTitle>Review</DialogTitle>
                <DialogContent>
                    {reviewDialog && (
                        <Stack spacing={2} sx={{ mt: 1 }}>
                            <Typography variant="body2" color="text.secondary">{reviewDialog.title}</Typography>
                            <TextField
                                select label="Decision" fullWidth
                                value={reviewDialog.decision}
                                onChange={(e) => setReviewDialog((d) => ({ ...d, decision: e.target.value }))}
                            >
                                <MenuItem value="approved">Approve</MenuItem>
                                <MenuItem value="changes_requested">Request changes</MenuItem>
                            </TextField>
                            <TextField
                                label="Note to the teacher" fullWidth multiline rows={3}
                                value={reviewDialog.note}
                                onChange={(e) => setReviewDialog((d) => ({ ...d, note: e.target.value }))}
                            />
                        </Stack>
                    )}
                </DialogContent>
                <DialogActions sx={{ px: 3, pb: 2 }}>
                    <Button onClick={() => setReviewDialog(null)}>Cancel</Button>
                    <Button variant="contained" onClick={handleReview} disabled={saving}>
                        Save review
                    </Button>
                </DialogActions>
            </Dialog>

            <Snackbar open={Boolean(toast)} autoHideDuration={3000}
                onClose={() => setToast('')} message={toast}
                anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }} />
        </>
    );
}
