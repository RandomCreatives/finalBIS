import { Link as RouterLink } from 'react-router-dom';
import { Box, Button, Container, Typography } from '@mui/material';
import LoginIcon from '@mui/icons-material/Login';
import { useAuth } from '../auth/AuthContext';

export default function Landing() {
    const { isAuthenticated } = useAuth();

    return (
        <Box
            sx={{
                minHeight: '100vh',
                display: 'flex',
                flexDirection: 'column',
                backgroundColor: '#0f172a',
                color: '#f8fafc',
                fontFamily: '"Inter", "Poppins", -apple-system, BlinkMacSystemFont, sans-serif',
            }}
        >
            <Container
                maxWidth="md"
                sx={{
                    flex: 1,
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'center',
                    alignItems: 'center',
                    textAlign: 'center',
                    px: { xs: 2, sm: 3 },
                }}
            >
                <Typography
                    variant="h1"
                    component="h1"
                    sx={{
                        fontSize: { xs: '2rem', sm: '2.8rem' },
                        fontWeight: 800,
                        letterSpacing: '-0.03em',
                        mb: 2,
                    }}
                >
                    British International School
                </Typography>

                <Typography
                    variant="h2"
                    component="h2"
                    sx={{
                        fontSize: { xs: '1.3rem', sm: '1.6rem' },
                        fontWeight: 300,
                        color: '#cbd5e1',
                        mb: 4,
                    }}
                >
                    NOC Gerji Campus
                </Typography>

                <Typography
                    variant="body1"
                    sx={{
                        fontSize: '1.05rem',
                        color: '#94a3b8',
                        mb: 5,
                        maxWidth: 520,
                        lineHeight: 1.7,
                    }}
                >
                    Staff Portal — manage teaching assignments, attendance,
                    lessons and student records.
                </Typography>

                <Button
                    variant="contained"
                    size="large"
                    component={RouterLink}
                    to={isAuthenticated ? '/app' : '/login'}
                    startIcon={<LoginIcon />}
                    sx={{
                        backgroundColor: '#ffffff',
                        color: '#0f172a',
                        fontWeight: 700,
                        px: 5,
                        py: 1.8,
                        fontSize: '1.05rem',
                        borderRadius: 2,
                        boxShadow: '0 10px 30px rgba(255, 255, 255, 0.15)',
                        transition: 'all 0.25s ease',
                        '&:hover': {
                            backgroundColor: '#f1f5f9',
                            transform: 'translateY(-2px)',
                            boxShadow: '0 14px 34px rgba(255, 255, 255, 0.22)',
                        },
                    }}
                >
                    {isAuthenticated ? 'Open Staff Dashboard' : 'Staff Sign In'}
                </Button>
            </Container>

            <Box
                sx={{
                    py: 2.5,
                    textAlign: 'center',
                    borderTop: '1px solid #1e293b',
                    mt: 'auto',
                }}
            >
                <Typography variant="caption" sx={{ color: '#64748a', fontSize: '0.8rem' }}>
                    &copy; {new Date().getFullYear()} British International School, NOC Gerji Campus.
                    &nbsp;|&nbsp; Internal Staff Use Only
                </Typography>
            </Box>
        </Box>
    );
}
