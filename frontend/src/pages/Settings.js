import { Box, Grid, Stack, Typography } from '@mui/material';
import SettingsIcon from '@mui/icons-material/Settings';
import { useAuth } from '../auth/AuthContext';
import {
    IdentityCard, TelegramCard, SecurityCard, TeachingCard, PreferencesCard,
} from '../components/settings/profileCards';

const ROLE_LABELS = {
    admin: 'System Administrator',
    main_teacher: 'Main Teacher',
    assistant_teacher: 'Assistant Teacher',
    subject_teacher: 'Subject Teacher',
    store_manager: 'Store Manager',
};

/** Admin shell: /app/settings. Shared cards, full rights (name editable). */
export default function Settings() {
    const { user } = useAuth();

    return (
        <Box sx={{ maxWidth: 1000, mx: 'auto', p: 1 }}>
            <Stack direction="row" alignItems="center" spacing={1.5} sx={{ mb: 3.5 }}>
                <SettingsIcon color="primary" sx={{ fontSize: 30 }} />
                <Typography variant="h4" component="h1" sx={{ fontWeight: 800, fontSize: 26 }}>
                    Profile & Settings
                </Typography>
            </Stack>

            <Grid container spacing={2.5}>
                <Grid item xs={12} md={7}>
                    <Stack spacing={2.5}>
                        <IdentityCard
                            roleLabel={ROLE_LABELS[user?.role] || user?.role}
                            canEditName
                        />
                        <SecurityCard mode="self-service" />
                    </Stack>
                </Grid>
                <Grid item xs={12} md={5}>
                    <Stack spacing={2.5}>
                        <TelegramCard />
                        <TeachingCard
                            title="System access"
                            items={[
                                { primary: user?.role === 'admin' && user?.name?.toLowerCase().includes('leul')
                                    ? 'Director — structure, staff accounts, marks overrides'
                                    : 'Coordinator — timetable, students, attendance unlocks',
                                  secondary: 'This account holds administrator privileges' },
                            ]}
                            emptyHint="Administrator access"
                        />
                        <PreferencesCard />
                    </Stack>
                </Grid>
            </Grid>
        </Box>
    );
}
