import { useState } from 'react';
import {
    Alert, Button, Chip, Dialog, DialogActions, DialogContent, DialogTitle, IconButton,
    MenuItem, Paper, Snackbar, Stack, Table, TableBody, TableCell, TableContainer,
    TableHead, TableRow, TextField, Tooltip, Typography,
} from '@mui/material';
import PersonAddIcon from '@mui/icons-material/PersonAdd';
import BlockIcon from '@mui/icons-material/Block';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import SendIcon from '@mui/icons-material/Send';
import LinkIcon from '@mui/icons-material/Link';
import LinkOffIcon from '@mui/icons-material/LinkOff';
import { userApi } from '../api/endpoints';
import useApi from '../hooks/useApi';
import PageHeader from '../components/PageHeader';
import DataState from '../components/DataState';
import { useAuth } from '../auth/AuthContext';

const ROLES = [
    { value: 'admin', label: 'Administrator' },
    { value: 'main_teacher', label: 'Main Teacher' },
    { value: 'assistant_teacher', label: 'Assistant Teacher' },
    { value: 'subject_teacher', label: 'Subject Teacher' },
    { value: 'store_manager', label: 'Store Manager' },
];

const EMPTY = { name: '', email: '', password: '', role: 'main_teacher' };

export default function Staff() {
    const { user } = useAuth();
    const [dialog, setDialog] = useState(null);
    const [saving, setSaving] = useState(false);
    const [formError, setFormError] = useState('');
    const [toast, setToast] = useState('');

    const [telegramDialog, setTelegramDialog] = useState(null);
    const [telegramId, setTelegramId] = useState('');
    const [telegramSaving, setTelegramSaving] = useState(false);
    const [telegramError, setTelegramError] = useState('');

    const staff = useApi(() => userApi.list(), []);

    const setField = (field) => (e) => setDialog((d) => ({ ...d, [field]: e.target.value }));

    const handleCreate = async () => {
        setSaving(true);
        setFormError('');
        try {
            await userApi.create({
                name: dialog.name.trim(),
                email: dialog.email.trim(),
                password: dialog.password,
                role: dialog.role,
            });
            setToast('Staff account created');
            setDialog(null);
            staff.reload();
        } catch (err) {
            setFormError(err.message);
        } finally {
            setSaving(false);
        }
    };

    const toggleActive = async (member) => {
        try {
            if (member.isActive) {
                await userApi.deactivate(member.id);
                setToast(`${member.name} deactivated`);
            } else {
                await userApi.update(member.id, { isActive: true });
                setToast(`${member.name} reactivated`);
            }
            staff.reload();
        } catch (err) {
            setToast(err.message);
        }
    };

    const changeRole = async (member, role) => {
        try {
            await userApi.update(member.id, { role });
            setToast('Role updated');
            staff.reload();
        } catch (err) {
            setToast(err.message);
        }
    };

    const openTelegramLink = (member) => {
        setTelegramError('');
        setTelegramId(member.telegramId ? String(member.telegramId) : '');
        setTelegramDialog(member);
    };

    const saveTelegramLink = async () => {
        setTelegramSaving(true);
        setTelegramError('');
        try {
            await userApi.update(telegramDialog.id, { telegramId: telegramId.trim() || null });
            setToast('Telegram account linked');
            setTelegramDialog(null);
            staff.reload();
        } catch (err) {
            setTelegramError(err.message);
        } finally {
            setTelegramSaving(false);
        }
    };

    const unlinkTelegram = async (member) => {
        try {
            await userApi.update(member.id, { telegramId: null });
            setToast('Telegram account unlinked');
            staff.reload();
        } catch (err) {
            setToast(err.message);
        }
    };

    const rows = staff.data || [];

    return (
        <>
            <PageHeader
                title="Staff"
                subtitle="Accounts, roles and access."
                action={
                    <Button
                        variant="contained" startIcon={<PersonAddIcon />}
                        onClick={() => { setFormError(''); setDialog({ ...EMPTY }); }}
                    >
                        Add staff
                    </Button>
                }
            />

            <DataState
                loading={staff.loading}
                error={staff.error}
                empty={rows.length === 0}
                emptyMessage="No staff accounts yet."
            >
                <TableContainer component={Paper} variant="outlined">
                    <Table size="small">
                        <TableHead>
                            <TableRow>
                                <TableCell>Name</TableCell>
                                <TableCell>Email</TableCell>
                                <TableCell>Role</TableCell>
                                <TableCell>Status</TableCell>
                                <TableCell>Telegram</TableCell>
                                <TableCell>Last sign-in</TableCell>
                                <TableCell align="right">Actions</TableCell>
                            </TableRow>
                        </TableHead>
                        <TableBody>
                            {rows.map((m) => {
                                const isSelf = m.id === user?.id;
                                return (
                                    <TableRow key={m.id} hover>
                                        <TableCell sx={{ fontWeight: 500 }}>
                                            {m.name}{isSelf && <Chip label="you" size="small" sx={{ ml: 1 }} />}
                                        </TableCell>
                                        <TableCell>{m.email}</TableCell>
                                        <TableCell>
                                            <TextField
                                                select size="small" variant="standard"
                                                value={m.role}
                                                disabled={isSelf}
                                                onChange={(e) => changeRole(m, e.target.value)}
                                                sx={{ minWidth: 165 }}
                                                InputProps={{ disableUnderline: isSelf }}
                                            >
                                                {ROLES.map((r) => (
                                                    <MenuItem key={r.value} value={r.value}>{r.label}</MenuItem>
                                                ))}
                                            </TextField>
                                        </TableCell>
                                        <TableCell>
                                            <Chip
                                                size="small"
                                                label={m.isActive ? 'Active' : 'Inactive'}
                                                color={m.isActive ? 'success' : 'default'}
                                                variant={m.isActive ? 'outlined' : 'filled'}
                                            />
                                        </TableCell>
                                        <TableCell>
                                            {m.telegramId ? (
                                                <Chip
                                                    size="small"
                                                    icon={<SendIcon fontSize="small" />}
                                                    label={m.telegramUsername ? `@${m.telegramUsername}` : `#${m.telegramId}`}
                                                    color="info"
                                                    variant="outlined"
                                                />
                                            ) : (
                                                <Typography variant="caption" color="text.secondary">Not linked</Typography>
                                            )}
                                        </TableCell>
                                        <TableCell>
                                            {m.lastLoginAt
                                                ? new Date(m.lastLoginAt).toLocaleDateString()
                                                : <Typography variant="caption" color="text.secondary">never</Typography>}
                                        </TableCell>
                                        <TableCell align="right">
                                            <Tooltip title={m.telegramId ? 'Change Telegram link' : 'Link Telegram account'}>
                                                <IconButton size="small" onClick={() => openTelegramLink(m)}>
                                                    {m.telegramId
                                                        ? <LinkIcon fontSize="small" color="primary" />
                                                        : <LinkIcon fontSize="small" />}
                                                </IconButton>
                                            </Tooltip>
                                            {m.telegramId && (
                                                <Tooltip title="Unlink Telegram">
                                                    <IconButton size="small" onClick={() => unlinkTelegram(m)}>
                                                        <LinkOffIcon fontSize="small" color="error" />
                                                    </IconButton>
                                                </Tooltip>
                                            )}
                                            {!isSelf && (
                                                <Tooltip title={m.isActive ? 'Deactivate' : 'Reactivate'}>
                                                    <IconButton size="small" onClick={() => toggleActive(m)}>
                                                        {m.isActive
                                                            ? <BlockIcon fontSize="small" />
                                                            : <CheckCircleIcon fontSize="small" color="success" />}
                                                    </IconButton>
                                                </Tooltip>
                                            )}
                                        </TableCell>
                                    </TableRow>
                                );
                            })}
                        </TableBody>
                    </Table>
                </TableContainer>
            </DataState>

            <Dialog open={Boolean(dialog)} onClose={() => setDialog(null)} maxWidth="xs" fullWidth>
                <DialogTitle>Add staff account</DialogTitle>
                <DialogContent>
                    {formError && <Alert severity="error" sx={{ mb: 2 }}>{formError}</Alert>}
                    <Stack spacing={2} sx={{ mt: 1 }}>
                        <TextField label="Full name" required fullWidth autoFocus
                            value={dialog?.name || ''} onChange={setField('name')} />
                        <TextField label="Email" type="email" required fullWidth
                            value={dialog?.email || ''} onChange={setField('email')} />
                        <TextField
                            label="Temporary password" type="password" required fullWidth
                            helperText="At least 10 characters. Ask them to change it after signing in."
                            value={dialog?.password || ''} onChange={setField('password')}
                        />
                        <TextField select label="Role" required fullWidth
                            value={dialog?.role || ''} onChange={setField('role')}>
                            {ROLES.map((r) => (
                                <MenuItem key={r.value} value={r.value}>{r.label}</MenuItem>
                            ))}
                        </TextField>
                    </Stack>
                </DialogContent>
                <DialogActions sx={{ px: 3, pb: 2 }}>
                    <Button onClick={() => setDialog(null)}>Cancel</Button>
                    <Button
                        variant="contained" onClick={handleCreate}
                        disabled={saving || !dialog?.name?.trim() || !dialog?.email?.trim() || (dialog?.password || '').length < 10}
                    >
                        Create
                    </Button>
                </DialogActions>
            </Dialog>

            <Dialog open={Boolean(telegramDialog)} onClose={() => setTelegramDialog(null)} maxWidth="xs" fullWidth>
                <DialogTitle>Link Telegram account</DialogTitle>
                <DialogContent>
                    {telegramError && <Alert severity="error" sx={{ mb: 2 }}>{telegramError}</Alert>}
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                        Ask {telegramDialog?.name} to start a chat with your school bot in Telegram, then enter their
                        numeric user id here. They will then be able to sign in with the Telegram button.
                    </Typography>
                    <TextField
                        label="Telegram user id"
                        required
                        fullWidth
                        autoFocus
                        value={telegramId}
                        onChange={(e) => setTelegramId(e.target.value)}
                        placeholder="e.g. 123456789"
                        helperText="Leave blank and save to unlink."
                    />
                </DialogContent>
                <DialogActions sx={{ px: 3, pb: 2 }}>
                    <Button onClick={() => setTelegramDialog(null)}>Cancel</Button>
                    <Button
                        variant="contained"
                        onClick={saveTelegramLink}
                        disabled={telegramSaving}
                    >
                        {telegramSaving ? 'Saving…' : 'Save'}
                    </Button>
                </DialogActions>
            </Dialog>

            <Snackbar open={Boolean(toast)} autoHideDuration={3000}
                onClose={() => setToast('')} message={toast}
                anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }} />
        </>
    );
}
