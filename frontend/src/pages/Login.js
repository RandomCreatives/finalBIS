import { useState } from 'react';
import { Link as RouterLink, useNavigate, useLocation, useSearchParams } from 'react-router-dom';
import {
    Alert, Box, Button, Card, CardContent, CircularProgress,
    Stack, TextField, Typography,
} from '@mui/material';
import SchoolIcon from '@mui/icons-material/School';
import { useAuth } from '../auth/AuthContext';

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

    const { login } = useAuth();
    const navigate = useNavigate();
    const location = useLocation();
    const [params] = useSearchParams();

    const expired = params.get('expired') === '1';
    const destination = location.state?.from?.pathname || '/app';

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
