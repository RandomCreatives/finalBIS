import { useState } from 'react';
import { Link as RouterLink, useNavigate } from 'react-router-dom';
import {
    Alert, Box, Button, Card, CardContent, Container, Stack, TextField, Typography,
} from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import MenuBookIcon from '@mui/icons-material/MenuBook';
import { useAuth } from '../auth/AuthContext';

const LIBRARIAN_EMAIL = 'librarian@bisnoc.local';

export default function LibrarianLogin() {
    const { login } = useAuth();
    const navigate = useNavigate();
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    const submit = async (event) => {
        event.preventDefault();
        if (!password || loading) return;
        setLoading(true);
        setError('');
        try {
            await login(LIBRARIAN_EMAIL, password);
            navigate('/app/library', { replace: true });
        } catch (err) {
            setError(err.message || 'Incorrect password');
        } finally {
            setLoading(false);
        }
    };

    return (
        <Box sx={{ minHeight: '100vh', display: 'flex', alignItems: 'center', bgcolor: 'background.default' }}>
            <Container maxWidth="sm">
                <Button
                    component={RouterLink} to="/" startIcon={<ArrowBackIcon />}
                    sx={{ mb: 2, textTransform: 'none', fontWeight: 700, color: 'text.secondary' }}
                >
                    Back to school page
                </Button>
                <Card variant="outlined" sx={{ borderRadius: 3 }}>
                    <CardContent sx={{ p: { xs: 3, sm: 4 } }}>
                        <Stack direction="row" spacing={1.5} alignItems="center" sx={{ mb: 1 }}>
                            <Box sx={{ width: 42, height: 42, borderRadius: 2, display: 'grid', placeItems: 'center', bgcolor: 'primary.main', color: '#fff' }}>
                                <MenuBookIcon />
                            </Box>
                            <Box>
                                <Typography variant="h5" sx={{ fontWeight: 800 }}>Library login</Typography>
                                <Typography variant="body2" color="text.secondary">BIS NOC Gerji · Librarian</Typography>
                            </Box>
                        </Stack>
                        <Typography variant="body2" color="text.secondary" sx={{ mb: 2.5 }}>
                            Enter the librarian password to manage student book loans and returns.
                        </Typography>
                        <Box component="form" onSubmit={submit}>
                            <TextField
                                autoFocus fullWidth required type="password" label="Password"
                                value={password} onChange={(e) => setPassword(e.target.value)}
                                inputProps={{ 'data-testid': 'librarian-password' }}
                            />
                            {error && <Alert severity="error" sx={{ mt: 2 }}>{error}</Alert>}
                            <Button
                                type="submit" fullWidth variant="contained" disableElevation
                                disabled={loading || !password}
                                sx={{ mt: 2, py: 1.25, textTransform: 'none', fontWeight: 800 }}
                            >
                                {loading ? 'Signing in…' : 'Open Library'}
                            </Button>
                        </Box>
                    </CardContent>
                </Card>
            </Container>
        </Box>
    );
}
