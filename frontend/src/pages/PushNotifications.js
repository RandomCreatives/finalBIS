import { Box, Button, Card, CardContent, Chip, FormControl, InputLabel, MenuItem, Select, Stack, TextField, Typography, Alert } from '@mui/material';
import { useState } from 'react';
import { useAuth } from '../auth/AuthContext';
import useApi from '../hooks/useApi';
import { pushApi } from '../api/endpoints';
import PageHeader from '../components/PageHeader';

/** Admin-only: compose and send a broadcast across Telegram (@bisnocbot), browser push, and in-app bell alerts. */
export default function PushNotifications() {
    const { user } = useAuth();
    const isAdmin = user?.role === 'admin';
    const stats = useApi(() => pushApi.stats(), []);
    const [sending, setSending] = useState(false);
    const [error, setError] = useState('');
    const [message, setMessage] = useState('');
    const [form, setForm] = useState({ title: '', body: '', url: '', audience: 'all' });

    const handleChange = (key) => (e) => setForm((p) => ({ ...p, [key]: e.target.value }));

    const send = async (e) => {
        e.preventDefault();
        setError('');
        setMessage('');
        setSending(true);
        try {
            const payload = {
                title: form.title.trim(),
                body: form.body.trim(),
                url: form.url.trim() || '/app',
                ...(form.audience && form.audience !== 'all' ? { audience: form.audience } : {}),
            };
            const result = await pushApi.send(payload);
            const parts = [];
            if (typeof result.telegramSent === 'number' && result.telegramSent > 0) {
                parts.push(`${result.telegramSent} Telegram (@bisnocbot)`);
            }
            if (typeof result.webPushSent === 'number' && result.webPushSent > 0) {
                parts.push(`${result.webPushSent} browser push`);
            }
            if (typeof result.inAppSent === 'number' && result.inAppSent > 0) {
                parts.push(`${result.inAppSent} in-app bell`);
            }
            const summary = parts.length > 0
                ? parts.join(', ')
                : `${result.sent ?? 0} delivered`;
            setMessage(
                `Broadcast sent — ${summary}${result.failed ? ` (${result.failed} failed)` : ''}.`,
            );
            setForm({ title: '', body: '', url: '', audience: 'all' });
            stats.reload?.();
        } catch (err) {
            setError(err.message || 'Broadcast failed.');
        } finally {
            setSending(false);
        }
    };

    if (!isAdmin) return null;

    const statData = stats.data || {};
    const telegramCount = statData.telegramLinkedUsers ?? 0;
    const browserCount = statData.subscribedUsers ?? 0;
    const staffCount = statData.activeStaffUsers ?? null;
    const webPushEnabled = Boolean(statData.webPushEnabled);

    return (
        <Box sx={{ maxWidth: 720, mx: 'auto', p: 1 }}>
            <PageHeader
                title="Send a broadcast"
                subtitle="Delivers instantly to staff via @bisnocbot on Telegram, in-app bell alerts, and subscribed browser/PWA devices."
            />
            {(error || message) && (
                <Alert severity={error ? 'error' : 'success'} sx={{ mb: 2 }}>
                    {error || message}
                </Alert>
            )}
            <Card variant="outlined" sx={{ borderRadius: 3 }}>
                <CardContent sx={{ p: 3 }}>
                    <Box component="form" onSubmit={send} sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                        <TextField
                            fullWidth
                            label="Title"
                            required
                            value={form.title}
                            onChange={handleChange('title')}
                            helperText="Shown as the broadcast headline."
                        />
                        <TextField
                            fullWidth
                            label="Body"
                            required
                            multiline
                            rows={3}
                            value={form.body}
                            onChange={handleChange('body')}
                            helperText="The message staff will read on Telegram, device banners, and their notification bell."
                        />
                        <TextField
                            fullWidth
                            label="Open this page when tapped (optional)"
                            value={form.url}
                            onChange={handleChange('url')}
                            placeholder="/app/attendance"
                            helperText="Defaults to /app on bis-gerji-primary2.vercel.app."
                        />
                        <FormControl fullWidth>
                            <InputLabel id="audience-label">Send to</InputLabel>
                            <Select
                                labelId="audience-label"
                                label="Send to"
                                value={form.audience}
                                onChange={(e) => setForm((p) => ({ ...p, audience: e.target.value }))}
                                fullWidth
                            >
                                <MenuItem value="all">All teaching staff</MenuItem>
                                <MenuItem value="main_teacher">Main teachers</MenuItem>
                                <MenuItem value="assistant_teacher">Assistant teachers</MenuItem>
                                <MenuItem value="subject_teacher">Subject teachers</MenuItem>
                                <MenuItem value="admin">Administrators</MenuItem>
                            </Select>
                        </FormControl>

                        <Stack direction="row" spacing={1} useFlexGap sx={{ flexWrap: 'wrap' }}>
                            <Chip
                                label={`Telegram (@bisnocbot): ${stats.loading ? '…' : telegramCount} linked`}
                                size="small"
                                color={telegramCount > 0 ? 'primary' : 'default'}
                            />
                            <Chip
                                label={
                                    webPushEnabled
                                        ? `Browser push devices: ${stats.loading ? '…' : browserCount}`
                                        : 'Browser push: off (VAPID keys not set)'
                                }
                                size="small"
                                color={webPushEnabled && browserCount > 0 ? 'success' : 'default'}
                            />
                            {staffCount !== null && (
                                <Chip
                                    label={`In-app bell recipients: ${staffCount}`}
                                    size="small"
                                    variant="outlined"
                                />
                            )}
                        </Stack>

                        <Button
                            type="submit"
                            variant="contained"
                            disableElevation
                            disabled={sending || !form.title.trim() || !form.body.trim()}
                            sx={{
                                textTransform: 'none',
                                fontWeight: 700,
                                borderRadius: 2,
                                alignSelf: { xs: 'stretch', sm: 'flex-start' },
                                minHeight: 42,
                            }}
                        >
                            {sending ? 'Sending…' : 'Send broadcast'}
                        </Button>
                        <Typography variant="caption" color="text.secondary">
                            Reaches every active staff member in the selected group via the in-app notification bell, pushes directly to linked @bisnocbot Telegram chats, and triggers OS browser push alerts on subscribed devices.
                        </Typography>
                    </Box>
                </CardContent>
            </Card>
        </Box>
    );
}
