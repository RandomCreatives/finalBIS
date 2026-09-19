import { useState } from 'react';
import { Link as RouterLink, useNavigate, useLocation, useSearchParams } from 'react-router-dom';
import {
    Alert, Box, Button, Card, CardContent, CircularProgress,
    Stack, TextField, Typography, IconButton, InputAdornment
} from '@mui/material';
import SchoolIcon from '@mui/icons-material/School';
import VisibilityIcon from '@mui/icons-material/Visibility';
import VisibilityOffIcon from '@mui/icons-material/VisibilityOff';
import { useAuth } from '../auth/AuthContext';

/**
 * The single sign-in screen for all staff.
 *
 * Email + password only — deliberately simple (card-style sign-ins
 * for main and subject teachers live on their own walls).
 */
export default function Login() {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [error, setError] = useState('');
    const [submitting, setSubmitting] = useState(false);

    const { login } = useAuth();
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

    const handleSubmit = async (event) => {
        event.preventDefault();
        setError('');
        setSubmitting(true);
        try {
            const profile = await login(email.trim(), password);
            navigate(profile?.role === 'subject_teacher' ? '/subject-home' : destination, { replace: true });
        } catch (err) {
            setError(err.message || 'Sign in failed. Please check your credentials.');
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
                background: 'linear-gradient(135deg, #0f172a 0%, #1e3a8a 50%, #2563eb 100%)',
            }}
        >
            <Card sx={{ width: '100%', maxWidth: 440, borderRadius: 3, boxShadow: '0 20px 25px -5px rgba(0,0,0,0.2)' }}>
                <CardContent sx={{ p: { xs: 3, sm: 4 } }}>
                    <Stack spacing={1} alignItems="center" sx={{ mb: 3 }}>
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

                    {error && <Alert severity="error" sx={{ mb: 2, borderRadius: 2 }}>{error}</Alert>}

                    <Box component="form" onSubmit={handleSubmit} noValidate>
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

                    <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 3 }} textAlign="center">
                        Staff accounts are issued by your school administrator.
                    </Typography>
                    <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 1 }} textAlign="center">
                        Subject teacher?{' '}
                        <RouterLink to="/subject-login" style={{ color: 'inherit', fontWeight: 700 }}>
                            Sign in with your teacher card
                        </RouterLink>
                        {' '}instead. Main teachers use their class card.
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
