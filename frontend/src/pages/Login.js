import { useState } from 'react';
import { Link as RouterLink, useNavigate, useLocation, useSearchParams } from 'react-router-dom';
import {
    Alert, Box, Button, Card, CardContent, CircularProgress,
    Stack, TextField, Typography, Dialog, DialogTitle, DialogContent, DialogContentText, DialogActions, Divider
} from '@mui/material';
import SchoolIcon from '@mui/icons-material/School';
import { useAuth } from '../auth/AuthContext';
import { authApi } from '../api/endpoints';

const GoogleIcon = () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" style={{ marginRight: 10 }}>
        <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-3.3 3.28-8.16 3.28-13.62z" fill="#4285F4" />
        <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
        <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" fill="#FBBC05" />
        <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
    </svg>
);

/**
 * The single sign-in screen for all staff.
 *
 * There is no "quick access" bypass and no self-service admin registration —
 * both were routes to unauthenticated administrator access. Accounts are
 * created by an admin, or by the seed script for the very first one.
 */
export default function Login() {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [submitting, setSubmitting] = useState(false);

    // Google Sign-In States (passwordless email code)
    const [googleLoginOpen, setGoogleLoginOpen] = useState(false);
    const [googleEmail, setGoogleLoginEmail] = useState('');
    const [googleStep, setGoogleStep] = useState(1);
    const [googleCode, setGoogleCode] = useState('');
    const [googleError, setGoogleLoginError] = useState('');
    const [googleSubmitting, setGoogleLoginSubmitting] = useState(false);

    const { login, gmailLogin } = useAuth();
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

    const handleGmailRequest = async (event) => {
        event.preventDefault();
        setGoogleLoginError('');
        setGoogleLoginSubmitting(true);
        try {
            await authApi.gmailRequest(googleEmail);
            setGoogleStep(2);
        } catch (err) {
            setGoogleLoginError(err.message || 'Failed to send sign-in code');
        } finally {
            setGoogleLoginSubmitting(false);
        }
    };

    const handleGmailVerify = async (event) => {
        event.preventDefault();
        setGoogleLoginError('');
        setGoogleLoginSubmitting(true);
        try {
            await gmailLogin(googleEmail, googleCode);
            setGoogleLoginOpen(false);
            navigate(destination, { replace: true });
        } catch (err) {
            setGoogleLoginError(err.message || 'Invalid or expired code');
        } finally {
            setGoogleLoginSubmitting(false);
        }
    };

    const handleSubmit = async (event) => {
        event.preventDefault();
        setError('');
        setSubmitting(true);
        try {
            await login(email, password);
            navigate(destination, { replace: true });
        } catch (err) {
            setError(err.message);
        } finally {
            setSubmitting(false);
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
                background: 'linear-gradient(135deg, #1e3a8a 0%, #3b82f6 100%)',
            }}
        >
            <Card sx={{ width: '100%', maxWidth: 420 }}>
                <CardContent sx={{ p: 4 }}>
                    <Stack spacing={1} alignItems="center" sx={{ mb: 3 }}>
                        <SchoolIcon color="primary" sx={{ fontSize: 44 }} />
                        <Typography variant="h5" textAlign="center">
                            School Management
                        </Typography>
                        <Typography variant="body2" color="text.secondary" textAlign="center">
                            British International School — NOC Gerji Campus
                        </Typography>
                    </Stack>

                    {expired && !error && (
                        <Alert severity="info" sx={{ mb: 2 }}>
                            Your session expired. Please sign in again.
                        </Alert>
                    )}

                    {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

                    <Box component="form" onSubmit={handleSubmit} noValidate>
                        <Stack spacing={2}>
                            <TextField
                                label="Email"
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
                                type="password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                autoComplete="current-password"
                                required
                                fullWidth
                            />
                            <Button
                                type="submit"
                                variant="contained"
                                size="large"
                                disabled={submitting || !email || !password}
                                fullWidth
                            >
                                {submitting ? <CircularProgress size={24} color="inherit" /> : 'Sign in'}
                            </Button>

                            <Box sx={{ my: 2.5, display: 'flex', alignItems: 'center', gap: 1.5 }}>
                                <Divider sx={{ flexGrow: 1 }} />
                                <Typography variant="caption" color="text.disabled" sx={{ fontWeight: 600, textTransform: 'uppercase' }}>
                                    OR
                                </Typography>
                                <Divider sx={{ flexGrow: 1 }} />
                            </Box>

                            <Button
                                variant="outlined"
                                color="inherit"
                                size="large"
                                onClick={() => setGoogleLoginOpen(true)}
                                fullWidth
                                sx={{
                                    textTransform: 'none',
                                    fontWeight: 600,
                                    borderColor: 'divider',
                                    '&:hover': {
                                        borderColor: 'text.secondary',
                                        backgroundColor: 'rgba(255,255,255,0.05)'
                                    }
                                }}
                            >
                                <GoogleIcon /> Sign in with Gmail
                            </Button>
                        </Stack>
                    </Box>

                    {/* Dialog: passwordless Gmail sign-in */}
                    <Dialog
                        open={googleLoginOpen}
                        onClose={() => !googleSubmitting && setGoogleLoginOpen(false)}
                        maxWidth="xs"
                        fullWidth
                        PaperProps={{ sx: { borderRadius: 3, p: 1 } }}
                    >
                        <DialogTitle sx={{ fontWeight: 800, pb: 1, display: 'flex', alignItems: 'center', gap: 1 }}>
                            <GoogleIcon /> Sign in with Gmail
                        </DialogTitle>

                        <DialogContent>
                            <DialogContentText sx={{ mb: 3, fontSize: 14 }}>
                                {googleStep === 1
                                    ? 'Enter your linked, verified Gmail address. We will email you a one-time sign-in code.'
                                    : `A 6-digit sign-in code was emailed to ${googleEmail}. Enter it below.`}
                            </DialogContentText>

                            {googleError && (
                                <Alert severity="error" sx={{ mb: 2, borderRadius: 2 }}>
                                    {googleError}
                                </Alert>
                            )}

                            {googleStep === 1 ? (
                                <Box component="form" onSubmit={handleGmailRequest}>
                                    <TextField
                                        fullWidth
                                        label="Gmail Address"
                                        placeholder="your.name@gmail.com"
                                        value={googleEmail}
                                        onChange={(e) => setGoogleLoginEmail(e.target.value)}
                                        variant="outlined"
                                        type="email"
                                        required
                                        disabled={googleSubmitting}
                                        sx={{ mb: 2 }}
                                    />
                                    <DialogActions sx={{ px: 0, pt: 1 }}>
                                        <Button
                                            onClick={() => setGoogleLoginOpen(false)}
                                            disabled={googleSubmitting}
                                            variant="text"
                                            sx={{ textTransform: 'none' }}
                                        >
                                            Cancel
                                        </Button>
                                        <Button
                                            type="submit"
                                            variant="contained"
                                            disabled={googleSubmitting || !googleEmail}
                                            sx={{ textTransform: 'none', px: 3 }}
                                        >
                                            {googleSubmitting ? <CircularProgress size={20} color="inherit" /> : 'Send code'}
                                        </Button>
                                    </DialogActions>
                                </Box>
                            ) : (
                                <Box component="form" onSubmit={handleGmailVerify}>
                                    <TextField
                                        fullWidth
                                        label="6-Digit Sign-In Code"
                                        placeholder="Enter code"
                                        value={googleCode}
                                        onChange={(e) => setGoogleCode(e.target.value)}
                                        variant="outlined"
                                        required
                                        disabled={googleSubmitting}
                                        helperText="Codes expire after 10 minutes."
                                        sx={{ mb: 2 }}
                                    />
                                    <DialogActions sx={{ px: 0, pt: 1 }}>
                                        <Button
                                            onClick={() => { setGoogleStep(1); setGoogleCode(''); }}
                                            disabled={googleSubmitting}
                                            variant="text"
                                            sx={{ textTransform: 'none' }}
                                        >
                                            Back
                                        </Button>
                                        <Button
                                            type="submit"
                                            variant="contained"
                                            disabled={googleSubmitting || !googleCode}
                                            sx={{ textTransform: 'none', px: 3 }}
                                        >
                                            {googleSubmitting ? <CircularProgress size={20} color="inherit" /> : 'Sign In'}
                                        </Button>
                                    </DialogActions>
                                </Box>
                            )}
                        </DialogContent>
                    </Dialog>

                    <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 3 }} textAlign="center">
                        Accounts are issued by your school administrator.
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
