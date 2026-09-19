import { useState } from 'react';
import { Link as RouterLink } from 'react-router-dom';
import {
    Alert, Box, Button, Chip, Dialog, DialogActions, DialogContent, DialogTitle,
    Paper, Snackbar, Tab, Tabs, TextField, Typography,
} from '@mui/material';
import StorefrontOutlinedIcon from '@mui/icons-material/StorefrontOutlined';
import ThumbUpOutlinedIcon from '@mui/icons-material/ThumbUpOutlined';
import ThumbDownOutlinedIcon from '@mui/icons-material/ThumbDownOutlined';
import DoneAllOutlinedIcon from '@mui/icons-material/DoneAllOutlined';
import VisibilityOutlinedIcon from '@mui/icons-material/VisibilityOutlined';
import { communicationsApi, conductApi, permissionApi, storeApi } from '../api/endpoints';
import useApi from '../hooks/useApi';
import PageHeader from '../components/PageHeader';
import DataState from '../components/DataState';
import { FilterChips } from '../components/DashboardSections';
import { REQUEST_STATUS_META } from '../components/communications/RequestSection';
import { CONDUCT_STATUS_META, CONDUCT_TYPE_META } from '../components/communications/ConductSection';

/*
 * Admin Communications — the review queue for the teacher→admin channels.
 *
 *   Requests  — permission requests tied to a student (approve / decline)
 *   Store     — material requests (reviewed in detail on the Store page)
 *   Conduct   — behavior reports (acknowledge, then mark actioned)
 *
 * The same pending totals ride on the Communications nav badge.
 */

const STATUS_FILTERS = [
    { value: 'all', label: 'All' },
    { value: 'pending', label: 'Pending' },
    { value: 'approved', label: 'Approved' },
    { value: 'declined', label: 'Declined' },
];

const CONDUCT_FILTERS = [
    { value: 'all', label: 'All' },
    { value: 'new', label: 'New' },
    { value: 'acknowledged', label: 'Acknowledged' },
    { value: 'actioned', label: 'Actioned' },
];

const fmtPickup = (iso) =>
    iso
        ? new Date(iso).toLocaleString(undefined, {
            weekday: 'short', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit',
        })
        : null;

