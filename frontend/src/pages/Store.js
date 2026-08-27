import { useState } from 'react';
import { createPortal } from 'react-dom';
import {
    Alert, Box, Button, Card, CardContent, Chip, Dialog, DialogActions, DialogContent,
    DialogTitle, Divider, IconButton, MenuItem, Paper, Snackbar, Stack,
    Table, TableBody, TableCell, TableContainer, TableHead, TableRow, TextField,
    Tooltip, Typography,
} from '@mui/material';
import AddShoppingCartIcon from '@mui/icons-material/AddShoppingCart';
import DeleteIcon from '@mui/icons-material/Delete';
import EditIcon from '@mui/icons-material/Edit';
import PrintIcon from '@mui/icons-material/Print';
import ThumbUpIcon from '@mui/icons-material/ThumbUp';
import ThumbDownIcon from '@mui/icons-material/ThumbDown';
import AddIcon from '@mui/icons-material/Add';
import RemoveIcon from '@mui/icons-material/Remove';
import { storeApi, classApi } from '../api/endpoints';
import useApi from '../hooks/useApi';
import PageHeader from '../components/PageHeader';
import DataState from '../components/DataState';
import { FilterChips, StatGrid, StatCard } from '../components/DashboardSections';
import { useAuth } from '../auth/AuthContext';

const STATUS_META = {
    pending: { label: 'Pending', color: 'warning' },
    store_approved: { label: 'Store approved', color: 'info' },
    approved: { label: 'Approved', color: 'success' },
    rejected: { label: 'Rejected', color: 'error' },
};

const FILTERS = [
    { label: 'All', status: 'all' },
    { label: 'Pending', status: 'pending' },
    { label: 'Store approved', status: 'store_approved' },
    { label: 'Approved', status: 'approved' },
    { label: 'Rejected', status: 'rejected' },
];

const cleanItem = (it) => ({
    item: String(it.item || '').trim(),
    quantity: Number.parseInt(it.quantity, 10) || 0,
    note: String(it.note || '').trim(),
});

const itemTotal = (items) => (items || []).reduce((sum, it) => sum + Number.parseInt(it.quantity, 10) || 0, 0);

const fmtDate = (iso) => {
    if (!iso) return '';
    const d = new Date(iso);
    return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
};

