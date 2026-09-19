import { useEffect, useState } from 'react';
import {
    Alert, Avatar, Box, Button, Card, CardContent, Chip, IconButton,
    InputAdornment, Link, Stack, Switch, TextField, Typography,
} from '@mui/material';
import PersonIcon from '@mui/icons-material/Person';
import LockIcon from '@mui/icons-material/Lock';
import SendIcon from '@mui/icons-material/Send';
import GroupsIcon from '@mui/icons-material/Groups';
import TuneIcon from '@mui/icons-material/Tune';
import LightModeIcon from '@mui/icons-material/LightMode';
import DarkModeIcon from '@mui/icons-material/DarkMode';
import VisibilityIcon from '@mui/icons-material/Visibility';
import VisibilityOffIcon from '@mui/icons-material/VisibilityOff';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import { alpha } from '@mui/material/styles';
import { authApi } from '../../api/endpoints';
import useApi from '../../hooks/useApi';
import { useAuth } from '../../auth/AuthContext';
import { useColorScheme } from '../../theme';
import TelegramLoginButton from '../TelegramLoginButton';
import { fetchTelegramConfig, botChatUrl } from '../../auth/telegram';

/**
 * Shared profile & settings cards, mounted in all three homes:
 *   · /app/settings (admins)
 *   · SubjectHome → Profile tab (subject teachers)
 *   · ClassHome  → Profile section (main teachers)
 * Policy lived on the server: names are school-managed for non-admins;
 * class-card accounts (main teachers) do not self-change passwords.
 */

const CardShell = ({ icon: Icon, title, subtitle, children }) => (
    <Card variant="outlined" sx={{ borderRadius: 3, height: '100%' }}>
        <CardContent sx={{ p: 3 }}>
            <Stack direction="row" spacing={1.5} alignItems="center" sx={{ mb: 0.5 }}>
                <Box sx={{
                    width: 36, height: 36, borderRadius: 2, bgcolor: '#0f172a', color: '#fff',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                }}>
                    <Icon sx={{ fontSize: 19 }} />
                </Box>
                <Box>
                    <Typography sx={{ fontWeight: 800, fontSize: 15.5, lineHeight: 1.2 }}>{title}</Typography>
                    {subtitle && (
                        <Typography variant="caption" color="text.secondary">{subtitle}</Typography>
                    )}
                </Box>
            </Stack>
            <Box sx={{ mt: 2 }}>{children}</Box>
        </CardContent>
    </Card>
);

const initials = (name = '') =>
    name.split(' ').filter(Boolean).map((w) => w[0]).slice(0, 2).join('').toUpperCase() || '?';

/* ── identity ────────────────────────────────────────────── */
/**
 * Who you are + how the school reaches you. Name is read-only for
 * teachers (server enforces the same rule); admins may edit their own.
 */
