import { useCallback, useEffect, useRef, useState } from 'react';
import {
    Badge, Box, Button, Dialog, DialogActions, DialogContent, DialogTitle,
    Divider, FormControlLabel, IconButton, Menu, Switch, TextField, Tooltip,
    Typography,
} from '@mui/material';
import NotificationsNoneIcon from '@mui/icons-material/NotificationsNone';
import CampaignOutlinedIcon from '@mui/icons-material/CampaignOutlined';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { noticeApi, notificationApi } from '../api/endpoints';

/*
 * The notification bell — sits beside the teacher's name in every staff
 * header. One click shows everything worth an eyeball, newest first:
 *
 *  - announcements pushed by the office (from the Notices system), and
 *  - automatic nudges written by the system when something happens
 *    (a plan handed in, attendance submitted, a mark column opened, ...).
 *
 * The badge counts everything unread. Opening an item marks it read; items
 * sent with "must confirm" carry a 'Got it' button so the office can see
 * exactly who confirmed. Admins can also push a new announcement straight
 * from the menu. The feed refreshes every minute on its own.
 */

const POLL_MS = 60_000;

const relTime = (iso) => {
    const then = new Date(iso);
    if (Number.isNaN(then.getTime())) return String(iso || '');
    const mins = Math.round((Date.now() - then.getTime()) / 60_000);
    if (mins < 1) return 'just now';
    if (mins < 60) return `${mins} min ago`;
    const hours = Math.round(mins / 60);
    if (hours < 24) return `${hours} h ago`;
    const days = Math.round(hours / 24);
    return `${days} d ago`;
};

function BellItem({ item, onOpen, onAck }) {
    const unread = !item.readAt;
    return (
        <Box
            data-testid={`bell-item-${item.type}-${item.id}`}
            sx={{
                px: 2, py: 1.25, cursor: 'pointer',
                bgcolor: unread ? 'rgba(30,64,175,.05)' : 'transparent',
                '&:hover': { bgcolor: 'action.hover' },
            }}
            onClick={() => onOpen(item)}
        >
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                {item.type === 'announcement'
                    ? <CampaignOutlinedIcon sx={{ fontSize: 16, color: 'primary.main', flexShrink: 0 }} />
                    : <NotificationsNoneIcon sx={{ fontSize: 16, color: 'text.secondary', flexShrink: 0 }} />}
                <Typography sx={{
                    fontWeight: unread ? 800 : 600, fontSize: 13, flexGrow: 1,
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                }}>
                    {item.title}
                </Typography>
                {unread && (
                    <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: 'error.main', flexShrink: 0 }} />
                )}
            </Box>
            {item.body && (
                <Typography variant="caption" color="text.secondary" sx={{
                    display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical',
                    overflow: 'hidden', mt: 0.25, fontSize: 12,
                }}>
                    {item.body}
                </Typography>
            )}
            <Typography variant="caption" color="text.disabled" sx={{ display: 'block', mt: 0.25, fontSize: 11 }}>
                {item.type === 'announcement' && item.author?.name ? `${item.author.name} · ` : ''}{relTime(item.createdAt)}
            </Typography>
            {item.requiresAck && !item.acknowledgedAt && (
                <Button
                    size="small" variant="outlined"
                    data-testid={`bell-ack-${item.id}`}
                    onClick={(e) => { e.stopPropagation(); onAck(item); }}
                    sx={{ mt: 0.75, textTransform: 'none', fontWeight: 700, fontSize: 12, borderRadius: 1 }}
                >
                    Got it
                </Button>
            )}
        </Box>
    );
}

