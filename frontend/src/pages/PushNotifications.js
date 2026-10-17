import { Box, Button, Card, CardContent, Chip, FormControl, InputLabel, MenuItem, Select, TextField, Typography, Alert } from '@mui/material';
import { useState } from 'react';
import { useAuth } from '../auth/AuthContext';
import useApi from '../hooks/useApi';
import { pushApi } from '../api/endpoints';
import PageHeader from '../components/PageHeader';

/** Admin-only: compose and send a push broadcast to staff devices. */
export default function PushNotifications() {
    const { user } = useAuth();
    const isAdmin = user?.role === 'admin';
    const [stats] = useApi(() => pushApi.stats(), []);
    const [sending, setSending] = useState(false);
    const [error, setError] = useState('');
    const [message, setMessage] = useState('');
    const [form, setForm] = useState({ title: '', body: '', url: '', audience: null });

    const handleChange = (key) => (e) => setForm((p) => ({ ...p, [key]: e.target.value }));

    const send = async (e) => {
        e.preventDefault();
        setError(''); setMessage('');
        setSending(true);
        try {
            const result = await pushApi.send({
                title: form.title,
                body: form.body,
                url: form.url || '/',
                audience: form.audience || null,
            });
            setMessage(`Sent — ${result.sent} delivered, ${result.failed} failed.`);
            setForm({ title: '', body: '', url: '', audience: null });
        } catch (err) {
            setError(err.message || 'Broadcast failed.');
        } finally {
            setSending(false);
        }
    };

    if (!isAdmin) return null;

    return (
        <Box sx={{ maxWidth: 720, mx: 'auto', p: 1 }}>
            <PageHeader title="Send a push notification" subtitle="Broadcasts land on staff devices — phones, tablets, desktops — even when the app is closed." />
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
                            helperText="Shown as the notification headline."
                        />
                        <TextField
                            fullWidth
                            label="Body"
                            required
                            multiline
                            rows={2}
                            value={form.body}
                            onChange={handleChange('body')}
                            helperText="The message teachers will read."
                        />
                        <TextField
                            fullWidth
                            label="Open this page when tapped (optional)"
                            value={form.url}
                            onChange={handleChange('url')}
                            placeholder="/app/attendance"
                            helperText="Defaults to the app home."
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
                                <MenuItem value={null}>All teaching staff</MenuItem>
                                <MenuItem value="main_teacher">Main teachers</MenuItem>
                                <MenuItem value="assistant_teacher">Assistant teachers</MenuItem>
                                <MenuItem value="subject_teacher">Subject teachers</MenuItem>
                                <MenuItem value="admin">Administrators</MenuItem>
                            </Select>
                        </FormControl>
                        <Chip
                            label={`Subscribed devices: ${stats.data?.subscribedUsers ?? '—'}`}
                            size="small"
                            color={stats.data?.subscribedUsers ? 'success' : 'default'}
                        />
                        <Button
                            type="submit"
                            variant="contained"
                            disableElevation
                            disabled={sending || !form.title || !form.body}
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
                            Reaches every staff member who has switched on push notifications in Settings. A scheduled morning attendance reminder can be layered on next.
                        </Typography>
                    </Box>
                </CardContent>
            </Card>
        </Box>
    );
}
