import { Link as RouterLink } from 'react-router-dom';
import { Box, Button, Card, CardContent, Container, Stack, Typography } from '@mui/material';
import AdminPanelSettingsIcon from '@mui/icons-material/AdminPanelSettings';
import SchoolIcon from '@mui/icons-material/School';
import MenuBookIcon from '@mui/icons-material/MenuBook';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import { useColorScheme } from '../theme';

const OPTIONS = [
    { label: 'Admin', description: 'Coordinator and administrator sign-in', to: '/login', icon: <AdminPanelSettingsIcon /> },
    { label: 'Main Teacher', description: 'Enter your class password', to: '/pwa-main-teacher-login', icon: <SchoolIcon /> },
    { label: 'Subject Teacher', description: 'Subject teacher account sign-in', to: '/subject-login', icon: <MenuBookIcon /> },
];

export default function PwaSignIn() {
    const { toggleColorScheme } = useColorScheme();

    return (
        <Box sx={{ minHeight: '100vh', bgcolor: 'background.default', color: 'text.primary', display: 'flex', flexDirection: 'column' }}>
            <Box sx={{ px: 2, py: 1.5, display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: 1, borderColor: 'divider', bgcolor: 'background.paper' }}>
                <Button component={RouterLink} to="/" startIcon={<ArrowBackIcon />} size="small" sx={{ textTransform: 'none', fontWeight: 700 }}>
                    Back
                </Button>
                <Button onClick={toggleColorScheme} size="small" sx={{ minWidth: 0, textTransform: 'none', fontWeight: 700 }}>
                    Theme
                </Button>
            </Box>
            <Container maxWidth="sm" sx={{ py: 6, flexGrow: 1 }}>
                <Box sx={{ textAlign: 'center', mb: 4 }}>
                    <Box component="img" src="/bis-logo.png" alt="BIS Gerji" sx={{ width: 220, maxWidth: '80%', height: 'auto', mb: 3 }} />
                    <Typography variant="h5" sx={{ fontWeight: 900 }}>Sign in</Typography>
                    <Typography color="text.secondary" sx={{ mt: 1 }}>
                        Choose your school role to continue.
                    </Typography>
                </Box>
                <Stack spacing={1.5}>
                    {OPTIONS.map((option) => (
                        <Card key={option.label} variant="outlined" sx={{ borderRadius: 2 }}>
                            <CardContent sx={{ p: 1.5, '&:last-child': { pb: 1.5 } }}>
                                <Button
                                    fullWidth component={RouterLink} to={option.to}
                                    startIcon={option.icon}
                                    sx={{ justifyContent: 'flex-start', textAlign: 'left', textTransform: 'none', py: 1, fontWeight: 800 }}
                                >
                                    <Box>
                                        <Typography sx={{ fontWeight: 800, lineHeight: 1.2 }}>{option.label}</Typography>
                                        <Typography variant="caption" color="text.secondary">{option.description}</Typography>
                                    </Box>
                                </Button>
                            </CardContent>
                        </Card>
                    ))}
                </Stack>
            </Container>
            <Box component="footer" sx={{ px: 2, py: 3, textAlign: 'center', bgcolor: 'background.paper', borderTop: 1, borderColor: 'divider' }}>
                <Typography variant="caption" color="text.secondary">BIS NOC Gerji · Staff portal</Typography>
            </Box>
        </Box>
    );
}