export function IdentityCard({ roleLabel, canEditName = false, nameNote }) {
    const { user: ctxUser, updateUser } = useAuth();
    const me = useApi(() => authApi.me().catch(() => null), []);
    const user = ctxUser || me.data;

    const [name, setName] = useState('');
    const [phone, setPhone] = useState('');
    useEffect(() => {
        if (user) {
            setName(user.name || '');
            setPhone(user.phone || '');
        }
    }, [user?.id, user?.name, user?.phone]); // eslint-disable-line react-hooks/exhaustive-deps

    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');

    const nameDirty = canEditName && name.trim() && name.trim() !== (user?.name || '');
    const phoneDirty = phone.trim() !== (user?.phone || '');

    const save = async (fields) => {
        setSaving(true);
        setError('');
        setSuccess('');
        try {
            const { user: updated } = await authApi.updateProfile(fields);
            updateUser(updated);
            setSuccess('Saved. Updated everywhere you sign in.');
        } catch (err) {
            setError(err.message || 'Could not save. Please try again.');
        } finally {
            setSaving(false);
        }
    };

    return (
        <CardShell icon={PersonIcon} title="Identity" subtitle={roleLabel}>
            <Stack direction="row" spacing={2} alignItems="center" sx={{ mb: 2.5 }}>
                <Avatar sx={{
                    width: 52, height: 52, bgcolor: 'primary.main',
                    fontWeight: 800, fontSize: 19,
                }}>
                    {initials(user?.name)}
                </Avatar>
                <Box sx={{ minWidth: 0 }}>
                    <Typography sx={{ fontWeight: 800, fontSize: 16 }} noWrap>
                        {user?.name || '—'}
                    </Typography>
                    <Typography variant="caption" color="text.secondary" noWrap
                        sx={{ display: 'block' }}>
                        {user?.email || ''}
                    </Typography>
                </Box>
            </Stack>

            {(error || success) && (
                <Alert severity={error ? 'error' : 'success'} sx={{ mb: 2 }}>
                    {error || success}
                </Alert>
            )}

            {canEditName ? (
                <Box component="form" onSubmit={(e) => { e.preventDefault(); save({ name: name.trim() }); }}
                    sx={{ display: 'flex', gap: 1, mb: 2, flexDirection: { xs: 'column', sm: 'row' } }}>
                    <TextField label="Display name" size="small" fullWidth value={name}
                        onChange={(e) => setName(e.target.value)} />
                    <Button type="submit" variant="contained" disableElevation disabled={!nameDirty || saving}
                        sx={{ textTransform: 'none', fontWeight: 700, borderRadius: 2, minHeight: 40 }}>
                        Save
                    </Button>
                </Box>
            ) : (
                <Box sx={{
                    display: 'flex', gap: 1.25, alignItems: 'flex-start',
                    p: 1.5, mb: 2, borderRadius: 2,
                    bgcolor: (t) => alpha(t.palette.primary.main, t.palette.mode === 'dark' ? 0.14 : 0.06),
                }}>
                    <InfoOutlinedIcon sx={{ fontSize: 17, color: 'primary.main', mt: 0.25 }} />
                    <Typography variant="caption" color="text.secondary" sx={{ lineHeight: 1.55 }}>
                        {nameNote ||
                            'Your display name is issued by the school and shown on walls, rosters and printouts. Ask the coordinator to correct it.'}
                    </Typography>
                </Box>
            )}

            <Box component="form" onSubmit={(e) => { e.preventDefault(); save({ phone: phone.trim() }); }}
                sx={{ display: 'flex', gap: 1, flexDirection: { xs: 'column', sm: 'row' } }}>
                <TextField label="Phone" size="small" fullWidth value={phone}
                    placeholder="+251 9…" onChange={(e) => setPhone(e.target.value)}
                    helperText="Used by the office to reach you." />
                <Button type="submit" variant="outlined" disabled={!phoneDirty || saving}
                    sx={{ textTransform: 'none', fontWeight: 700, borderRadius: 2, minHeight: 40 }}>
                    Save
                </Button>
            </Box>
        </CardShell>
    );
}