function RequestsTab({ onChanged, onToast }) {
    const [filter, setFilter] = useState('all');
    const requests = useApi(
        () => permissionApi.list(filter === 'all' ? {} : { status: filter }),
        [filter],
    );
    const [review, setReview] = useState(null); // { request, decision }
    const [note, setNote] = useState('');
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');

    const openReview = (requestRow, decision) => {
        setReview({ request: requestRow, decision });
        setNote('');
        setError('');
    };

    const confirm = async () => {
        if (!review || busy) return;
        setBusy(true);
        setError('');
        try {
            await permissionApi.review(review.request.id, review.decision, note.trim());
            setReview(null);
            onToast(review.decision === 'approved' ? 'Request approved' : 'Request declined');
            requests.reload();
            onChanged();
        } catch (err) {
            setError(err.message || 'Review failed — please try again');
        } finally {
            setBusy(false);
        }
    };

    return (
        <Box>
            <FilterChips options={STATUS_FILTERS} value={filter} onChange={setFilter} label="Status" />

            <DataState
                loading={requests.loading}
                error={requests.error ? 'Could not load permission requests.' : ''}
                empty={(requests.data || []).length === 0}
                emptyMessage="No permission requests in this view — you're all caught up."
            >
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1, mt: 0.5 }}>
                    {(requests.data || []).map((r) => {
                        const meta = REQUEST_STATUS_META[r.status] || REQUEST_STATUS_META.pending;
                        return (
                            <Paper key={r.id} variant="outlined" sx={{ p: 1.75, borderRadius: 2 }}>
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25, flexWrap: 'wrap' }}>
                                    <Typography sx={{ fontWeight: 800, fontSize: 14 }}>
                                        {r.student?.name}
                                    </Typography>
                                    <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600 }}>
                                        {r.class?.name}
                                    </Typography>
                                    <Chip size="small" label={meta.label} color={meta.color}
                                        sx={{ fontWeight: 700, height: 20, fontSize: 10.5 }} />
                                    {fmtPickup(r.pickupTime) && (
                                        <Chip size="small" variant="outlined" label={fmtPickup(r.pickupTime)}
                                            sx={{ fontWeight: 700, height: 20, fontSize: 10.5 }} />
                                    )}
                                    <Typography variant="caption" color="text.secondary" sx={{ ml: 'auto' }}>
                                        {r.requester?.name} · {new Date(r.createdAt).toLocaleDateString(
                                            undefined, { day: 'numeric', month: 'short' })}
                                    </Typography>
                                </Box>
                                <Typography sx={{ fontSize: 13.5, mt: 0.75 }}>{r.reason}</Typography>
                                {r.reviewNote && (
                                    <Typography variant="caption" color="text.secondary"
                                        sx={{ display: 'block', mt: 0.5 }}>
                                        Your note: {r.reviewNote}
                                    </Typography>
                                )}
                                {r.status === 'pending' && (
                                    <Box sx={{ display: 'flex', gap: 1, mt: 1 }}>
                                        <Button size="small" variant="contained" color="success" disableElevation
                                            startIcon={<ThumbUpOutlinedIcon sx={{ fontSize: 15 }} />}
                                            onClick={() => openReview(r, 'approved')}
                                            sx={{ textTransform: 'none', fontWeight: 700 }}>
                                            Approve
                                        </Button>
                                        <Button size="small" variant="outlined" color="error"
                                            startIcon={<ThumbDownOutlinedIcon sx={{ fontSize: 15 }} />}
                                            onClick={() => openReview(r, 'declined')}
                                            sx={{ textTransform: 'none', fontWeight: 700 }}>
                                            Decline
                                        </Button>
                                    </Box>
                                )}
                            </Paper>
                        );
                    })}
                </Box>
            </DataState>

            {/* review confirm dialog */}
            <Dialog open={Boolean(review)} onClose={() => !busy && setReview(null)} maxWidth="xs" fullWidth>
                <DialogTitle sx={{ fontWeight: 800 }}>
                    {review?.decision === 'approved' ? 'Approve request?' : 'Decline request?'}
                </DialogTitle>
                <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 1.5, pt: 1 }}>
                    {error && <Alert severity="error">{error}</Alert>}
                    <Typography variant="body2" color="text.secondary">
                        <strong>{review?.request?.student?.name}</strong> ({review?.request?.class?.name})
                        — {review?.request?.reason}
                    </Typography>
                    <TextField label="Note to the teacher (optional)" size="small" fullWidth multiline
                        minRows={2} value={note} onChange={(e) => setNote(e.target.value)} />
                </DialogContent>
                <DialogActions sx={{ px: 3, pb: 2.5 }}>
                    <Button onClick={() => setReview(null)} disabled={busy} sx={{ textTransform: 'none' }}>
                        Cancel
                    </Button>
                    <Button variant="contained" disableElevation onClick={confirm} disabled={busy}
                        color={review?.decision === 'approved' ? 'success' : 'error'}
                        sx={{ textTransform: 'none', fontWeight: 700 }}>
                        {busy ? 'Saving…' : (review?.decision === 'approved' ? 'Approve' : 'Decline')}
                    </Button>
                </DialogActions>
            </Dialog>
        </Box>
    );
}

