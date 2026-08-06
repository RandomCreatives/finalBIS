import { useEffect, useRef, useState } from 'react';
import {
    Alert, Autocomplete, Avatar, Badge, Box, Button, Card, Chip, Dialog, DialogActions,
    DialogContent, DialogTitle, Divider, IconButton, List, ListItemButton, MenuItem, Paper,
    Stack, TextField, Tooltip, Typography,
} from '@mui/material';
import AddCommentIcon from '@mui/icons-material/AddComment';
import SendIcon from '@mui/icons-material/Send';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ReplayIcon from '@mui/icons-material/Replay';
import { threadApi, userApi, studentApi, classApi } from '../api/endpoints';
import useApi from '../hooks/useApi';
import PageHeader from '../components/PageHeader';
import DataState from '../components/DataState';
import { useAuth } from '../auth/AuthContext';

const PRIORITY_COLOR = { high: 'error', normal: 'default', low: 'info' };

const timeAgo = (iso) => {
    const diff = Date.now() - new Date(iso).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'just now';
    if (mins < 60) return `${mins}m ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h ago`;
    return new Date(iso).toLocaleDateString();
};

export default function Messages() {
    const { user, isAdmin } = useAuth();

    const [statusFilter, setStatusFilter] = useState('open');
    const [selectedId, setSelectedId] = useState(null);
    const [reply, setReply] = useState('');
    const [sending, setSending] = useState(false);
    const [compose, setCompose] = useState(null);
    const [formError, setFormError] = useState('');
    const bottomRef = useRef(null);

    const threads = useApi(() => threadApi.list({ status: statusFilter }), [statusFilter]);
    const conversation = useApi(
        () => (selectedId ? threadApi.get(selectedId) : Promise.resolve(null)),
        [selectedId]
    );

    // Admins can address anyone; teachers reach the office and each other.
    const staff = useApi(() => (isAdmin ? userApi.list() : Promise.resolve([])), [isAdmin]);
    const students = useApi(() => studentApi.list(), []);
    const classes = useApi(() => classApi.list(), []);

    useEffect(() => {
        bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [conversation.data]);

    // Light polling keeps the inbox current without extra infrastructure.
    useEffect(() => {
        const id = setInterval(() => {
            threads.reload();
            if (selectedId) conversation.reload();
        }, 30000);
        return () => clearInterval(id);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [selectedId, statusFilter]);

    const handleReply = async () => {
        if (!reply.trim()) return;
        setSending(true);
        try {
            await threadApi.reply(selectedId, reply.trim());
            setReply('');
            conversation.reload();
            threads.reload();
        } catch (err) {
            setFormError(err.message);
        } finally {
            setSending(false);
        }
    };

    const handleCompose = async () => {
        setSending(true);
        setFormError('');
        try {
            const created = await threadApi.create({
                subject: compose.subject.trim(),
                body: compose.body.trim(),
                participantIds: compose.participants.map((p) => p.id),
                studentId: compose.studentId || null,
                classId: compose.classId || null,
                category: compose.category,
                priority: compose.priority,
            });
            setCompose(null);
            threads.reload();
            setSelectedId(created.id);
        } catch (err) {
            setFormError(err.message);
        } finally {
            setSending(false);
        }
    };

    const toggleResolved = async () => {
        const next = conversation.data.thread.status === 'open' ? 'resolved' : 'open';
        await threadApi.update(selectedId, { status: next });
        conversation.reload();
        threads.reload();
    };

    const rows = threads.data || [];
    const active = conversation.data;

    return (
        <>
            <PageHeader
                title="Messages"
                subtitle="Conversations between the office and teaching staff."
                action={
                    <Button
                        variant="contained"
                        startIcon={<AddCommentIcon />}
                        onClick={() => {
                            setFormError('');
                            setCompose({
                                subject: '', body: '', participants: [],
                                studentId: '', classId: '', category: 'general', priority: 'normal',
                            });
                        }}
                    >
                        New conversation
                    </Button>
                }
            />

            <Stack direction={{ xs: 'column', md: 'row' }} spacing={2.5} sx={{ height: { md: '70vh' } }}>
                {/* Inbox ------------------------------------------------------- */}
                <Card sx={{ width: { xs: '100%', md: 340 }, display: 'flex', flexDirection: 'column' }}>
                    <Box sx={{ p: 1.5 }}>
                        <TextField
                            select size="small" fullWidth
                            value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}
                        >
                            <MenuItem value="open">Open</MenuItem>
                            <MenuItem value="resolved">Resolved</MenuItem>
                        </TextField>
                    </Box>
                    <Divider />
                    <Box sx={{ overflowY: 'auto', flexGrow: 1 }}>
                        <DataState
                            loading={threads.loading}
                            error={threads.error}
                            empty={rows.length === 0}
                            emptyMessage={statusFilter === 'open' ? 'No open conversations.' : 'Nothing resolved yet.'}
                        >
                            <List disablePadding>
                                {rows.map((t) => (
                                    <ListItemButton
                                        key={t.id}
                                        selected={t.id === selectedId}
                                        onClick={() => setSelectedId(t.id)}
                                        sx={{ alignItems: 'flex-start', py: 1.5 }}
                                    >
                                        <Box sx={{ width: '100%', minWidth: 0 }}>
                                            <Stack direction="row" alignItems="center" spacing={1}>
                                                <Badge
                                                    color="primary"
                                                    badgeContent={t.unreadCount}
                                                    invisible={!t.unreadCount}
                                                    sx={{ '& .MuiBadge-badge': { right: -3 } }}
                                                >
                                                    <Typography
                                                        variant="body2"
                                                        noWrap
                                                        sx={{ fontWeight: t.unreadCount ? 700 : 500, maxWidth: 210 }}
                                                    >
                                                        {t.subject}
                                                    </Typography>
                                                </Badge>
                                                {t.priority === 'high' && (
                                                    <Chip label="High" size="small" color="error" sx={{ height: 18, fontSize: 10 }} />
                                                )}
                                            </Stack>
                                            {(t.student || t.class) && (
                                                <Typography variant="caption" color="primary.main" display="block">
                                                    {t.student?.name || t.class?.name}
                                                </Typography>
                                            )}
                                            <Typography variant="caption" color="text.secondary">
                                                {timeAgo(t.lastMessageAt)}
                                            </Typography>
                                        </Box>
                                    </ListItemButton>
                                ))}
                            </List>
                        </DataState>
                    </Box>
                </Card>

                {/* Conversation ------------------------------------------------ */}
                <Card sx={{ flexGrow: 1, display: 'flex', flexDirection: 'column', minHeight: 420 }}>
                    {!selectedId ? (
                        <Box sx={{ m: 'auto', textAlign: 'center', p: 4 }}>
                            <Typography color="text.secondary">
                                Select a conversation, or start a new one.
                            </Typography>
                        </Box>
                    ) : (
                        <DataState loading={conversation.loading} error={conversation.error}>
                            {active && (
                                <>
                                    <Box sx={{ p: 2 }}>
                                        <Stack direction="row" justifyContent="space-between" alignItems="flex-start">
                                            <Box>
                                                <Typography variant="h6">{active.thread.subject}</Typography>
                                                <Stack direction="row" spacing={1} sx={{ mt: 0.5 }} flexWrap="wrap" useFlexGap>
                                                    <Chip size="small" label={active.thread.category} variant="outlined" />
                                                    <Chip
                                                        size="small"
                                                        label={active.thread.priority}
                                                        color={PRIORITY_COLOR[active.thread.priority]}
                                                        variant="outlined"
                                                    />
                                                    {active.thread.student && (
                                                        <Chip size="small" color="primary" variant="outlined"
                                                            label={`Student: ${active.thread.student.name}`} />
                                                    )}
                                                    {active.thread.class && (
                                                        <Chip size="small" color="primary" variant="outlined"
                                                            label={`Class: ${active.thread.class.name}`} />
                                                    )}
                                                </Stack>
                                            </Box>
                                            <Tooltip title={active.thread.status === 'open' ? 'Mark resolved' : 'Reopen'}>
                                                <IconButton onClick={toggleResolved}>
                                                    {active.thread.status === 'open'
                                                        ? <CheckCircleIcon color="success" />
                                                        : <ReplayIcon />}
                                                </IconButton>
                                            </Tooltip>
                                        </Stack>
                                    </Box>
                                    <Divider />

                                    <Box sx={{ flexGrow: 1, overflowY: 'auto', p: 2 }}>
                                        <Stack spacing={1.5}>
                                            {active.messages.map((m) => {
                                                const mine = m.sender?.id === user?.id;
                                                return (
                                                    <Stack
                                                        key={m.id}
                                                        direction="row"
                                                        spacing={1}
                                                        justifyContent={mine ? 'flex-end' : 'flex-start'}
                                                    >
                                                        {!mine && (
                                                            <Avatar sx={{ width: 30, height: 30, fontSize: 13 }}>
                                                                {m.sender?.name?.charAt(0)}
                                                            </Avatar>
                                                        )}
                                                        <Paper
                                                            variant="outlined"
                                                            sx={{
                                                                p: 1.25, maxWidth: '72%',
                                                                bgcolor: mine ? 'primary.main' : 'grey.50',
                                                                color: mine ? 'common.white' : 'text.primary',
                                                                borderColor: mine ? 'primary.main' : 'divider',
                                                            }}
                                                        >
                                                            {!mine && (
                                                                <Typography variant="caption" sx={{ fontWeight: 600 }}>
                                                                    {m.sender?.name}
                                                                </Typography>
                                                            )}
                                                            <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>
                                                                {m.body}
                                                            </Typography>
                                                            <Typography
                                                                variant="caption"
                                                                sx={{ opacity: 0.7, display: 'block', mt: 0.5 }}
                                                            >
                                                                {timeAgo(m.created_at)}
                                                            </Typography>
                                                        </Paper>
                                                    </Stack>
                                                );
                                            })}
                                            <div ref={bottomRef} />
                                        </Stack>
                                    </Box>

                                    <Divider />
                                    <Box sx={{ p: 1.5 }}>
                                        {formError && <Alert severity="error" sx={{ mb: 1 }}>{formError}</Alert>}
                                        <Stack direction="row" spacing={1}>
                                            <TextField
                                                fullWidth size="small" multiline maxRows={4}
                                                placeholder="Write a reply…"
                                                value={reply}
                                                onChange={(e) => setReply(e.target.value)}
                                                onKeyDown={(e) => {
                                                    if (e.key === 'Enter' && !e.shiftKey) {
                                                        e.preventDefault();
                                                        handleReply();
                                                    }
                                                }}
                                            />
                                            <Button
                                                variant="contained"
                                                onClick={handleReply}
                                                disabled={sending || !reply.trim()}
                                                sx={{ minWidth: 48, px: 0 }}
                                            >
                                                <SendIcon fontSize="small" />
                                            </Button>
                                        </Stack>
                                    </Box>
                                </>
                            )}
                        </DataState>
                    )}
                </Card>
            </Stack>

            {/* Compose --------------------------------------------------------- */}
            <Dialog open={Boolean(compose)} onClose={() => setCompose(null)} maxWidth="sm" fullWidth>
                <DialogTitle>New conversation</DialogTitle>
                <DialogContent>
                    {formError && <Alert severity="error" sx={{ mb: 2 }}>{formError}</Alert>}
                    {compose && (
                        <Stack spacing={2} sx={{ mt: 1 }}>
                            <Autocomplete
                                multiple
                                options={(staff.data || []).filter((s) => s.id !== user?.id)}
                                getOptionLabel={(o) => `${o.name} (${o.role.replace(/_/g, ' ')})`}
                                value={compose.participants}
                                onChange={(_, value) => setCompose((c) => ({ ...c, participants: value }))}
                                renderInput={(params) => (
                                    <TextField
                                        {...params}
                                        label="To"
                                        required
                                        helperText={
                                            isAdmin ? undefined : 'Ask your administrator to start a thread if the recipient is not listed.'
                                        }
                                    />
                                )}
                            />
                            <TextField
                                label="Subject" required fullWidth
                                value={compose.subject}
                                onChange={(e) => setCompose((c) => ({ ...c, subject: e.target.value }))}
                            />
                            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
                                <TextField
                                    select label="Category" fullWidth
                                    value={compose.category}
                                    onChange={(e) => setCompose((c) => ({ ...c, category: e.target.value }))}
                                >
                                    {['general', 'student', 'class', 'academic', 'welfare', 'admin'].map((c) => (
                                        <MenuItem key={c} value={c}>{c}</MenuItem>
                                    ))}
                                </TextField>
                                <TextField
                                    select label="Priority" fullWidth
                                    value={compose.priority}
                                    onChange={(e) => setCompose((c) => ({ ...c, priority: e.target.value }))}
                                >
                                    <MenuItem value="low">Low</MenuItem>
                                    <MenuItem value="normal">Normal</MenuItem>
                                    <MenuItem value="high">High</MenuItem>
                                </TextField>
                            </Stack>
                            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
                                <TextField
                                    select label="About student (optional)" fullWidth
                                    value={compose.studentId}
                                    onChange={(e) => setCompose((c) => ({ ...c, studentId: e.target.value }))}
                                >
                                    <MenuItem value="">None</MenuItem>
                                    {(students.data || []).map((s) => (
                                        <MenuItem key={s.id} value={s.id}>{s.name}</MenuItem>
                                    ))}
                                </TextField>
                                <TextField
                                    select label="About class (optional)" fullWidth
                                    value={compose.classId}
                                    onChange={(e) => setCompose((c) => ({ ...c, classId: e.target.value }))}
                                >
                                    <MenuItem value="">None</MenuItem>
                                    {(classes.data || []).map((c) => (
                                        <MenuItem key={c.id} value={c.id}>{c.name}</MenuItem>
                                    ))}
                                </TextField>
                            </Stack>
                            <TextField
                                label="Message" required fullWidth multiline rows={4}
                                value={compose.body}
                                onChange={(e) => setCompose((c) => ({ ...c, body: e.target.value }))}
                            />
                        </Stack>
                    )}
                </DialogContent>
                <DialogActions sx={{ px: 3, pb: 2 }}>
                    <Button onClick={() => setCompose(null)}>Cancel</Button>
                    <Button
                        variant="contained" onClick={handleCompose}
                        disabled={
                            sending || !compose?.subject?.trim() || !compose?.body?.trim() ||
                            compose?.participants?.length === 0
                        }
                    >
                        Send
                    </Button>
                </DialogActions>
            </Dialog>
        </>
    );
}
