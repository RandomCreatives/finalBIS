import { useState, useEffect, useRef } from 'react';
import { Link as RouterLink, useNavigate, useLocation, useSearchParams } from 'react-router-dom';
import {
    Alert, Box, Button, Card, CardContent, CircularProgress,
    Stack, TextField, Typography, Divider
} from '@mui/material';
import SchoolIcon from '@mui/icons-material/School';
import { useAuth } from '../auth/AuthContext';

const TELEGRAM_BOT_USERNAME = process.env.REACT_APP_TELEGRAM_BOT_USERNAME || '';

/**
 * Renders the official Telegram Login Widget. The widget injects an iframe
 * button; the script tag carries the bot username and the name of the global
 * callback the widget calls with the signed identity when the user authorizes.
 */
function TelegramLoginWidget({ onAuth }) {
    const containerRef = useRef(null);

    useEffect(() => {
        if (!TELEGRAM_BOT_USERNAME || !containerRef.current) return undefined;

        const container = containerRef.current;
        const script = document.createElement('script');
        script.async = true;
        script.src = 'https://telegram.org/js/telegram-widget.js?22';
        script.setAttribute('data-telegram-login', TELEGRAM_BOT_USERNAME);
        script.setAttribute('data-size', 'large');
        script.setAttribute('data-onauth', 'onTelegramAuth(user)');
        script.setAttribute('data-request-access', 'write');

        window.onTelegramAuth = (user) => onAuth(user);

        container.appendChild(script);

        return () => {
            container.innerHTML = '';
            delete window.onTelegramAuth;
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    if (!TELEGRAM_BOT_USERNAME) {
        return (
            <Typography variant="caption" color="text.disabled" sx={{ textAlign: 'center' }}>
                Telegram login is not configured. Set REACT_APP_TELEGRAM_BOT_USERNAME to enable it.
            </Typography>
        );
    }

    return (
        <Box ref={containerRef} sx={{ display: 'flex', justifyContent: 'center' }} />
    );
}

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

    const [telegramError, setTelegramError] = useState('');
    const [telegramSubmitting, setTelegramSubmitting] = useState(false);

    const { login, telegramLogin } = useAuth();
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

    const handleTelegramAuth = async (user) => {
        setTelegramError('');
        setTelegramSubmitting(true);
        try {
            await telegramLogin(user);
            navigate(destination, { replace: true });
        } catch (err) {
            setTelegramError(err.message || 'Telegram sign-in failed. Please try again.');
        } finally {
            setTelegramSubmitting(false);
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

                            {telegramError && (
                                <Alert severity="error" sx={{ mb: 2 }}>{telegramError}</Alert>
                            )}

                            {telegramSubmitting ? (
                                <Stack alignItems="center" sx={{ py: 1 }}>
                                    <CircularProgress size={24} />
                                </Stack>
                            ) : (
                                <TelegramLoginWidget onAuth={handleTelegramAuth} />
                            )}
                        </Stack>
                    </Box>

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