function ConductTab({ onChanged, onToast }) {
    const [filter, setFilter] = useState('all');
    const reports = useApi(
        () => conductApi.list(filter === 'all' ? {} : { status: filter }),
        [filter],
    );
    const [review, setReview] = useState(null); // { report, status }
    const [note, setNote] = useState('');
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');

    const openReview = (report, status) => {
        setReview({ report, status });
        setNote('');
        setError('');
    };

    const confirm = async () => {
        if (!review || busy) return;
        setBusy(true);
        setError('');
        try {
            await conductApi.updateStatus(review.report.id, review.status, note.trim());
            setReview(null);
            onToast(review.status === 'acknowledged' ? 'Report acknowledged' : 'Report marked as actioned');
            reports.reload();
            onChanged();
        } catch (err) {
            setError(err.message || 'Could not update the report — please try again');
        } finally {
            setBusy(false);
        }
    };

    return (
        <Box>
            <FilterChips options={CONDUCT_FILTERS} value={filter} onChange={setFilter} label="Status" />

            <DataState
                loading={reports.loading}
                error={reports.error ? 'Could not load conduct reports.' : ''}
                empty={(reports.data || []).length === 0}
                emptyMessage="No conduct reports in this view — you're all caught up."
            >
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1, mt: 0.5 }}>
                    {(reports.data || []).map((r) => {
                        const tone = CONDUCT_TYPE_META[r.type] || CONDUCT_TYPE_META.praise;
                        const meta = CONDUCT_STATUS_META[r.status] || CONDUCT_STATUS_META.new;
                        return (
                            <Paper key={r.id} variant="outlined" sx={{ p: 1.75, borderRadius: 2 }}>
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25, flexWrap: 'wrap' }}>
                                    <Typography sx={{ fontWeight: 800, fontSize: 14 }}>
                                        {r.student?.name}
                                    </Typography>
                                    <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600 }}>
                                        {r.class?.name}
                                    </Typography>
                                    <Chip size="small" label={tone.label} color={tone.color}
                                        sx={{ fontWeight: 700, height: 20, fontSize: 10.5 }} />
                                    <Chip size="small" variant="outlined" label={meta.label} color={meta.color}
                                        sx={{ fontWeight: 700, height: 20, fontSize: 10.5 }} />
                                    <Typography variant="caption" color="text.secondary" sx={{ ml: 'auto' }}>
                                        {r.reporter?.name} · {new Date(r.createdAt).toLocaleDateString(
                                            undefined, { day: 'numeric', month: 'short' })}
                                    </Typography>
                                </Box>
                                <Typography sx={{ fontSize: 13.5, mt: 0.75 }}>{r.body}</Typography>
                                {r.actionNote && (
                                    <Typography variant="caption" color="text.secondary"
                                        sx={{ display: 'block', mt: 0.5 }}>
                                        Your note: {r.actionNote}
                                    </Typography>
                                )}
                                {r.status !== 'actioned' && (
                                    <Box sx={{ display: 'flex', gap: 1, mt: 1 }}>
                                        {r.status === 'new' && (
                                            <Button size="small" variant="contained" color="info" disableElevation
                                                startIcon={<VisibilityOutlinedIcon sx={{ fontSize: 15 }} />}
                                                onClick={() => openReview(r, 'acknowledged')}
                                                sx={{ textTransform: 'none', fontWeight: 700 }}>
                                                Acknowledge
                                            </Button>
                                        )}
                                        <Button size="small" variant="outlined" color="success"
                                            startIcon={<DoneAllOutlinedIcon sx={{ fontSize: 15 }} />}
                                            onClick={() => openReview(r, 'actioned')}
                                            sx={{ textTransform: 'none', fontWeight: 700 }}>
                                            Mark actioned
                                        </Button>
                                    </Box>
                                )}
                            </Paper>
                        );
                    })}
                </Box>
            </DataState>

            {/* review confirm dialog */}
            <Dialog open={Boolean(review)} onClose={() => !busy && setReview(null)} maxWidth="xs" fullWidth>
                <DialogTitle sx={{ fontWeight: 800 }}>
                    {review?.status === 'acknowledged' ? 'Acknowledge report?' : 'Mark report as actioned?'}
                </DialogTitle>
                <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 1.5, pt: 1 }}>
                    {error && <Alert severity="error">{error}</Alert>}
                    <Typography variant="body2" color="text.secondary">
                        <strong>{review?.report?.student?.name}</strong> ({review?.report?.class?.name})
                        — {review?.report?.body}
                    </Typography>
                    <TextField label="Note to the teacher (optional)" size="small" fullWidth multiline
                        minRows={2} value={note} onChange={(e) => setNote(e.target.value)} />
                </DialogContent>
                <DialogActions sx={{ px: 3, pb: 2.5 }}>
                    <Button onClick={() => setReview(null)} disabled={busy} sx={{ textTransform: 'none' }}>
                        Cancel
                    </Button>
                    <Button variant="contained" disableElevation onClick={confirm} disabled={busy}
                        color={review?.status === 'acknowledged' ? 'info' : 'success'}
                        sx={{ textTransform: 'none', fontWeight: 700 }}>
                        {busy ? 'Saving…' : (review?.status === 'acknowledged' ? 'Acknowledge' : 'Mark actioned')}
                    </Button>
                </DialogActions>
            </Dialog>
        </Box>
    );
}

