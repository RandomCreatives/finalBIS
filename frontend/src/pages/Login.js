import { useState } from 'react';
import { Link as RouterLink, useNavigate, useLocation, useSearchParams } from 'react-router-dom';
import {
    Alert, Box, Button, Card, CardContent, CircularProgress,
    Stack, TextField, Typography, Divider, IconButton, InputAdornment, Tab, Tabs
} from '@mui/material';
import SchoolIcon from '@mui/icons-material/School';
import VisibilityIcon from '@mui/icons-material/Visibility';
import VisibilityOffIcon from '@mui/icons-material/VisibilityOff';
import SendIcon from '@mui/icons-material/Send';
import KeyIcon from '@mui/icons-material/Key';
import LockIcon from '@mui/icons-material/Lock';
import { useAuth } from '../auth/AuthContext';
import TelegramLoginButton from '../components/TelegramLoginButton';

/**
 * The single sign-in screen for all staff.
 * Supports Email/Password login, Telegram OTP Code login, and Telegram Widget login.
 */
export default function Login() {
    const [tab, setTab] = useState(0); // 0 = Password, 1 = Telegram OTP

    // Password login state
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [error, setError] = useState('');
    const [submitting, setSubmitting] = useState(false);

    // Telegram OTP state
    const [tgIdentifier, setTgIdentifier] = useState('');
    const [tgCode, setTgCode] = useState('');
    const [tgStep, setTgStep] = useState('request'); // 'request' | 'verify'
    const [tgInfoMsg, setTgInfoMsg] = useState('');
    const [tgDevCode, setTgDevCode] = useState('');

    const [telegramError, setTelegramError] = useState('');
    const [telegramSubmitting, setTelegramSubmitting] = useState(false);

    const { login, telegramLogin, telegramRequestCode, telegramVerifyCode } = useAuth();
    const navigate = useNavigate();
    const location = useLocation();
    const [params] = useSearchParams();

    const expired = params.get('expired') === '1';
    const requestedDestination = location.state?.from?.pathname;
    const destination =
        typeof requestedDestination === 'string' &&
        requestedDestination.startsWith('/') &&
        !requestedDestination.startsWith('//') &&
        !requestedDestination.includes('\\')
            ? requestedDestination
            : '/app';

    const handlePasswordSubmit = async (event) => {
        event.preventDefault();
        setError('');
        setSubmitting(true);
        try {
            await login(email.trim(), password);
            navigate(destination, { replace: true });
        } catch (err) {
            setError(err.message || 'Sign in failed. Please check your credentials.');
        } finally {
            setSubmitting(false);
        }
    };

    const handleTgRequestCode = async (event) => {
        event.preventDefault();
        setTelegramError('');
        setTelegramSubmitting(true);
        try {
            const res = await telegramRequestCode(tgIdentifier.trim());
            setTgInfoMsg(res.message || 'Verification code sent to your Telegram!');
            if (res.code) setTgDevCode(res.code);
            setTgStep('verify');
        } catch (err) {
            setTelegramError(err.message || 'Failed to send Telegram code.');
        } finally {
            setTelegramSubmitting(false);
        }
    };

    const handleTgVerifyCode = async (event) => {
        event.preventDefault();
        setTelegramError('');
        setTelegramSubmitting(true);
        try {
            await telegramVerifyCode(tgIdentifier.trim(), tgCode.trim());
            navigate(destination, { replace: true });
        } catch (err) {
            setTelegramError(err.message || 'Invalid code. Please try again.');
        } finally {
            setTelegramSubmitting(false);
        }
    };

    const handleTelegramWidgetAuth = async (user) => {
        setTelegramError('');
        setTelegramSubmitting(true);
        try {
            await telegramLogin(user);
            navigate(destination, { replace: true });
        } catch (err) {
            setTelegramError(err.message || 'Telegram widget sign-in failed. Please try again.');
        } finally {
            setTelegramSubmitting(false);
        }
    };

    return (
        <Box
            sx={{
                minHeight: '100vh',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                p: 2,
                background: 'linear-gradient(135deg, #0f172a 0%, #1e3a8a 50%, #2563eb 100%)',
            }}
        >
            <Card sx={{ width: '100%', maxWidth: 440, borderRadius: 3, boxShadow: '0 20px 25px -5px rgba(0,0,0,0.2)' }}>
                <CardContent sx={{ p: { xs: 3, sm: 4 } }}>
                    <Stack spacing={1} alignItems="center" sx={{ mb: 2.5 }}>
                        <Box
                            sx={{
                                width: 56,
                                height: 56,
                                borderRadius: 3,
                                bgcolor: 'primary.main',
                                color: 'white',
                                display: 'grid',
                                placeItems: 'center',
                                mb: 1,
                                boxShadow: '0 10px 15px -3px rgba(37,99,235,0.4)',
                            }}
                        >
                            <SchoolIcon sx={{ fontSize: 32 }} />
                        </Box>
                        <Typography variant="h5" textAlign="center" fontWeight={800} letterSpacing="-0.02em">
                            BIS NOC Portal
                        </Typography>
                        <Typography variant="body2" color="text.secondary" textAlign="center">
                            British International School — NOC Gerji Campus
                        </Typography>
                    </Stack>

                    {expired && !error && (
                        <Alert severity="info" sx={{ mb: 2, borderRadius: 2 }}>
                            Your session expired. Please sign in again.
                        </Alert>
                    )}

                    <Tabs
                        value={tab}
                        onChange={(_, v) => { setTab(v); setError(''); setTelegramError(''); }}
                        variant="fullWidth"
                        sx={{ mb: 3, borderBottom: 1, borderColor: 'divider' }}
                    >
                        <Tab icon={<LockIcon sx={{ fontSize: 18 }} />} iconPosition="start" label="Password" />
                        <Tab icon={<SendIcon sx={{ fontSize: 18 }} />} iconPosition="start" label="Telegram Code" />
                    </Tabs>

                    {/* Tab 0: Email / Password */}
                    {tab === 0 && (
                        <Box component="form" onSubmit={handlePasswordSubmit} noValidate>
                            {error && <Alert severity="error" sx={{ mb: 2, borderRadius: 2 }}>{error}</Alert>}
                            <Stack spacing={2.5}>
                                <TextField
                                    label="Email address"
                                    type="email"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    autoComplete="username"
                                    autoFocus
                                    required
                                    fullWidth
                                />
                                <TextField
                                    label="Password"
                                    type={showPassword ? 'text' : 'password'}
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    autoComplete="current-password"
                                    required
                                    fullWidth
                                    InputProps={{
                                        endAdornment: (
                                            <InputAdornment position="end">
                                                <IconButton
                                                    onClick={() => setShowPassword(!showPassword)}
                                                    edge="end"
                                                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                                                >
                                                    {showPassword ? <VisibilityOffIcon fontSize="small" /> : <VisibilityIcon fontSize="small" />}
                                                </IconButton>
                                            </InputAdornment>
                                        ),
                                    }}
                                />
                                <Button
                                    type="submit"
                                    variant="contained"
                                    size="large"
                                    disabled={submitting || !email.trim() || !password}
                                    fullWidth
                                    sx={{ py: 1.2, fontWeight: 700, borderRadius: 2 }}
                                >
                                    {submitting ? <CircularProgress size={24} color="inherit" /> : 'Sign in'}
                                </Button>
                            </Stack>
                        </Box>
                    )}

                    {/* Tab 1: Telegram OTP Code */}
                    {tab === 1 && (
                        <Box>
                            {telegramError && <Alert severity="error" sx={{ mb: 2, borderRadius: 2 }}>{telegramError}</Alert>}
                            {tgInfoMsg && <Alert severity="success" sx={{ mb: 2, borderRadius: 2 }}>{tgInfoMsg}</Alert>}
                            {tgDevCode && (
                                <Alert severity="warning" sx={{ mb: 2, borderRadius: 2 }}>
                                    [DEV CODE]: {tgDevCode}
                                </Alert>
                            )}

                            {tgStep === 'request' ? (
                                <Box component="form" onSubmit={handleTgRequestCode} noValidate>
                                    <Stack spacing={2.5}>
                                        <TextField
                                            label="Email or Telegram username (@username)"
                                            value={tgIdentifier}
                                            onChange={(e) => setTgIdentifier(e.target.value)}
                                            placeholder="e.g. teacher@bisnoc.edu or @john_doe"
                                            autoFocus
                                            required
                                            fullWidth
                                        />
                                        <Button
                                            type="submit"
                                            variant="contained"
                                            size="large"
                                            disabled={telegramSubmitting || !tgIdentifier.trim()}
                                            fullWidth
                                            startIcon={<SendIcon />}
                                            sx={{ py: 1.2, fontWeight: 700, borderRadius: 2 }}
                                        >
                                            {telegramSubmitting ? <CircularProgress size={24} color="inherit" /> : 'Send Code to Telegram'}
                                        </Button>
                                    </Stack>
                                </Box>
                            ) : (
                                <Box component="form" onSubmit={handleTgVerifyCode} noValidate>
                                    <Stack spacing={2.5}>
                                        <TextField
                                            label="6-Digit Verification Code"
                                            value={tgCode}
                                            onChange={(e) => setTgCode(e.target.value)}
                                            placeholder="123456"
                                            autoFocus
                                            required
                                            fullWidth
                                            InputProps={{
                                                startAdornment: (
                                                    <InputAdornment position="start">
                                                        <KeyIcon color="primary" />
                                                    </InputAdornment>
                                                ),
                                            }}
                                        />
                                        <Button
                                            type="submit"
                                            variant="contained"
                                            size="large"
                                            disabled={telegramSubmitting || !tgCode.trim()}
                                            fullWidth
                                            sx={{ py: 1.2, fontWeight: 700, borderRadius: 2 }}
                                        >
                                            {telegramSubmitting ? <CircularProgress size={24} color="inherit" /> : 'Verify Code & Sign In'}
                                        </Button>
                                        <Button
                                            variant="text"
                                            size="small"
                                            onClick={() => { setTgStep('request'); setTgCode(''); setTgInfoMsg(''); }}
                                        >
                                            ← Request a new code
                                        </Button>
                                    </Stack>
                                </Box>
                            )}
                        </Box>
                    )}

                    <Box sx={{ my: 2.5, display: 'flex', alignItems: 'center', gap: 1.5 }}>
                        <Divider sx={{ flexGrow: 1 }} />
                        <Typography variant="caption" color="text.disabled" sx={{ fontWeight: 700, textTransform: 'uppercase', fontSize: 11 }}>
                            OR QUICK SIGN IN WITH WIDGET
                        </Typography>
                        <Divider sx={{ flexGrow: 1 }} />
                    </Box>

                    {telegramSubmitting && tab === 0 ? (
                        <Stack alignItems="center" sx={{ py: 1 }}>
                            <CircularProgress size={24} />
                        </Stack>
                    ) : (
                        <TelegramLoginButton onAuth={handleTelegramWidgetAuth} />
                    )}

                    <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 3 }} textAlign="center">
                        Staff accounts are issued by your school administrator.
                    </Typography>

                    <Box sx={{ mt: 2, textAlign: 'center' }}>
                        <Button
                            component={RouterLink}
                            to="/"
                            size="small"
                            sx={{ fontWeight: 600, color: 'text.secondary', textTransform: 'none' }}
                        >
                            ← Back to School Overview
                        </Button>
                    </Box>
                </CardContent>
            </Card>
        </Box>
    );
}