export default function Store() {
    const { user, isAdmin } = useAuth();
    const isStoreManager = user?.role === 'store_manager';
    const canStoreReview = isStoreManager || isAdmin;

    const [filter, setFilter] = useState('all');
    const [dialog, setDialog] = useState(null); // { mode: 'create' | 'edit', request }
    const [review, setReview] = useState(null); // { request, stage: 'store' | 'admin' }
    const [print, setPrint] = useState(null);   // request being printed
    const [saving, setSaving] = useState(false);
    const [formError, setFormError] = useState('');
    const [toast, setToast] = useState('');

    // Single list, filtered by chips instead of status tabs.
    const requests = useApi(() => storeApi.list({}), []);
    const classes = useApi(() => classApi.list(), []);

    const allRequests = requests.data || [];
    const counts = FILTERS.filter((f) => f.status !== 'all').reduce((acc, f) => {
        acc[f.status] = allRequests.filter((r) => r.status === f.status).length;
        return acc;
    }, {});
    const rows = filter === 'all' ? allRequests : allRequests.filter((r) => r.status === filter);

    // ---- Request form (create / edit) ----
    const [form, setForm] = useState({
        classId: '',
        purpose: '',
        items: [{ item: '', quantity: 1, note: '' }],
    });
    const setField = (f) => (e) => setForm((fm) => ({ ...fm, [f]: e.target.value }));
    const setItemField = (index, f) => (e) =>
        setForm((fm) => ({
            ...fm,
            items: fm.items.map((it, i) => (i === index ? { ...it, [f]: e.target.value } : it)),
        }));
    const addItem = () =>
        setForm((fm) => ({ ...fm, items: [...fm.items, { item: '', quantity: 1, note: '' }] }));
    const removeItem = (index) =>
        setForm((fm) => ({
            ...fm,
            items: fm.items.length > 1 ? fm.items.filter((_, i) => i !== index) : fm.items,
        }));

    const openCreate = () => {
        setFormError('');
        setForm({ classId: '', purpose: '', items: [{ item: '', quantity: 1, note: '' }] });
        setDialog({ mode: 'create' });
    };

    const openEdit = (request) => {
        setFormError('');
        setForm({
            classId: request.class?.id || '',
            purpose: request.purpose || '',
            items: (request.items || []).map((it) => ({ ...it })),
        });
        setDialog({ mode: 'edit', request });
    };

    const handleSave = async () => {
        const items = form.items.map(cleanItem);
        if (items.length === 0 || items.some((it) => !it.item || it.quantity <= 0)) {
            setFormError('Add at least one item with a name and a positive quantity');
            return;
        }
        setSaving(true);
        setFormError('');
        try {
            const payload = { classId: form.classId || null, purpose: form.purpose.trim(), items };
            if (dialog.mode === 'edit') {
                await storeApi.update(dialog.request.id, payload);
                setToast('Request updated');
            } else {
                await storeApi.create(payload);
                setToast('Request submitted for store review');
            }
            setDialog(null);
            requests.reload();
        } catch (err) {
            setFormError(err.message);
        } finally {
            setSaving(false);
        }
    };

    const cancelRequest = async (request) => {
        try {
            await storeApi.cancel(request.id);
            setToast('Request cancelled');
            requests.reload();
        } catch (err) {
            setToast(err.message);
        }
    };

    // ---- Review (approve / reject) ----
    const [reviewForm, setReviewForm] = useState({ decision: 'approved', note: '' });

    const openReview = (request, stage) => {
        setFormError('');
        setReviewForm({ decision: 'approved', note: '' });
        setReview({ request, stage });
    };

    const handleReview = async () => {
        setSaving(true);
        setFormError('');
        try {
            const note = reviewForm.note.trim() || null;
            if (review.stage === 'admin') {
                await storeApi.adminReview(review.request.id, reviewForm.decision, note);
            } else {
                await storeApi.storeReview(review.request.id, reviewForm.decision, note);
            }
            setToast(reviewForm.decision === 'approved' ? 'Request approved' : 'Request rejected');
            setReview(null);
            requests.reload();
        } catch (err) {
            setFormError(err.message);
        } finally {
            setSaving(false);
        }
    };

    const subtitle = isStoreManager
        ? 'Receive and approve class material requests before they go to the admin.'
        : isAdmin
            ? 'Store manager review first, then your final approval. Approved forms are the record.'
            : 'Request books, markers, pens, pencils and other classroom items for your class.';

    return (
        <>
            <style>{`
                @media print {
                    body * { visibility: hidden; }
                    #store-print-area, #store-print-area * { visibility: visible; }
                    #store-print-area {
                        position: fixed; left: 0; top: 0; width: 100%;
                        background: #fff; color: #000; padding: 24px;
                    }
                }
            `}</style>

            <PageHeader
                title="Store Requests"
                subtitle={subtitle}
                action={
                    <Button
                        variant="contained" startIcon={<AddShoppingCartIcon />}
                        onClick={openCreate}
                    >
                        New request
                    </Button>
                }
            />

            <StatGrid>
                <StatCard label="Pending" value={counts.pending || 0} color="warning.main" />
                <StatCard label="Store approved" value={counts.store_approved || 0} color="info.main" />
                <StatCard label="Approved" value={counts.approved || 0} color="success.main" />
                <StatCard label="Rejected" value={counts.rejected || 0} color="error.main" />
            </StatGrid>

            <FilterChips options={FILTERS} value={filter} onChange={setFilter} />

            <DataState
                loading={requests.loading}
                error={requests.error}
                empty={rows.length === 0}
                emptyMessage="No requests in this view."
            >
                <Stack spacing={1.5}>
                    {rows.map((r) => {
                        const meta = STATUS_META[r.status] || STATUS_META.pending;
                        const isOwner = r.requester?.id === user?.id;
                        const showStoreReview = canStoreReview && r.status === 'pending';
                        const showAdminReview = isAdmin && r.status === 'store_approved';

                        return (
                            <Card key={r.id} sx={{ borderLeft: 4, borderLeftColor: `${meta.color}.main` }}>
                                <CardContent sx={{ py: 1.5, '&:last-child': { pb: 1.5 } }}>
                                    <Stack direction="row" spacing={1.5} alignItems="flex-start">
                                        <Box sx={{ flexGrow: 1, minWidth: 0 }}>
                                            <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
                                                <Typography variant="body1" sx={{ fontWeight: 600 }}>
                                                    {r.requestNumber}
                                                </Typography>
                                                <Chip size="small" label={meta.label} color={meta.color} />
                                                {r.class && <Chip size="small" label={r.class.name} variant="outlined" />}
                                                <Chip
                                                    size="small"
                                                    variant="outlined"
                                                    label={`${r.items.length} item${r.items.length === 1 ? '' : 's'} · ${itemTotal(r.items)} units`}
                                                />
                                            </Stack>

                                            <TableContainer component={Paper} variant="outlined" sx={{ mt: 1, mb: 1 }}>
                                                <Table size="small">
                                                    <TableHead>
                                                        <TableRow>
                                                            <TableCell sx={{ width: 34 }}>#</TableCell>
                                                            <TableCell>Item</TableCell>
                                                            <TableCell align="right" sx={{ width: 70 }}>Qty</TableCell>
                                                            <TableCell>Note</TableCell>
                                                        </TableRow>
                                                    </TableHead>
                                                    <TableBody>
                                                        {(r.items || []).map((it, i) => (
                                                            <TableRow key={i}>
                                                                <TableCell color="text.secondary">{i + 1}</TableCell>
                                                                <TableCell>{it.item}</TableCell>
                                                                <TableCell align="right">{it.quantity}</TableCell>
                                                                <TableCell sx={{ color: 'text.secondary' }}>{it.note}</TableCell>
                                                            </TableRow>
                                                        ))}
                                                    </TableBody>
                                                </Table>
                                            </TableContainer>

                                            {r.purpose && (
                                                <Typography variant="body2" color="text.secondary" sx={{ mb: 0.5 }}>
                                                    {r.purpose}
                                                </Typography>
                                            )}

                                            <Typography variant="caption" color="text.secondary" display="block">
                                                {isOwner ? 'You requested' : `Requested by ${r.requester?.name}`}
                                                {r.class ? ` · ${r.class.name}` : ' · No class'}
                                                {` · ${fmtDate(r.createdAt)}`}
                                            </Typography>

                                            {r.storeReviewer && (
                                                <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 0.5 }}>
                                                    Store review: {r.storeReviewer.name} · {fmtDate(r.storeReviewedAt)}
                                                    {r.storeReviewNote ? ` — "${r.storeReviewNote}"` : ''}
                                                </Typography>
                                            )}
                                            {r.adminReviewer && (
                                                <Typography variant="caption" color="text.secondary" display="block">
                                                    Admin review: {r.adminReviewer.name} · {fmtDate(r.adminReviewedAt)}
                                                    {r.adminReviewNote ? ` — "${r.adminReviewNote}"` : ''}
                                                </Typography>
                                            )}
                                        </Box>

                                        <Stack direction="row" spacing={0.5}>
                                            {showStoreReview && (
                                                <Tooltip title="Store manager review">
                                                    <Button
                                                        size="small" variant="outlined" color="primary"
                                                        startIcon={<ThumbUpIcon fontSize="small" />}
                                                        onClick={() => openReview(r, 'store')}
                                                    >
                                                        Review
                                                    </Button>
                                                </Tooltip>
                                            )}
                                            {showAdminReview && (
                                                <Tooltip title="Final admin approval">
                                                    <Button
                                                        size="small" variant="contained" color="success"
                                                        startIcon={<ThumbUpIcon fontSize="small" />}
                                                        onClick={() => openReview(r, 'admin')}
                                                    >
                                                        Approve
                                                    </Button>
                                                </Tooltip>
                                            )}
                                            <Tooltip title="Print the requisition form">
                                                <IconButton size="small" onClick={() => setPrint(r)}>
                                                    <PrintIcon fontSize="small" />
                                                </IconButton>
                                            </Tooltip>
                                            {isOwner && r.status === 'pending' && (
                                                <>
                                                    <Tooltip title="Edit">
                                                        <IconButton size="small" onClick={() => openEdit(r)}>
                                                            <EditIcon fontSize="small" />
                                                        </IconButton>
                                                    </Tooltip>
                                                    <Tooltip title="Cancel">
                                                        <IconButton size="small" onClick={() => cancelRequest(r)}>
                                                            <DeleteIcon fontSize="small" />
                                                        </IconButton>
                                                    </Tooltip>
                                                </>
                                            )}
                                        </Stack>
                                    </Stack>
                                </CardContent>
                            </Card>
                        );
                    })}
                </Stack>
            </DataState>

            {/* ---- Create / edit request ---- */}
            <Dialog open={Boolean(dialog)} onClose={() => setDialog(null)} maxWidth="sm" fullWidth>
                <DialogTitle>{dialog?.mode === 'edit' ? 'Edit request' : 'New store request'}</DialogTitle>
                <DialogContent>
                    {formError && <Alert severity="error" sx={{ mb: 2 }}>{formError}</Alert>}
                    <Stack spacing={2} sx={{ mt: 1 }}>
                        <TextField
                            select label="Class (optional)" fullWidth
                            value={form.classId} onChange={setField('classId')}
                            helperText="The class the items are for."
                        >
                            <MenuItem value="">No class selected</MenuItem>
                            {(classes.data || []).map((c) => (
                                <MenuItem key={c.id} value={c.id}>{c.name}</MenuItem>
                            ))}
                        </TextField>

                        <Divider>Items</Divider>

                        {form.items.map((it, i) => (
                            <Stack key={i} direction="row" spacing={1} alignItems="flex-start">
                                <TextField
                                    label={`Item ${i + 1}`} placeholder="e.g. Whiteboard markers" fullWidth
                                    value={it.item} onChange={setItemField(i, 'item')}
                                />
                                <TextField
                                    label="Qty" type="number" inputProps={{ min: 1 }} sx={{ width: 90 }}
                                    value={it.quantity} onChange={setItemField(i, 'quantity')}
                                />
                                <IconButton onClick={() => removeItem(i)} aria-label="Remove item" sx={{ mt: 1 }}>
                                    <RemoveIcon fontSize="small" />
                                </IconButton>
                            </Stack>
                        ))}

                        <Button startIcon={<AddIcon />} onClick={addItem} sx={{ alignSelf: 'flex-start' }}>
                            Add item
                        </Button>

                        <TextField
                            label="Purpose / notes" fullWidth multiline rows={2}
                            value={form.purpose} onChange={setField('purpose')}
                            placeholder="e.g. Markers running low, need refill for Term 2"
                        />
                    </Stack>
                </DialogContent>
                <DialogActions sx={{ px: 3, pb: 2 }}>
                    <Button onClick={() => setDialog(null)}>Cancel</Button>
                    <Button variant="contained" onClick={handleSave} disabled={saving}>
                        {dialog?.mode === 'edit' ? 'Save changes' : 'Submit request'}
                    </Button>
                </DialogActions>
            </Dialog>

            {/* ---- Approve / reject ---- */}
            <Dialog open={Boolean(review)} onClose={() => setReview(null)} maxWidth="xs" fullWidth>
                <DialogTitle>
                    {review?.stage === 'admin' ? 'Final approval' : 'Store manager review'}
                </DialogTitle>
                <DialogContent>
                    {formError && <Alert severity="error" sx={{ mb: 2 }}>{formError}</Alert>}
                    <Typography variant="body2" sx={{ mb: 2 }}>
                        {review?.request?.requestNumber} — {review?.request?.requester?.name}
                        {review?.request?.class ? ` · ${review.request.class.name}` : ''}
                    </Typography>
                    <Stack spacing={2}>
                        <TextField
                            select label="Decision" fullWidth
                            value={reviewForm.decision}
                            onChange={(e) => setReviewForm((rf) => ({ ...rf, decision: e.target.value }))}
                        >
                            <MenuItem value="approved">Approve</MenuItem>
                            <MenuItem value="rejected">Reject</MenuItem>
                        </TextField>
                        <TextField
                            label={reviewForm.decision === 'approved' ? 'Note (optional)' : 'Reason for rejection'}
                            fullWidth multiline rows={2}
                            value={reviewForm.note}
                            onChange={(e) => setReviewForm((rf) => ({ ...rf, note: e.target.value }))}
                        />
                    </Stack>
                </DialogContent>
                <DialogActions sx={{ px: 3, pb: 2 }}>
                    <Button onClick={() => setReview(null)}>Cancel</Button>
                    <Button
                        variant="contained"
                        color={reviewForm.decision === 'approved' ? 'success' : 'error'}
                        startIcon={reviewForm.decision === 'approved' ? <ThumbUpIcon /> : <ThumbDownIcon />}
                        onClick={handleReview}
                        disabled={saving}
                    >
                        {reviewForm.decision === 'approved' ? 'Approve' : 'Reject'}
                    </Button>
                </DialogActions>
            </Dialog>

            {/* ---- Print preview + print layout ---- */}
            <Dialog open={Boolean(print)} onClose={() => setPrint(null)} maxWidth="sm" fullWidth>
                <DialogTitle>Requisition form</DialogTitle>
                <DialogContent dividers>
                    <PrintPreview request={print} />
                </DialogContent>
                <DialogActions sx={{ px: 3, pb: 2 }}>
                    <Button onClick={() => setPrint(null)}>Close</Button>
                    <Button variant="contained" startIcon={<PrintIcon />} onClick={() => window.print()}>
                        Print
                    </Button>
                </DialogActions>
            </Dialog>

            {print &&
                createPortal(
                    <div id="store-print-area">
                        <PrintPreview request={print} printable />
                    </div>,
                    document.body
                )}

            <Snackbar open={Boolean(toast)} autoHideDuration={3000}
                onClose={() => setToast('')} message={toast}
                anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }} />
        </>
    );
}

