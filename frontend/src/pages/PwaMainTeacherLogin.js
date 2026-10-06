import { useState } from 'react';
import { Link as RouterLink, useNavigate } from 'react-router-dom';
import { Alert, Box, Button, Card, CardContent, Container, IconButton, InputAdornment, Stack, TextField, Typography } from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import SchoolIcon from '@mui/icons-material/School';
import VisibilityIcon from '@mui/icons-material/Visibility';
import VisibilityOffIcon from '@mui/icons-material/VisibilityOff';
import LoginIcon from '@mui/icons-material/Login';
import { authApi } from '../api/endpoints';
import { setToken } from '../api/client';
import { saveClassLogin } from '../data/classes';
import { useColorScheme } from '../theme';

export default function PwaMainTeacherLogin() {
    const navigate = useNavigate();
    const { toggleColorScheme } = useColorScheme();
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [error, setError] = useState('');
    const [submitting, setSubmitting] = useState(false);

    const submit = async (event) => {
        event.preventDefault();
        if (submitting || !password) return;
        setSubmitting(true);
        setError('');
        try {
            const data = await authApi.classPasswordLogin(password);
            setToken(data.token);
            saveClassLogin({ name: data.class.name, mainTeacher: data.user.name }, {
                classId: data.class.id,
                userId: data.user.id,
                teacher: data.user.name,
            });
            navigate(`/class-home/${data.class.name.toLowerCase().replace(/\s*-\s*/g, '-').replace(/\s+/g, '-')}`, { replace: true });
        } catch (err) {
            setError(err.message || 'Incorrect class password');
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <Box sx={{ minHeight: '100vh', bgcolor: 'background.default', display: 'flex', flexDirection: 'column' }}>
            <Box sx={{ px: 2, py: 1.5, display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: 1, borderColor: 'divider', bgcolor: 'background.paper' }}>
                <Button component={RouterLink} to="/pwa-sign-in" startIcon={<ArrowBackIcon />} size="small" sx={{ textTransform: 'none', fontWeight: 700 }}>Back</Button>
                <Button onClick={toggleColorScheme} size="small" sx={{ minWidth: 0, textTransform: 'none', fontWeight: 700 }}>Theme</Button>
            </Box>
            <Container maxWidth="xs" sx={{ py: 6, flexGrow: 1 }}>
                <Card variant="outlined" sx={{ borderRadius: 3 }}>
                    <CardContent sx={{ p: 3 }}>
                        <Stack alignItems="center" spacing={1.5} sx={{ mb: 3 }}>
                            <Box sx={{ width: 52, height: 52, borderRadius: 2, display: 'grid', placeItems: 'center', bgcolor: 'primary.main', color: '#fff' }}>
                                <SchoolIcon />
                            </Box>
                            <Typography variant="h5" sx={{ fontWeight: 900 }}>Main Teacher</Typography>
                            <Typography variant="body2" color="text.secondary" align="center">
                                Enter your class password. Your class will be identified automatically.
                            </Typography>
                        </Stack>
                        <Box component="form" onSubmit={submit}>
                            <Stack spacing={2}>
                                {error && <Alert severity="error">{error}</Alert>}
                                <TextField
                                    label="Class password" type={showPassword ? 'text' : 'password'}
                                    value={password} onChange={(event) => setPassword(event.target.value)}
                                    autoFocus fullWidth required autoComplete="current-password"
                                    InputProps={{ endAdornment: (
                                        <InputAdornment position="end">
                                            <IconButton onClick={() => setShowPassword((value) => !value)} edge="end" aria-label={showPassword ? 'Hide password' : 'Show password'}>
                                                {showPassword ? <VisibilityOffIcon /> : <VisibilityIcon />}
                                            </IconButton>
                                        </InputAdornment>
                                    ) }}
                                />
                                <Button type="submit" variant="contained" size="large" disabled={submitting || !password} startIcon={<LoginIcon />} sx={{ textTransform: 'none', fontWeight: 800 }}>
                                    {submitting ? 'Signing in…' : 'Sign in'}
                                </Button>
                            </Stack>
                        </Box>
                    </CardContent>
                </Card>
            </Container>
        </Box>
    );
}
