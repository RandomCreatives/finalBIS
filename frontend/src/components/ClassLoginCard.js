import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    Alert, Box, Button, Card, CardContent, Dialog, DialogActions, DialogContent,
    IconButton, InputAdornment, TextField, Typography, useTheme,
} from '@mui/material';
import { alpha } from '@mui/material/styles';
import SchoolIcon from '@mui/icons-material/School';
import GroupsIcon from '@mui/icons-material/Groups';
import PersonIcon from '@mui/icons-material/Person';
import LockIcon from '@mui/icons-material/Lock';
import VisibilityIcon from '@mui/icons-material/Visibility';
import VisibilityOffIcon from '@mui/icons-material/VisibilityOff';
import { setToken } from '../api/client';
import { saveClassLogin, slugFor } from '../data/classes';

const BASE_URL = process.env.REACT_APP_API_URL || '';

/*
 * The shared class sign-in card + password dialog, used by every surface
 * that offers class-card login (public /classes wall and the staff
 * sign-in wall). One design, one login flow — the pages never drift.
 */

/** A class: identity icon, name, staff rows, student count, sign-in button. */
export function ClassCard({ klass, onLogin, actionLabel }) {
    const theme = useTheme();
    const dark = theme.palette.mode === 'dark';
    const surface = dark ? theme.palette.background.paper : '#ffffff';
    const border = dark ? theme.palette.divider : '#e2e8f0';

    return (
        <Card variant="outlined" data-testid="class-card" sx={{ height: '100%', borderRadius: 1,
            bgcolor: surface, borderColor: border,
            transition: 'transform .18s, border-color .18s, box-shadow .18s',
            '&:hover': {
                transform: 'translateY(-4px)', borderColor: 'primary.main',
                boxShadow: dark ? '0 16px 40px rgba(0,0,0,.4)' : '0 16px 40px rgba(15,23,42,.08)',
            } }}>
            <CardContent sx={{ p: 3 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 2.5 }}>
                    <Box sx={{ width: 42, height: 42, borderRadius: 2,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        bgcolor: alpha(theme.palette.primary.main, 0.1), color: 'primary.main' }}>
                        <SchoolIcon />
                    </Box>
                    <Typography sx={{ fontWeight: 800, fontSize: 18 }}>{klass.name}</Typography>
                </Box>

                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.2 }}>
                        <PersonIcon sx={{ fontSize: 18, color: 'text.secondary' }} />
                        <Box>
                            <Typography sx={{ fontSize: 11, fontWeight: 700, color: 'text.secondary',
                                textTransform: 'uppercase', letterSpacing: .5 }}>
                                Main Teacher
                            </Typography>
                            <Typography sx={{ fontSize: 14, fontWeight: 600 }}>
                                {klass.mainTeacher || 'Not assigned'}
                            </Typography>
                        </Box>
                    </Box>

                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.2 }}>
                        <PersonIcon sx={{ fontSize: 18, color: 'text.secondary' }} />
                        <Box>
                            <Typography sx={{ fontSize: 11, fontWeight: 700, color: 'text.secondary',
                                textTransform: 'uppercase', letterSpacing: .5 }}>
                                Assistant Teacher
                            </Typography>
                            <Typography sx={{ fontSize: 14, fontWeight: 600 }}>
                                {klass.assistantTeacher || 'Not assigned'}
                            </Typography>
                        </Box>
                    </Box>

                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.2, mt: .5 }}>
                        <GroupsIcon sx={{ fontSize: 18, color: 'text.secondary' }} />
                        <Box>
                            <Typography sx={{ fontSize: 11, fontWeight: 700, color: 'text.secondary',
                                textTransform: 'uppercase', letterSpacing: .5 }}>
                                Students
                            </Typography>
                            <Typography sx={{ fontSize: 14, fontWeight: 600 }}>
                                {klass.studentCount}
                            </Typography>
                        </Box>
                    </Box>
                </Box>

                <Button
                    fullWidth size="small" variant="outlined"
                    startIcon={<LockIcon sx={{ fontSize: 16 }} />}
                    onClick={() => onLogin(klass)}
                    sx={{ mt: 2.5, fontWeight: 700, borderRadius: 1, textTransform: 'none' }}>
                    {actionLabel || (klass.mainTeacher ? 'Main Teacher Login' : 'Teacher Login')}
                </Button>
            </CardContent>
        </Card>
    );
}

/**
 * The class-card password dialog. Posts to /api/auth/class-login, stores the
 * JWT + class session and navigates into the class dashboard on success.
 */
