import { Link as RouterLink, useLocation, useSearchParams } from 'react-router-dom';
import { Alert, Box, Button, Card, CardContent, Container, Stack, Typography } from '@mui/material';
import AdminPanelSettingsIcon from '@mui/icons-material/AdminPanelSettings';
import SchoolIcon from '@mui/icons-material/School';
import MenuBookIcon from '@mui/icons-material/MenuBook';
import BadgeIcon from '@mui/icons-material/Badge';
import LocalHospitalIcon from '@mui/icons-material/LocalHospital';
import LibraryBooksIcon from '@mui/icons-material/LibraryBooks';
import StorefrontIcon from '@mui/icons-material/Storefront';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import { useColorScheme } from '../theme';
import { requestedPathFromState, safeNextPath } from '../auth/roleRouting';

const OPTIONS = [
    { role: 'admin', label: 'Administrator', description: 'Administrator account sign-in', to: '/login', icon: <AdminPanelSettingsIcon /> },
    { role: 'main_teacher', label: 'Main Teacher', description: 'Enter your class password', to: '/pwa-main-teacher-login', icon: <SchoolIcon /> },
    { role: 'subject_teacher', label: 'Subject Teacher', description: 'Subject teacher account sign-in', to: '/subject-login', icon: <MenuBookIcon /> },
    { role: 'assistant_teacher', label: 'Assistant Teacher', description: 'School email and password sign-in', to: '/login', icon: <BadgeIcon /> },
    { role: 'librarian', label: 'Librarian', description: 'Library staff sign-in', to: '/librarian-login', icon: <LibraryBooksIcon /> },
    { role: 'nurse', label: 'Nurse', description: 'Clinic staff sign-in', to: '/nurse-login', icon: <LocalHospitalIcon /> },
    { role: 'store_manager', label: 'Store Manager', description: 'School email and password sign-in', to: '/login', icon: <StorefrontIcon /> },
];

export default function PwaSignIn() {
    const { toggleColorScheme } = useColorScheme();
    const location = useLocation();
    const [params] = useSearchParams();
    const returnTo = requestedPathFromState(location.state) || safeNextPath(params.get('next'));
    const expired = params.get('expired') === '1';

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
                        Choose your school role to continue. Teachers will see their own sign-in, not the administrator form.
                    </Typography>
                </Box>
                {expired && (
                    <Alert severity="info" sx={{ mb: 2 }}>
                        Your session expired. Choose your role to sign in again.
                    </Alert>
                )}
                <Stack spacing={1.5}>
                    {OPTIONS.map((option) => (
                        <Card key={option.label} variant="outlined" sx={{ borderRadius: 2 }}>
                            <CardContent sx={{ p: 1.5, '&:last-child': { pb: 1.5 } }}>
                                <Button
                                    fullWidth component={RouterLink} to={option.to}
                                    state={{
                                        expectedRole: option.role,
                                        ...(returnTo ? { from: { path: returnTo } } : {}),
                                    }}
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
            <Box component="footer" sx={{ px: 2, py: 1.5, textAlign: 'center', bgcolor: 'background.paper', borderTop: 1, borderColor: 'divider' }}>
                <Typography sx={{ fontSize: 10, color: 'text.secondary' }}>BIS NOC Gerji · Staff portal</Typography>
            </Box>
        </Box>
    );
}