export default function NotificationBell() {
    const { user } = useAuth();
    const navigate = useNavigate();
    const isAdmin = user?.role === 'admin';

    const [feed, setFeed] = useState([]);
    const [unread, setUnread] = useState(0);
    const [anchor, setAnchor] = useState(null);
    const [composeOpen, setComposeOpen] = useState(false);
    const [form, setForm] = useState({ title: '', body: '', requiresAck: false });
    const [sending, setSending] = useState(false);
    const [sendError, setSendError] = useState('');
    const mounted = useRef(true);

    const refresh = useCallback(async () => {
        try {
            const data = await notificationApi.feed();
            if (!mounted.current) return;
            setFeed(data.notifications || []);
            setUnread(data.unreadCount || 0);
        } catch {
            /* the bell must never break the header around it */
        }
    }, []);

    useEffect(() => {
        mounted.current = true;
        refresh();
        const timer = setInterval(refresh, POLL_MS);
        return () => { mounted.current = false; clearInterval(timer); };
    }, [refresh]);

    const openMenu = (e) => { setAnchor(e.currentTarget); refresh(); };
    const closeMenu = () => setAnchor(null);

    const markLocallyRead = (id) => {
        setFeed((prev) => prev.map((n) => (n.id === id ? { ...n, readAt: new Date().toISOString() } : n)));
        setUnread((n) => Math.max(0, n - 1));
    };

    const handleOpenItem = async (item) => {
        if (!item.readAt) {
            markLocallyRead(item.id);
            try {
                if (item.type === 'announcement') await noticeApi.markRead(item.id, false);
                else await notificationApi.markRead(item.id);
            } catch { /* receipt timing is best-effort */ }
        }
        if (item.link) {
            closeMenu();
            navigate(item.link);
        }
    };

    const handleAck = async (item) => {
        try {
            const receipt = await noticeApi.markRead(item.id, true);
            setFeed((prev) => prev.map((n) => (n.id === item.id
                ? { ...n, readAt: receipt.readAt, acknowledgedAt: receipt.acknowledgedAt }
                : n)));
            if (!item.readAt) setUnread((n) => Math.max(0, n - 1));
        } catch { /* best-effort */ }
    };

    const handleSend = async () => {
        if (!form.title.trim() || !form.body.trim()) return;
        setSending(true);
        setSendError('');
        try {
            await noticeApi.create({
                title: form.title.trim(),
                body: form.body.trim(),
                requiresAck: form.requiresAck,
            });
            setComposeOpen(false);
            setForm({ title: '', body: '', requiresAck: false });
            await refresh();
        } catch {
            setSendError('Could not send — please try again.');
        } finally {
            setSending(false);
        }
    };

    return (
        <>
            <Tooltip title="Notifications">
                <IconButton
                    size="small"
                    aria-label="Notifications"
                    data-testid="notification-bell"
                    onClick={openMenu}
                    sx={{ color: 'text.secondary' }}
                >
                    <Badge badgeContent={unread} color="error" max={9} data-testid="notification-badge">
                        <NotificationsNoneIcon sx={{ fontSize: 22 }} />
                    </Badge>
                </IconButton>
            </Tooltip>

            <Menu
                anchorEl={anchor} open={Boolean(anchor)} onClose={closeMenu}
                data-testid="notification-menu"
                PaperProps={{ sx: { width: 340, maxWidth: '92vw', maxHeight: 480 } }}
                anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
                transformOrigin={{ vertical: 'top', horizontal: 'right' }}
            >
                <Box sx={{ px: 2, py: 1.25, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <Typography sx={{ fontWeight: 800, fontSize: 14 }}>Notifications</Typography>
                    {isAdmin && (
                        <Button
                            size="small"
                            data-testid="bell-compose-open"
                            onClick={() => { closeMenu(); setComposeOpen(true); }}
                            sx={{ textTransform: 'none', fontWeight: 700, fontSize: 12 }}
                        >
                            Push announcement
                        </Button>
                    )}
                </Box>
                <Divider />
                {feed.length === 0 ? (
                    <Box sx={{ px: 2, py: 4, textAlign: 'center' }} data-testid="bell-empty">
                        <Typography variant="body2" color="text.secondary">
                            Nothing new — you're all caught up.
                        </Typography>
                    </Box>
                ) : (
                    <Box sx={{ maxHeight: 380, overflowY: 'auto' }}>
                        {feed.map((item) => (
                            <BellItem key={`${item.type}-${item.id}`} item={item} onOpen={handleOpenItem} onAck={handleAck} />
                        ))}
                    </Box>
                )}
                <Divider />
                <Box sx={{ px: 2, py: 1 }}>
                    <Button
                        size="small" fullWidth
                        data-testid="bell-view-all"
                        onClick={() => { closeMenu(); navigate('/app/notices'); }}
                        sx={{ textTransform: 'none', fontWeight: 700, fontSize: 12 }}
                    >
                        View all announcements
                    </Button>
                </Box>
            </Menu>

            <Dialog
                open={composeOpen} onClose={() => setComposeOpen(false)}
                fullWidth maxWidth="sm" data-testid="bell-compose"
            >
                <DialogTitle sx={{ fontWeight: 800 }}>Push an announcement</DialogTitle>
                <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: '8px !important' }}>
                    <TextField
                        label="Title" size="small" fullWidth
                        data-testid="bell-compose-title"
                        value={form.title}
                        onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                    />
                    <TextField
                        label="Message" size="small" fullWidth multiline minRows={3}
                        data-testid="bell-compose-body"
                        value={form.body}
                        onChange={(e) => setForm((f) => ({ ...f, body: e.target.value }))}
                    />
                    <FormControlLabel
                        control={(
                            <Switch
                                checked={form.requiresAck}
                                onChange={(e) => setForm((f) => ({ ...f, requiresAck: e.target.checked }))}
                            />
                        )}
                        label="Must confirm — teachers tap 'Got it' so you can see who has"
                    />
                    {sendError && (
                        <Typography variant="caption" color="error">{sendError}</Typography>
                    )}
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setComposeOpen(false)}>Cancel</Button>
                    <Button
                        variant="contained"
                        data-testid="bell-compose-send"
                        disabled={sending || !form.title.trim() || !form.body.trim()}
                        onClick={handleSend}
                    >
                        {sending ? 'Sending…' : 'Send to all staff'}
                    </Button>
                </DialogActions>
            </Dialog>
        </>
    );
}
