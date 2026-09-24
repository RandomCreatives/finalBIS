import { Alert, Box, FormControlLabel, Grid, Stack, Switch, Typography } from '@mui/material';
import SettingsIcon from '@mui/icons-material/Settings';
import { useState } from 'react';
import { useAuth } from '../auth/AuthContext';
import useApi from '../hooks/useApi';
import { paymentApi } from '../api/endpoints';
import {
    IdentityCard, TelegramCard, SecurityCard, TeachingCard, PreferencesCard,
} from '../components/settings/profileCards';

const ROLE_LABELS = {
    admin: 'System Administrator',
    main_teacher: 'Main Teacher',
    assistant_teacher: 'Assistant Teacher',
    subject_teacher: 'Subject Teacher',
    store_manager: 'Store Manager',
    librarian: 'Librarian',
};

/** Admin shell: /app/settings. Shared cards, full rights (name editable). */
export default function Settings() {
    const { user } = useAuth();
    const isAdmin = user?.role === 'admin';
    const paymentSetting = useApi(
        () => (isAdmin ? paymentApi.teacherVisibility() : Promise.resolve(null)),
        [isAdmin],
    );
    const [paymentSaving, setPaymentSaving] = useState(false);
    const [paymentError, setPaymentError] = useState('');
    const teacherPaymentsEnabled = paymentSetting.data?.teacherPaymentsEnabled === true;

    const setTeacherPayments = async (enabled) => {
        setPaymentSaving(true);
        setPaymentError('');
        try {
            await paymentApi.setTeacherVisibility(enabled);
            await paymentSetting.reload();
        } catch (err) {
            setPaymentError(err.message || 'Could not update payment visibility.');
        } finally {
            setPaymentSaving(false);
        }
    };

    return (
        <Box sx={{ maxWidth: 1000, mx: 'auto', p: 1 }}>
            <Stack direction="row" alignItems="center" spacing={1.5} sx={{ mb: 3.5 }}>
                <SettingsIcon color="primary" sx={{ fontSize: 30 }} />
                <Typography variant="h4" component="h1" sx={{ fontWeight: 800, fontSize: 26 }}>
                    Profile & Settings
                </Typography>
            </Stack>

            {isAdmin && (
                <Box sx={{ mb: 2.5, p: 2.5, border: '1px solid', borderColor: 'divider', borderRadius: 3 }}>
                    <Typography sx={{ fontWeight: 800, fontSize: 15.5 }}>Teacher payment panel</Typography>
                    <Typography variant="body2" color="text.secondary" sx={{ mt: .5, mb: 1.5 }}>
                        Payments are an office responsibility. Turn this on only if main teachers should see
                        payment status and controls on their class page.
                    </Typography>
                    <FormControlLabel
                        control={(
                            <Switch
                                checked={teacherPaymentsEnabled}
                                disabled={paymentSaving || paymentSetting.loading}
                                onChange={(e) => setTeacherPayments(e.target.checked)}
                                inputProps={{ 'aria-label': 'Allow teachers to see payment panel' }}
                            />
                        )}
                        label={teacherPaymentsEnabled ? 'Teacher payment panel on' : 'Teacher payment panel off'}
                        sx={{ fontWeight: 700 }}
                    />
                    {paymentSetting.data?.migrationPending && (
                        <Alert severity="warning" sx={{ mt: 1.5 }}>
                            Paste migration 020_teacher_payment_visibility.sql before changing this switch.
                        </Alert>
                    )}
                    {paymentError && <Alert severity="error" sx={{ mt: 1.5 }}>{paymentError}</Alert>}
                </Box>
            )}

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
