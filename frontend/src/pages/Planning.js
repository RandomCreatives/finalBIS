import { useState } from 'react';
import {
    Alert, Box, Button, Chip, Dialog, DialogActions, DialogContent, DialogTitle,
    LinearProgress, Paper, Snackbar, Stack, Tab, Table, TableBody, TableCell,
    TableContainer, TableHead, TableRow, Tabs, TextField, Typography,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import MenuBookIcon from '@mui/icons-material/MenuBook';
import AutoStoriesIcon from '@mui/icons-material/AutoStories';
import InboxIcon from '@mui/icons-material/MoveToInbox';
import GroupsIcon from '@mui/icons-material/Groups';
import { planningApi, termApi, assignmentApi } from '../api/endpoints';
import useApi from '../hooks/useApi';
import PageHeader from '../components/PageHeader';
import DataState from '../components/DataState';
import { StatGrid, StatCard } from '../components/DashboardSections';
import {
    InlineLessonPlanTable, InlineSchemeCreator, InlineSchemeTable,
} from '../components/planning/InlinePlanningTables';
import { useAuth } from '../auth/AuthContext';
import { formatDateTime } from '../utils/schoolTime';

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
    return formatDateTime(iso, {
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
    const [newScheme, setNewScheme] = useState(false);
    const [newPlan, setNewPlan] = useState(false);
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

    const handleCreateScheme = async (form) => {
        setSaving(true);
        setFormError('');
        try {
            await planningApi.createScheme({
                classSubjectId: form.classSubjectId,
                title: form.title.trim(),
                aims: form.aims || null,
            });
            setToast('Scheme created — fill in each week');
            setNewScheme(false);
            refresh();
        } catch (err) {
            setFormError(err.message);
        } finally {
            setSaving(false);
        }
    };

    const saveWeek = async (schemeId, weekNumber, fields) => {
        try {
            await planningApi.saveSchemeWeek(schemeId, weekNumber, fields);
            setToast(`Week ${weekNumber} saved`);
        } catch (err) {
            setToast(err.message);
            throw err;
        }
    };

    const submit = async (kind, id) => {
        try {
            await planningApi.submit(kind, id);
            setToast('Submitted for review');
            refresh();
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

    const handleSavePlan = async (draft, isNew) => {
        setSaving(true);
        setFormError('');
        try {
            const matchingScheme = (schemes.data || []).find((scheme) => scheme.classSubjectId === draft.classSubjectId);
            await planningApi.saveLessonPlan({
                classSubjectId: draft.classSubjectId,
                weekNumber: Number(draft.weekNumber),
                topic: String(draft.topic || '').trim(),
                objectives: draft.objectives || null,
                successCriteria: draft.successCriteria || null,
                starter: draft.starter || null,
                introduction: draft.introduction || null,
                development: draft.development || null,
                plenary: draft.plenary || null,
                senPlanning: draft.senPlanning || null,
                activities: draft.activities || null,
                resources: draft.resources || null,
                homework: draft.homework || null,
                reflection: draft.reflection || null,
                schemeId: draft.schemeId || matchingScheme?.id || null,
            });
            setToast('Lesson plan saved');
            if (isNew) setNewPlan(false);
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
                    <Tabs value={tab} onChange={(_, value) => setTab(value)} aria-label="Planning sections"
                        sx={{ mb: 2, borderBottom: 1, borderColor: 'divider', minHeight: 44 }}>
                        <Tab icon={<MenuBookIcon fontSize="small" />} iconPosition="start"
                            label="Scheme of Work" value={0} sx={TAB_SX} />
                        <Tab icon={<AutoStoriesIcon fontSize="small" />} iconPosition="start"
                            label="Weekly Lesson Plans" value={1} sx={TAB_SX} />
                    </Tabs>

                    {tab === 0 && (
                        <Stack spacing={2}>
                            {newScheme ? (
                                <InlineSchemeCreator
                                    assignments={myAssignments.data?.assignments || []}
                                    term={term}
                                    weekCount={weekCount}
                                    saving={saving}
                                    error={formError}
                                    onCreate={handleCreateScheme}
                                    onCancel={() => { setNewScheme(false); setFormError(''); }}
                                />
                            ) : (
                                <Button
                                    variant="contained" size="small" startIcon={<AddIcon />}
                                    onClick={() => { setFormError(''); setNewScheme(true); }}
                                    sx={{ alignSelf: 'flex-start' }}
                                >
                                    New scheme of work
                                </Button>
                            )}

                            <DataState
                                loading={schemes.loading}
                                error={schemes.error}
                                empty={(schemes.data || []).length === 0 && !newScheme}
                                emptyMessage="No schemes yet. Create one for each subject you teach this term."
                            >
                                <Stack spacing={2}>
                                    {(schemes.data || []).map((scheme) => (
                                        <InlineSchemeTable
                                            key={scheme.id}
                                            scheme={scheme}
                                            userId={user?.id}
                                            onSaveWeek={saveWeek}
                                            onSubmit={submit}
                                            submitting={saving}
                                        />
                                    ))}
                                </Stack>
                            </DataState>
                        </Stack>
                    )}

                    {tab === 1 && (
                        <Stack spacing={2}>
                            {newPlan && (
                                <InlineLessonPlanTable
                                    plan={null}
                                    assignments={myAssignments.data?.assignments || []}
                                    currentWeek={currentWeek}
                                    weekCount={weekCount}
                                    saving={saving}
                                    onSave={handleSavePlan}
                                    onSubmit={submit}
                                    onCancel={() => { setNewPlan(false); setFormError(''); }}
                                />
                            )}
                            {!newPlan && (
                                <Button
                                    variant="contained" size="small" startIcon={<AddIcon />}
                                    onClick={() => { setFormError(''); setNewPlan(true); }}
                                    sx={{ alignSelf: 'flex-start' }}
                                >
                                    New lesson plan
                                </Button>
                            )}
                            {formError && <Alert severity="error">{formError}</Alert>}
                            <DataState
                                loading={plans.loading}
                                error={plans.error}
                                empty={(plans.data || []).length === 0 && !newPlan}
                                emptyMessage="No lesson plans yet for this term."
                            >
                                <Stack spacing={2}>
                                    {(plans.data || []).map((plan) => (
                                        <InlineLessonPlanTable
                                            key={plan.id}
                                            plan={plan}
                                            assignments={myAssignments.data?.assignments || []}
                                            currentWeek={currentWeek}
                                            weekCount={weekCount}
                                            saving={saving}
                                            onSave={handleSavePlan}
                                            onSubmit={submit}
                                            onCancel={() => {}}
                                        />
                                    ))}
                                </Stack>
                            </DataState>
                        </Stack>
                    )}
                </>
            )}

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
                                                <Typography variant="caption" color="text.secondary" display="block">Objectives: {w.objectives}</Typography>
                                            )}
                                            {w.resources && <Typography variant="caption" color="text.secondary" display="block">Resources: {w.resources}</Typography>}
                                            {w.assessment && <Typography variant="caption" color="text.secondary" display="block">Assessment: {w.assessment}</Typography>}
                                            {w.evaluation && <Typography variant="caption" color="text.secondary" display="block">Evaluation: {w.evaluation}</Typography>}
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
                                ['Success criteria', readDoc?.successCriteria],
                                ['Starter', readDoc?.starter],
                                ['Introduction', readDoc?.introduction],
                                ['Development', readDoc?.development],
                                ['Plenary', readDoc?.plenary],
                                ['Planning for SEN', readDoc?.senPlanning],
                                ['Activities / practical assessment', readDoc?.activities],
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