export function ClassLoginDialog({ loginClass, onClose }) {
    const theme = useTheme();
    const navigate = useNavigate();

    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [loginError, setLoginError] = useState('');
    const [submitting, setSubmitting] = useState(false);

    const submitLogin = async (e) => {
        e.preventDefault();
        if (!loginClass || submitting) return;

        setSubmitting(true);
        setLoginError('');
        try {
            const res = await fetch(`${BASE_URL}/api/auth/class-login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ className: loginClass.name, password }),
            });
            const data = await res.json().catch(() => ({}));
            if (!res.ok) throw new Error(data.message || 'Sign-in failed');

            // Real JWT for the class's main teacher — the dashboard uses it
            // for the live roster, edits and transfers.
            setToken(data.token);
            saveClassLogin(loginClass, {
                classId: data.class?.id,
                userId: data.user?.id,
                teacher: data.user?.name,
            });
            navigate(`/class-home/${slugFor(loginClass.name)}`);
        } catch (err) {
            setLoginError(err.message || 'Sign-in failed');
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <Dialog open={Boolean(loginClass)} onClose={onClose} maxWidth="xs" fullWidth
            PaperProps={{ sx: { borderRadius: 2, p: 1 } }}>
            {loginClass && (loginClass.mainTeacher ? (
                <form onSubmit={submitLogin}>
                    <DialogContent sx={{ pt: 3.5, textAlign: 'center' }}>
                        <Box sx={{ width: 56, height: 56, borderRadius: '50%', mx: 'auto', mb: 2,
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            bgcolor: alpha(theme.palette.primary.main, 0.1), color: 'primary.main' }}>
                            <SchoolIcon />
                        </Box>
                        <Typography variant="h6" sx={{ fontWeight: 800 }}>
                            Welcome, {loginClass.mainTeacher}
                        </Typography>
                        <Typography sx={{ fontSize: 13, color: 'text.secondary', mb: .5 }}>
                            Main Teacher · {loginClass.name}
                        </Typography>

                        <TextField
                            autoFocus type={showPassword ? 'text' : 'password'}
                            label="Class password" fullWidth size="small" sx={{ mt: 2.5 }}
                            value={password}
                            onChange={(e) => { setPassword(e.target.value); setLoginError(''); }}
                            error={Boolean(loginError)}
                            helperText={loginError || 'Hint (for now): the password is the class name — e.g. “year 3 blue”.'}
                            InputProps={{
                                endAdornment: (
                                    <InputAdornment position="end">
                                        <IconButton size="small" onClick={() => setShowPassword((v) => !v)}
                                            aria-label={showPassword ? 'Hide password' : 'Show password'}>
                                            {showPassword ? <VisibilityOffIcon fontSize="small" /> : <VisibilityIcon fontSize="small" />}
                                        </IconButton>
                                    </InputAdornment>
                                ),
                            }}
                        />
                    </DialogContent>
                    <DialogActions sx={{ px: 3, pb: 2.5, gap: 1 }}>
                        <Button onClick={onClose} sx={{ fontWeight: 700, textTransform: 'none', color: 'text.secondary' }}>
                            Cancel
                        </Button>
                        <Button type="submit" variant="contained" disableElevation
                            disabled={!password.trim() || submitting}
                            sx={{ fontWeight: 700, textTransform: 'none', px: 3 }}>
                            {submitting ? 'Signing in…' : 'Sign In'}
                        </Button>
                    </DialogActions>
                </form>
            ) : (
                <>
                    <DialogContent sx={{ pt: 3.5, textAlign: 'center' }}>
                        <Box sx={{ width: 56, height: 56, borderRadius: '50%', mx: 'auto', mb: 2,
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            bgcolor: alpha(theme.palette.warning.main, 0.12), color: 'warning.main' }}>
                            <PersonIcon />
                        </Box>
                        <Typography variant="h6" sx={{ fontWeight: 800 }}>{loginClass.name}</Typography>
                        <Alert severity="info" sx={{ mt: 2, textAlign: 'left' }}>
                            No main teacher has been assigned to this class yet. The teacher login
                            opens as soon as the school assigns one.
                        </Alert>
                    </DialogContent>
                    <DialogActions sx={{ px: 3, pb: 2.5 }}>
                        <Button onClick={onClose} variant="contained" disableElevation
                            sx={{ fontWeight: 700, textTransform: 'none', px: 3 }}>
                            Close
                        </Button>
                    </DialogActions>
                </>
            ))}
        </Dialog>
    );
}