/* ── telegram ────────────────────────────────────────────── */
export function TelegramCard() {
    const { updateUser } = useAuth();
    const [config, setConfig] = useState(null);
    const [message, setMessage] = useState('');
    const [error, setError] = useState('');
    const [busy, setBusy] = useState(false);
    const [linked, setLinked] = useState(null); // { telegramId, telegramUsername }

    const me = useApi(() => authApi.me().catch(() => null), []);
    useEffect(() => {
        if (me.data) {
            setLinked({ telegramId: me.data.telegramId, telegramUsername: me.data.telegramUsername });
        }
    }, [me.data?.telegramId]); // eslint-disable-line react-hooks/exhaustive-deps

    useEffect(() => {
        let cancelled = false;
        fetchTelegramConfig().then((cfg) => { if (!cancelled) setConfig(cfg); });
        return () => { cancelled = true; };
    }, []);

    const link = async (payload) => {
        setBusy(true); setError(''); setMessage('');
        try {
            const { user: updated } = await authApi.linkTelegram(payload);
            updateUser(updated);
            setLinked({ telegramId: updated.telegramId, telegramUsername: updated.telegramUsername });
            setMessage('Telegram linked — you can sign in with it from now on.');
        } catch (err) {
            setError(err.message || 'Could not link Telegram. Please try again.');
        } finally {
            setBusy(false);
        }
    };

    const unlink = async () => {
        setBusy(true); setError(''); setMessage('');
        try {
            const { user: updated } = await authApi.unlinkTelegram();
            updateUser(updated);
            setLinked({ telegramId: null, telegramUsername: null });
            setMessage('Telegram unlinked.');
        } catch (err) {
            setError(err.message || 'Could not unlink Telegram. Please try again.');
        } finally {
            setBusy(false);
        }
    };

    const chat = config ? botChatUrl(config.botUsername) : null;

    return (
        <CardShell icon={SendIcon} title="Telegram" subtitle="Optional second sign-in method">
            {(error || message) && (
                <Alert severity={error ? 'error' : 'success'} sx={{ mb: 2 }}>
                    {error || message}
                </Alert>
            )}
            {linked?.telegramId ? (
                <Stack direction="row" alignItems="center" spacing={1.5}>
                    <Chip color="success" variant="outlined" size="small"
                        label={linked.telegramUsername ? `Linked · @${linked.telegramUsername}` : 'Linked'} />
                    <Button size="small" color="inherit" onClick={unlink} disabled={busy}
                        sx={{ textTransform: 'none', fontWeight: 600 }}>
                        Unlink
                    </Button>
                </Stack>
            ) : (
                <>
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5, lineHeight: 1.6 }}>
                        Link your Telegram account to sign in with one tap — no password needed.
                    </Typography>
                    {config?.enabled ? (
                        <TelegramLoginButton onAuth={link} purpose="link" />
                    ) : (
                        <Typography variant="caption" color="text.secondary">
                            Telegram sign-in is not configured yet.
                        </Typography>
                    )}
                </>
            )}
            {chat && !linked?.telegramId && (
                <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1.5 }}>
                    Questions? Message us on{' '}
                    <Link href={chat} target="_blank" rel="noreferrer" underline="hover">Telegram</Link>.
                </Typography>
            )}
        </CardShell>
    );
}

/* ── security ────────────────────────────────────────────── */
const PasswordField = ({ label, value, onChange }) => {
    const [show, setShow] = useState(false);
    return (
        <TextField
            label={label} type={show ? 'text' : 'password'} size="small"
            fullWidth value={value} onChange={(e) => onChange(e.target.value)}
            InputProps={{
                endAdornment: (
                    <InputAdornment position="end">
                        <IconButton size="small" onClick={() => setShow((s) => !s)} edge="end"
                            aria-label={`Toggle ${label} visibility`}>
                            {show ? <VisibilityOffIcon sx={{ fontSize: 18 }} /> : <VisibilityIcon sx={{ fontSize: 18 }} />}
                        </IconButton>
                    </InputAdornment>
                ),
            }}
        />
    );
};

/**
 * mode 'self-service' → change-password form (subject teachers, admins).
 * mode 'managed'      → explainer (class-card main teachers: passwords are
 *                       coordinator-issued; the card is the door).
 */
