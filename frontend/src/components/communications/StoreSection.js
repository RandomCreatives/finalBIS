import { useState } from 'react';
import {
    Alert, Box, Button, Chip, Dialog, DialogActions, DialogContent, DialogTitle,
    Divider, IconButton, Paper, Snackbar, TextField, Tooltip, Typography,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import AddShoppingCartIcon from '@mui/icons-material/AddShoppingCart';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import StorefrontOutlinedIcon from '@mui/icons-material/StorefrontOutlined';
import useApi from '../../hooks/useApi';
import { storeApi } from '../../api/endpoints';

/*
 * Store (Admin Communications) — a class's material requests.
 *
 * Teachers list the materials their class needs (item, quantity, note) and
 * send the request through the existing two-stage store pipeline: the
 * school store reviews first (an admin can stand in), then an admin gives
 * the final approval. The review queue itself lives on the admin Store page.
 */

export const STORE_STATUS_META = {
    pending: { label: 'Pending', color: 'warning' },
    store_approved: { label: 'Store approved', color: 'info' },
    approved: { label: 'Approved', color: 'success' },
    rejected: { label: 'Rejected', color: 'error' },
};

const emptyItem = () => ({ item: '', quantity: 1, note: '' });

const itemSummary = (items) =>
    (items || [])
        .slice(0, 3)
        .map((it) => `${it.item} ×${it.quantity}`)
        .join(', ') + ((items || []).length > 3 ? ` +${items.length - 3} more` : '');

export default function StoreSection({ klass, classId }) {
    const requests = useApi(() => storeApi.list(), []);

    const [dialog, setDialog] = useState(false);
    const [purpose, setPurpose] = useState('');
    const [items, setItems] = useState([emptyItem()]);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');
    const [toast, setToast] = useState('');

    const openDialog = () => {
        setPurpose('');
        setItems([emptyItem()]);
        setError('');
        setDialog(true);
    };

    const patchItem = (i, patch) =>
        setItems((cur) => cur.map((it, idx) => (idx === i ? { ...it, ...patch } : it)));

    const filled = items.filter((it) => it.item.trim() && Number(it.quantity) > 0);
    const valid = purpose.trim().length > 0 && filled.length > 0;

    const submit = async () => {
        if (!valid || saving) return;
        setSaving(true);
        setError('');
        try {
            await storeApi.create({
                classId,
                purpose: purpose.trim(),
                items: filled.map((it) => ({
                    item: it.item.trim(),
                    quantity: Number(it.quantity) || 1,
                    note: String(it.note || '').trim(),
                })),
            });
            setDialog(false);
            setToast('Request sent to the school store');
            requests.reload();
        } catch (err) {
            setError(err.message || 'Could not send the request');
        } finally {
            setSaving(false);
        }
    };

    return (
        <Box>
            <Box sx={{ display: 'flex', alignItems: { xs: 'stretch', sm: 'center' }, gap: 1.5, mb: 2.5,
                flexDirection: { xs: 'column', sm: 'row' } }}>
                <Typography sx={{ fontSize: 13, color: 'text.secondary', flexGrow: 1 }}>
                    List the materials <strong>{klass.name}</strong> needs — the school store
                    reviews first, then the admin approves. You'll see the status update here.
                </Typography>
                <Button variant="contained" disableElevation startIcon={<AddShoppingCartIcon sx={{ fontSize: 17 }} />}
                    onClick={openDialog}
                    sx={{ fontWeight: 700, textTransform: 'none', borderRadius: 2, whiteSpace: 'nowrap' }}>
                    New material request
                </Button>
            </Box>

            {requests.error && <Alert severity="error">Could not load your requests — please refresh.</Alert>}

            {!requests.loading && !requests.error && (requests.data || []).length === 0 && (
                <Paper variant="outlined" sx={{ p: 3.5, borderRadius: 2, textAlign: 'center',
                    borderStyle: 'dashed' }}>
                    <StorefrontOutlinedIcon sx={{ fontSize: 30, color: 'text.disabled', mb: 0.5 }} />
                    <Typography sx={{ fontWeight: 700, mb: 0.5 }}>Nothing requested yet</Typography>
                    <Typography variant="body2" color="text.secondary">
                        Chalk, A4 paper, paint, glue… send your first material list with the button above.
                    </Typography>
                </Paper>
            )}

            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                {(requests.data || []).map((r) => {
                    const meta = STORE_STATUS_META[r.status] || STORE_STATUS_META.pending;
                    return (
                        <Paper key={r.id} variant="outlined" sx={{ p: 1.75, borderRadius: 2 }}>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25, flexWrap: 'wrap' }}>
                                <Typography sx={{ fontWeight: 800, fontSize: 12.5,
                                    fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
                                    letterSpacing: '.02em' }}>
                                    {r.requestNumber}
                                </Typography>
                                <Chip size="small" label={meta.label} color={meta.color}
                                    sx={{ fontWeight: 700, height: 20, fontSize: 10.5 }} />
                                <Typography variant="caption" color="text.secondary" sx={{ ml: 'auto' }}>
                                    {new Date(r.createdAt).toLocaleDateString(undefined,
                                        { day: 'numeric', month: 'short' })}
                                </Typography>
                            </Box>
                            <Typography sx={{ fontSize: 13.5, fontWeight: 600, mt: 0.75 }}>
                                {r.purpose}
                            </Typography>
                            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.25 }}>
                                {itemSummary(r.items)}
                            </Typography>
                            {(r.status === 'rejected' && (r.storeReviewNote || r.adminReviewNote)) && (
                                <Alert severity="error" sx={{ mt: 1, py: 0 }}>
                                    {r.adminReviewNote || r.storeReviewNote}
                                </Alert>
                            )}
                        </Paper>
                    );
                })}
            </Box>

            {/* new request dialog */}
            <Dialog open={dialog} onClose={() => !saving && setDialog(false)} maxWidth="sm" fullWidth>
                <DialogTitle sx={{ fontWeight: 800 }}>
                    New material request
                    <Typography variant="caption" color="text.secondary" sx={{ display: 'block', fontWeight: 600 }}>
                        {klass.name} · goes to the school store, then the admin
                    </Typography>
                </DialogTitle>
                <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 1 }}>
                    {error && <Alert severity="error">{error}</Alert>}
                    <TextField label="What is it for? *" size="small" fullWidth
                        placeholder="e.g. Art week supplies, classroom stationery"
                        value={purpose} onChange={(e) => setPurpose(e.target.value)} />
                    <Box>
                        <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                            <Typography sx={{ fontWeight: 800, fontSize: 12, flexGrow: 1,
                                textTransform: 'uppercase', letterSpacing: '.05em', color: 'text.secondary' }}>
                                Items
                            </Typography>
                            <Button size="small" startIcon={<AddIcon sx={{ fontSize: 15 }} />}
                                onClick={() => setItems((cur) => [...cur, emptyItem()])}
                                sx={{ textTransform: 'none', fontWeight: 700 }}>
                                Add item
                            </Button>
                        </Box>
                        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                            {items.map((it, i) => (
                                <Box key={i} sx={{ display: 'flex', gap: 1, alignItems: 'flex-start',
                                    flexDirection: { xs: 'column', sm: 'row' } }}>
                                    <TextField size="small" label="Item *" value={it.item}
                                        onChange={(e) => patchItem(i, { item: e.target.value })}
                                        sx={{ flexGrow: 1 }} fullWidth />
                                    <TextField size="small" label="Qty *" type="number" value={it.quantity}
                                        onChange={(e) => patchItem(i, { quantity: e.target.value })}
                                        inputProps={{ min: 1, max: 999 }}
                                        sx={{ width: { xs: '100%', sm: 90 } }} />
                                    <TextField size="small" label="Note (color, size…)" value={it.note}
                                        onChange={(e) => patchItem(i, { note: e.target.value })}
                                        sx={{ flexGrow: 1 }} fullWidth />
                                    <Tooltip title="Remove item">
                                        <span>
                                            <IconButton size="small" disabled={items.length === 1}
                                                aria-label={`Remove item ${i + 1}`}
                                                onClick={() => setItems((cur) => cur.filter((_, idx) => idx !== i))}
                                                sx={{ mt: 0.25 }}>
                                                <DeleteOutlineIcon sx={{ fontSize: 18 }} />
                                            </IconButton>
                                        </span>
                                    </Tooltip>
                                </Box>
                            ))}
                        </Box>
                    </Box>
                </DialogContent>
                <Divider />
                <DialogActions sx={{ px: 3, py: 2 }}>
                    <Button onClick={() => setDialog(false)} disabled={saving}
                        sx={{ textTransform: 'none' }}>
                        Cancel
                    </Button>
                    <Button variant="contained" disableElevation onClick={submit}
                        disabled={!valid || saving}
                        sx={{ textTransform: 'none', fontWeight: 700 }}>
                        {saving ? 'Sending…' : `Send request (${filled.length} ${filled.length === 1 ? 'item' : 'items'})`}
                    </Button>
                </DialogActions>
            </Dialog>

            <Snackbar open={Boolean(toast)} autoHideDuration={3200}
                onClose={() => setToast('')} message={toast} />
        </Box>
    );
}