function PrintPreview({ request, printable = false }) {
    if (!request) return null;

    const meta = STATUS_META[request.status] || STATUS_META.pending;
    const rows = request.items || [];

    const styles = printable
        ? {
              box: { fontFamily: 'Arial, sans-serif', color: '#000', fontSize: '12pt' },
              h1: { textAlign: 'center', fontSize: '16pt', margin: '4px 0' },
              sub: { textAlign: 'center', fontSize: '11pt', marginBottom: '14px' },
              table: { width: '100%', borderCollapse: 'collapse', margin: '10px 0' },
              th: { border: '1px solid #000', padding: '4px 8px', textAlign: 'left', background: '#eee' },
              td: { border: '1px solid #000', padding: '4px 8px' },
              sig: { display: 'flex', justifyContent: 'space-between', marginTop: '36px' },
          }
        : {};

    const dateStr = fmtDate(request.createdAt);

    return (
        <Box sx={printable ? styles.box : undefined}>
            <div style={styles.h1}>British International School — NOC Gerji Campus</div>
            <div style={styles.sub}>STORE REQUISITION FORM</div>

            <TableContainer component={Paper} variant="outlined" sx={{ mb: 2 }}>
                <Table size="small">
                    <TableBody>
                        <TableRow>
                            <TableCell sx={{ fontWeight: 600 }}>Request No</TableCell>
                            <TableCell>{request.requestNumber}</TableCell>
                            <TableCell sx={{ fontWeight: 600 }}>Date</TableCell>
                            <TableCell>{dateStr}</TableCell>
                        </TableRow>
                        <TableRow>
                            <TableCell sx={{ fontWeight: 600 }}>Requested by</TableCell>
                            <TableCell>{request.requester?.name}</TableCell>
                            <TableCell sx={{ fontWeight: 600 }}>Class</TableCell>
                            <TableCell>{request.class?.name || '—'}</TableCell>
                        </TableRow>
                        <TableRow>
                            <TableCell sx={{ fontWeight: 600 }}>Status</TableCell>
                            <TableCell colSpan={3}>
                                {meta.label.toUpperCase()}
                                {request.storeReviewer ? `  ·  Store: ${request.storeReviewer.name}` : ''}
                                {request.adminReviewer ? `  ·  Admin: ${request.adminReviewer.name}` : ''}
                            </TableCell>
                        </TableRow>
                        <TableRow>
                            <TableCell sx={{ fontWeight: 600 }}>Purpose</TableCell>
                            <TableCell colSpan={3}>{request.purpose || '—'}</TableCell>
                        </TableRow>
                    </TableBody>
                </Table>
            </TableContainer>

            <TableContainer component={Paper} variant="outlined">
                <Table size="small">
                    <TableHead>
                        <TableRow>
                            <TableCell sx={{ width: 34 }}>#</TableCell>
                            <TableCell>Item</TableCell>
                            <TableCell align="right" sx={{ width: 70 }}>Qty</TableCell>
                            <TableCell>Note</TableCell>
                        </TableRow>
                    </TableHead>
                    <TableBody>
                        {rows.map((it, i) => (
                            <TableRow key={i}>
                                <TableCell>{i + 1}</TableCell>
                                <TableCell>{it.item}</TableCell>
                                <TableCell align="right">{it.quantity}</TableCell>
                                <TableCell>{it.note}</TableCell>
                            </TableRow>
                        ))}
                        <TableRow>
                            <TableCell colSpan={2} sx={{ fontWeight: 600 }}>Total items</TableCell>
                            <TableCell align="right" sx={{ fontWeight: 600 }}>{itemTotal(rows)}</TableCell>
                            <TableCell />
                        </TableRow>
                    </TableBody>
                </Table>
            </TableContainer>

            <Stack direction="row" justifyContent="space-between" sx={{ mt: 5 }}>
                <Box>
                    <Divider sx={{ width: 180 }} />
                    <Typography variant="caption" color="text.secondary">Requested by</Typography>
                </Box>
                <Box>
                    <Divider sx={{ width: 180 }} />
                    <Typography variant="caption" color="text.secondary">Store manager</Typography>
                </Box>
                <Box>
                    <Divider sx={{ width: 180 }} />
                    <Typography variant="caption" color="text.secondary">Administrator</Typography>
                </Box>
            </Stack>
        </Box>
    );
}