export default function Communications() {
    const [tab, setTab] = useState('requests');
    const [toast, setToast] = useState('');
    const counts = useApi(() => communicationsApi.badgeCounts(), []);
    const storePreview = useApi(() => storeApi.list({ status: 'pending' }), []);

    const c = counts.data || {};

    return (
        <Box>
            <PageHeader
                title="Admin Communications"
                subtitle="Administration · approve what teachers send: permission requests, store materials and conduct reports."
                action={(
                    <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                        <Chip size="small" color={(c.permissionRequestsPending || 0) > 0 ? 'warning' : 'default'}
                            label={`${c.permissionRequestsPending ?? '…'} requests pending`} sx={{ fontWeight: 700 }} />
                        <Chip size="small" color={(c.storeRequestsPending || 0) > 0 ? 'warning' : 'default'}
                            label={`${c.storeRequestsPending ?? '…'} store pending`} sx={{ fontWeight: 700 }} />
                        <Chip size="small" color={(c.conductReportsPending || 0) > 0 ? 'warning' : 'default'}
                            label={`${c.conductReportsPending ?? '…'} new conduct`} sx={{ fontWeight: 700 }} />
                    </Box>
                )}
            />

            <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ mb: 2.5 }}>
                <Tab value="requests" label="Permission requests" sx={{ textTransform: 'none', fontWeight: 700 }} />
                <Tab value="store" label="Store requests" sx={{ textTransform: 'none', fontWeight: 700 }} />
                <Tab value="conduct" label="Conduct reports" sx={{ textTransform: 'none', fontWeight: 700 }} />
            </Tabs>

            {tab === 'requests' && (
                <RequestsTab onChanged={() => counts.reload()} onToast={setToast} />
            )}

            {tab === 'store' && (
                <Box>
                    <Paper variant="outlined" sx={{ p: 2, borderRadius: 2, mb: 2, display: 'flex',
                        alignItems: 'center', gap: 1.5, borderStyle: 'dashed' }}>
                        <StorefrontOutlinedIcon sx={{ color: 'text.secondary' }} />
                        <Typography variant="body2" color="text.secondary" sx={{ flexGrow: 1 }}>
                            Material requests are reviewed in full — store stage and final approval —
                            on the Store page.
                        </Typography>
                        <Button component={RouterLink} to="/app/store" size="small" variant="contained"
                            disableElevation sx={{ textTransform: 'none', fontWeight: 700, whiteSpace: 'nowrap' }}>
                            Open Store page
                        </Button>
                    </Paper>
                    <Typography sx={{ fontWeight: 800, fontSize: 13, mb: 1, color: 'text.secondary',
                        textTransform: 'uppercase', letterSpacing: '.05em' }}>
                        Waiting for a first review ({(storePreview.data || []).length})
                    </Typography>
                    {(storePreview.data || []).slice(0, 5).map((r) => (
                        <Paper key={r.id} variant="outlined" sx={{ p: 1.5, borderRadius: 2, mb: 1 }}>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25 }}>
                                <Typography sx={{ fontWeight: 800, fontSize: 12.5,
                                    fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace' }}>
                                    {r.requestNumber}
                                </Typography>
                                <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600 }}>
                                    {r.class?.name || '—'} · {r.requester?.name}
                                </Typography>
                                <Typography variant="caption" color="text.secondary" sx={{ ml: 'auto' }}>
                                    {(r.items || []).length} items
                                </Typography>
                            </Box>
                            {r.purpose && (
                                <Typography sx={{ fontSize: 13, mt: 0.5 }}>{r.purpose}</Typography>
                            )}
                        </Paper>
                    ))}
                </Box>
            )}

            {tab === 'conduct' && (
                <ConductTab onChanged={() => counts.reload()} onToast={setToast} />
            )}

            <Snackbar open={Boolean(toast)} autoHideDuration={2800}
                onClose={() => setToast('')} message={toast} />
        </Box>
    );
}
