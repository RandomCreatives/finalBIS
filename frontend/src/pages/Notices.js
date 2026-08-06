import { useState } from 'react';
import {
    Alert, Box, Button, Card, CardContent, Chip, Dialog, DialogActions, DialogContent,
    DialogTitle, FormControlLabel, IconButton, List, ListItem, ListItemText, MenuItem,
    Snackbar, Stack, Switch, TextField, Tooltip, Typography,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import PushPinIcon from '@mui/icons-material/PushPin';
import VisibilityIcon from '@mui/icons-material/Visibility';
import { noticeApi } from '../api/endpoints';
import useApi from '../hooks/useApi';
import PageHeader from '../components/PageHeader';
import DataState from '../components/DataState';
import { useAuth } from '../auth/AuthContext';

const AUDIENCES = [
    { value: 'all', label: 'All staff' },
    { value: 'main_teacher', label: 'Main teachers' },
    { value: 'assistant_teacher', label: 'Assistant teachers' },
    { value: 'subject_teacher', label: 'Subject teachers' },
];

const audienceLabel = (v) => AUDIENCES.find((a) => a.value === v)?.label || v;

export default function Notices() {
    const { user, isAdmin } = useAuth();
    const canPost = ['admin', 'main_teacher'].includes(user?.role);

    const [dialog, setDialog] = useState(null);
    const [receipts, setReceipts] = useState(null);
    const [saving, setSaving] = useState(false);
    const [formError, setFormError] = useState('');
    const [toast, setToast] = useState('');

    const notices = useApi(() => noticeApi.list(), []);

    const handleSave = async () => {
        setSaving(true);
        setFormError('');
        try {
            const payload = {
                title: dialog.title.trim(),
                body: dialog.body.trim(),
                audience: dialog.audience,
                requiresAck: dialog.requiresAck,
                isPinned: dialog.isPinned,
            };
            if (dialog.id) {
                await noticeApi.update(dialog.id, payload);
                setToast('Notice updated');
            } else {
                await noticeApi.create(payload);
                setToast('Notice posted');
            }
            setDialog(null);
            notices.reload();
        } catch (err) {
            setFormError(err.message);
        } finally {
            setSaving(false);
        }
    };

    const acknowledge = async (notice) => {
        try {
            await noticeApi.markRead(notice.id, true);
            setToast('Acknowledged');
            notices.reload();
        } catch (err) {
            setToast(err.message);
        }
    };

    const openReceipts = async (notice) => {
        try {
            setReceipts(await noticeApi.receipts(notice.id));
        } catch (err) {
            setToast(err.message);
        }
    };

    const remove = async (notice) => {
        try {
            await noticeApi.remove(notice.id);
            setToast('Notice deleted');
            notices.reload();
        } catch (err) {
            setToast(err.message);
        }
    };

    const rows = notices.data || [];

    return (
        <>
            <PageHeader
                title="Notices"
                subtitle="Announcements, with confirmation of who has read them."
                action={canPost && (
                    <Button
                        variant="contained" startIcon={<AddIcon />}
                        onClick={() => {
                            setFormError('');
                            setDialog({
                                title: '', body: '', audience: 'all',
                                requiresAck: false, isPinned: false,
                            });
                        }}
                    >
                        Post notice
                    </Button>
                )}
            />

            <DataState
                loading={notices.loading}
                error={notices.error}
                empty={rows.length === 0}
                emptyMessage="No notices have been posted."
            >
                <Stack spacing={2}>
                    {rows.map((n) => {
                        const needsAck = n.requiresAck && !n.acknowledgedAt;
                        return (
                            <Card
                                key={n.id}
                                sx={{ borderLeft: 4, borderLeftColor: needsAck ? 'warning.main' : 'transparent' }}
                            >
                                <CardContent>
                                    <Stack direction="row" justifyContent="space-between" alignItems="flex-start">
                                        <Box sx={{ minWidth: 0 }}>
                                            <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
                                                {n.isPinned && <PushPinIcon fontSize="small" color="primary" />}
                                                <Typography variant="h6">{n.title}</Typography>
                                                {n.audience !== 'all' && (
                                                    <Chip size="small" label={audienceLabel(n.audience)} variant="outlined" />
                                                )}
                                            </Stack>
                                            <Typography variant="caption" color="text.secondary">
                                                {n.postedOn}{n.author?.name ? ` · ${n.author.name}` : ''}
                                            </Typography>
                                        </Box>

                                        <Stack direction="row">
                                            {isAdmin && (
                                                <Tooltip title="Who has read this">
                                                    <IconButton size="small" onClick={() => openReceipts(n)}>
                                                        <VisibilityIcon fontSize="small" />
                                                    </IconButton>
                                                </Tooltip>
                                            )}
                                            {canPost && (
                                                <Tooltip title="Edit">
                                                    <IconButton
                                                        size="small"
                                                        onClick={() => {
                                                            setFormError('');
                                                            setDialog({
                                                                id: n.id, title: n.title, body: n.body,
                                                                audience: n.audience, requiresAck: n.requiresAck,
                                                                isPinned: n.isPinned,
                                                            });
                                                        }}
                                                    >
                                                        <EditIcon fontSize="small" />
                                                    </IconButton>
                                                </Tooltip>
                                            )}
                                            {isAdmin && (
                                                <Tooltip title="Delete">
                                                    <IconButton size="small" onClick={() => remove(n)}>
                                                        <DeleteIcon fontSize="small" />
                                                    </IconButton>
                                                </Tooltip>
                                            )}
                                        </Stack>
                                    </Stack>

                                    <Typography variant="body2" sx={{ mt: 1.5, whiteSpace: 'pre-wrap' }}>
                                        {n.body}
                                    </Typography>

                                    <Stack direction="row" spacing={1.5} alignItems="center" sx={{ mt: 2 }} flexWrap="wrap" useFlexGap>
                                        {needsAck && (
                                            <Button size="small" variant="contained" color="warning" onClick={() => acknowledge(n)}>
                                                Acknowledge
                                            </Button>
                                        )}
                                        {n.requiresAck && n.acknowledgedAt && (
                                            <Chip size="small" color="success" variant="outlined" label="You acknowledged this" />
                                        )}
                                        {n.stats && (
                                            <Typography variant="caption" color="text.secondary">
                                                Read by {n.stats.readCount} of {n.stats.audienceSize}
                                                {n.requiresAck ? ` · ${n.stats.ackCount} acknowledged` : ''}
                                            </Typography>
                                        )}
                                    </Stack>
                                </CardContent>
                            </Card>
                        );
                    })}
                </Stack>
            </DataState>

            {/* Compose / edit --------------------------------------------------- */}
            <Dialog open={Boolean(dialog)} onClose={() => setDialog(null)} maxWidth="sm" fullWidth>
                <DialogTitle>{dialog?.id ? 'Edit notice' : 'Post a notice'}</DialogTitle>
                <DialogContent>
                    {formError && <Alert severity="error" sx={{ mb: 2 }}>{formError}</Alert>}
                    <Stack spacing={2} sx={{ mt: 1 }}>
                        <TextField
                            label="Title" required fullWidth autoFocus
                            value={dialog?.title || ''}
                            onChange={(e) => setDialog((d) => ({ ...d, title: e.target.value }))}
                        />
                        <TextField
                            select label="Audience" fullWidth
                            value={dialog?.audience || 'all'}
                            onChange={(e) => setDialog((d) => ({ ...d, audience: e.target.value }))}
                        >
                            {AUDIENCES.map((a) => (
                                <MenuItem key={a.value} value={a.value}>{a.label}</MenuItem>
                            ))}
                        </TextField>
                        <TextField
                            label="Message" required fullWidth multiline rows={5}
                            value={dialog?.body || ''}
                            onChange={(e) => setDialog((d) => ({ ...d, body: e.target.value }))}
                        />
                        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
                            <FormControlLabel
                                control={
                                    <Switch
                                        checked={dialog?.requiresAck || false}
                                        onChange={(e) => setDialog((d) => ({ ...d, requiresAck: e.target.checked }))}
                                    />
                                }
                                label="Require acknowledgement"
                            />
                            <FormControlLabel
                                control={
                                    <Switch
                                        checked={dialog?.isPinned || false}
                                        onChange={(e) => setDialog((d) => ({ ...d, isPinned: e.target.checked }))}
                                    />
                                }
                                label="Pin to top"
                            />
                        </Stack>
                    </Stack>
                </DialogContent>
                <DialogActions sx={{ px: 3, pb: 2 }}>
                    <Button onClick={() => setDialog(null)}>Cancel</Button>
                    <Button
                        variant="contained" onClick={handleSave}
                        disabled={saving || !dialog?.title?.trim() || !dialog?.body?.trim()}
                    >
                        Save
                    </Button>
                </DialogActions>
            </Dialog>

            {/* Receipts --------------------------------------------------------- */}
            <Dialog open={Boolean(receipts)} onClose={() => setReceipts(null)} maxWidth="xs" fullWidth>
                <DialogTitle>Read receipts</DialogTitle>
                <DialogContent>
                    <Typography variant="body2" color="text.secondary" gutterBottom>
                        {receipts?.notice?.title}
                    </Typography>
                    <List dense>
                        {(receipts?.recipients || []).map((r) => (
                            <ListItem key={r.id} disableGutters divider>
                                <ListItemText
                                    primary={r.name}
                                    secondary={r.role.replace(/_/g, ' ')}
                                />
                                {r.acknowledgedAt ? (
                                    <Chip size="small" color="success" label="Acknowledged" />
                                ) : r.readAt ? (
                                    <Chip size="small" variant="outlined" label="Read" />
                                ) : (
                                    <Chip size="small" variant="outlined" color="warning" label="Unread" />
                                )}
                            </ListItem>
                        ))}
                    </List>
                </DialogContent>
                <DialogActions sx={{ px: 3, pb: 2 }}>
                    <Button onClick={() => setReceipts(null)}>Close</Button>
                </DialogActions>
            </Dialog>

            <Snackbar open={Boolean(toast)} autoHideDuration={3000}
                onClose={() => setToast('')} message={toast}
                anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }} />
        </>
    );
}