export function SecurityCard({ mode = 'self-service', managedNote, note }) {
    const [currentPassword, setCurrentPassword] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    const [busy, setBusy] = useState(false);

    const submit = async (e) => {
        e?.preventDefault();
        setError(''); setSuccess('');
        if (!currentPassword) return setError('Current password is required');
        if (newPassword.length < 10) return setError('New password must be at least 10 characters long');
        if (newPassword !== confirmPassword) return setError('New passwords do not match');
        setBusy(true);
        try {
            await authApi.changePassword(currentPassword, newPassword);
            setSuccess('Password changed. Use the new one next time you sign in.');
            setCurrentPassword(''); setNewPassword(''); setConfirmPassword('');
        } catch (err) {
            setError(err.message || 'Failed to change password');
        } finally {
            setBusy(false);
        }
    };

    return (
        <CardShell icon={LockIcon} title="Security" subtitle="Password & sign-in">
            {mode === 'managed' ? (
                <Box sx={{
                    display: 'flex', gap: 1.25, alignItems: 'flex-start',
                    p: 1.5, borderRadius: 2,
                    bgcolor: (t) => alpha(t.palette.warning.main, t.palette.mode === 'dark' ? 0.1 : 0.08),
                }}>
                    <InfoOutlinedIcon sx={{ fontSize: 17, color: 'warning.main', mt: 0.25 }} />
                    <Typography variant="caption" color="text.secondary" sx={{ lineHeight: 1.55 }}>
                        {managedNote ||
                            'You sign in with your class card, so there is no password to manage here. '
                            + 'Card passwords are issued and rotated by the coordinator — ask Mr. Mike or Mr. Leul if yours needs changing.'}
                    </Typography>
                </Box>
            ) : (
                <Box component="form" onSubmit={submit}
                    sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                    {note && (
                        <Typography variant="caption" color="text.secondary" sx={{ lineHeight: 1.55 }}>
                            {note}
                        </Typography>
                    )}
                    {(error || success) && (
                        <Alert severity={error ? 'error' : 'success'}>{error || success}</Alert>
                    )}
                    <PasswordField label="Current password" value={currentPassword} onChange={setCurrentPassword} />
                    <PasswordField label="New password (10+ characters)" value={newPassword} onChange={setNewPassword} />
                    <PasswordField label="Confirm new password" value={confirmPassword} onChange={setConfirmPassword} />
                    <Button type="submit" variant="contained" disableElevation disabled={busy} sx={{
                        alignSelf: { xs: 'stretch', sm: 'flex-start' }, textTransform: 'none',
                        fontWeight: 700, borderRadius: 2, px: 3, minHeight: 42,
                    }}>
                        {busy ? 'Changing…' : 'Change password'}
                    </Button>
                </Box>
            )}
        </CardShell>
    );
}

/* ── teaching ────────────────────────────────────────────── */
/** Read-only context: what/whom the account teaches, from live assignments. */
export function TeachingCard({ title = 'My teaching', items = [], emptyHint }) {
    return (
        <CardShell icon={GroupsIcon} title={title} subtitle="From this year's timetable">
            {items.length === 0 ? (
                <Typography variant="caption" color="text.secondary">
                    {emptyHint || 'Nothing assigned for the current academic year yet.'}
                </Typography>
            ) : (
                <Stack spacing={1}>
                    {items.map((item, i) => (
                        <Box key={i} sx={{
                            display: 'flex', alignItems: 'baseline', gap: 1.25,
                            px: 1.5, py: 1, borderRadius: 2,
                            bgcolor: (t) => alpha(t.palette.text.primary, t.palette.mode === 'dark' ? 0.04 : 0.03),
                        }}>
                            <Box sx={{ width: 6, height: 6, borderRadius: '50%', bgcolor: 'primary.main',
                                flexShrink: 0, transform: 'translateY(-1px)' }} />
                            <Box sx={{ minWidth: 0 }}>
                                <Typography sx={{ fontWeight: 700, fontSize: 13.5, lineHeight: 1.35 }}>
                                    {item.primary}
                                </Typography>
                                {item.secondary && (
                                    <Typography variant="caption" color="text.secondary">
                                        {item.secondary}
                                    </Typography>
                                )}
                            </Box>
                        </Box>
                    ))}
                </Stack>
            )}
        </CardShell>
    );
}

/* ── preferences ─────────────────────────────────────────── */
export function PreferencesCard() {
    const { mode, toggleColorScheme } = useColorScheme();
    const dark = mode === 'dark';
    return (
        <CardShell icon={TuneIcon} title="Preferences" subtitle="This device only">
            <Stack direction="row" alignItems="center" justifyContent="space-between">
                <Stack direction="row" spacing={1.5} alignItems="center">
                    {dark ? <DarkModeIcon fontSize="small" /> : <LightModeIcon fontSize="small" />}
                    <Box>
                        <Typography sx={{ fontWeight: 700, fontSize: 14 }}>Dark mode</Typography>
                        <Typography variant="caption" color="text.secondary">
                            Switches instantly and is remembered here.
                        </Typography>
                    </Box>
                </Stack>
                <Switch checked={dark} onChange={toggleColorScheme}
                    inputProps={{ 'aria-label': 'Toggle dark mode' }} />
            </Stack>
            <Typography variant="caption" color="text.secondary"
                sx={{ display: 'block', mt: 2, lineHeight: 1.55 }}>
                Notice and message preferences arrive with the Notices module.
            </Typography>
        </CardShell>
    );
}
