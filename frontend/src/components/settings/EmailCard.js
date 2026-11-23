import {
    Alert, Box, Button, Card, CardContent, Chip, Stack,
    TextField, Typography,
} from '@mui/material';
import EmailIcon from '@mui/icons-material/Email';
import VerifiedIcon from '@mui/icons-material/Verified';
import ErrorIcon from '@mui/icons-material/ErrorOutline';
import { useState } from 'react';
import { authApi } from '../../api/endpoints';
import useApi from '../../hooks/useApi';
import { useAuth } from '../../auth/AuthContext';

/**
 * Email change with verification.
 *
 * Flow:
 *   1. User clicks "Change email" → enters new Gmail address
 *   2. Clicks "Send code" → backend sends 6-digit code to new address
 *   3. User enters the 6-digit code → clicks "Verify & change"
 *   4. Backend swaps pending_email → email, marks is_email_verified = true
 *
 * Only Gmail addresses (@gmail.com) are accepted — enforced by the server.
 * The current email is shown read-only until a change is in progress.
 */

const GMAIL_RE = /^[a-zA-Z0-9._%+-]+@gmail\.com$/;

export function EmailCard() {
    const { user, updateUser } = useAuth();
    const me = useApi(() => authApi.me().catch(() => null), [user?.id]);

    const currentEmail = user?.email || me.data?.email || '';
    const isEmailVerified = user?.isEmailVerified ?? me.data?.isEmailVerified ?? false;

    // ── state ──────────────────────────────────────────────────────────
    const [step, setStep] = useState('idle'); // idle | entering | verifying | done
    const [newEmail, setNewEmail] = useState('');
    const [code, setCode] = useState('');
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');
    const [message, setMessage] = useState('');

    // ── helpers ────────────────────────────────────────────────────────
    const reset = () => {
        setStep('idle');
        setNewEmail('');
        setCode('');
        setError('');
        setMessage('');
    };

    const startChange = () => {
        setError(''); setMessage(''); setStep('entering');
    };

    const sendCode = async () => {
        if (!GMAIL_RE.test(newEmail)) {
            return setError('Enter a valid Gmail address (@gmail.com)');
        }
        setBusy(true); setError(''); setMessage('');
        try {
            await authApi.sendVerificationCode(newEmail);
            setStep('verifying');
            setMessage(`Verification code sent to ${newEmail}. Check your inbox.`);
        } catch (err) {
            setError(err.message || 'Could not send verification code. Please try again.');
        } finally {
            setBusy(false);
        }
    };

    const verifyAndChange = async () => {
        if (!code || code.length !== 6) {
            return setError('Please enter the 6-digit code');
        }
        setBusy(true); setError(''); setMessage('');
        try {
            await authApi.verifyCode(code);
            const fresh = await authApi.me();
            updateUser(fresh);
            setStep('done');
            setMessage(`Email changed to ${newEmail}.`);
        } catch (err) {
            setError(err.message || 'Invalid or expired code. Request a new one.');
        } finally {
            setBusy(false);
        }
    };

    // ── render ─────────────────────────────────────────────────────────
    return (
        <Card variant="outlined" sx={{ borderRadius: 3, height: '100%' }}>
            <CardContent sx={{ p: 3 }}>
                <Stack direction="row" spacing={1.5} alignItems="center" sx={{ mb: 0.5 }}>
                    <Box sx={{
                        width: 36, height: 36, borderRadius: 2, bgcolor: '#0f172a',
                        color: '#fff', display: 'flex', alignItems: 'center',
                        justifyContent: 'center', flexShrink: 0,
                    }}>
                        <EmailIcon sx={{ fontSize: 19 }} />
                    </Box>
                    <Box>
                        <Typography sx={{ fontWeight: 800, fontSize: 15.5, lineHeight: 1.2 }}>
                            Email address
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                            Gmail only · used for sign-in and password resets
                        </Typography>
                    </Box>
                </Stack>

                <Box sx={{ mt: 2 }}>
                    {/* Current email display */}
                    <Box component="form" onSubmit={(e) => { e.preventDefault(); startChange(); }}
                        sx={{ display: 'flex', gap: 1, mb: 2, flexDirection: { xs: 'column', sm: 'row' } }}>
                        <TextField
                            label="Current email" size="small" fullWidth
                            value={currentEmail} InputProps={{ readOnly: true }}
                            disabled
                        />
                        <Button
                            type="submit" variant="outlined" disabled={busy}
                            sx={{ textTransform: 'none', fontWeight: 700, borderRadius: 2, minHeight: 40 }}
                        >
                            Change email
                        </Button>
                    </Box>

                    {(error || message) && (
                        <Alert severity={error ? 'error' : 'success'} sx={{ mb: 2 }}>
                            {error || message}
                        </Alert>
                    )}

                    {/* Step: entering new email */}
                    {step === 'entering' && (
                        <Box component="form" onSubmit={sendCode}
                            sx={{ display: 'flex', gap: 1, mb: 2, flexDirection: { xs: 'column', sm: 'row' } }}>
                            <TextField
                                label="New Gmail address" size="small" fullWidth
                                value={newEmail} onChange={(e) => setNewEmail(e.target.value)}
                                placeholder="you@gmail.com"
                            />
                            <Button
                                type="submit" variant="contained" disableElevation
                                disabled={busy || !GMAIL_RE.test(newEmail)}
                                sx={{ textTransform: 'none', fontWeight: 700, borderRadius: 2, minHeight: 40 }}
                            >
                                {busy ? 'Sending…' : 'Send code'}
                            </Button>
                        </Box>
                    )}

                    {/* Step: verifying code */}
                    {step === 'verifying' && (
                        <Box component="form" onSubmit={verifyAndChange}
                            sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                            <TextField
                                label="6-digit verification code" size="small" fullWidth
                                value={code} onChange={(e) => setCode(e.target.value)}
                                inputProps={{ maxLength: 6 }}
                                helperText="Code expires in 10 minutes"
                            />
                            <Button
                                type="submit" variant="contained" disableElevation
                                disabled={busy || code.length !== 6}
                                sx={{ textTransform: 'none', fontWeight: 700, borderRadius: 2, minHeight: 42 }}
                            >
                                {busy ? 'Verifying…' : 'Verify & change email'}
                            </Button>
                            <Button
                                variant="text" size="small" onClick={reset} disabled={busy}
                                sx={{ textTransform: 'none', color: 'text.secondary', alignSelf: 'flex-start' }}
                            >
                                Cancel
                            </Button>
                        </Box>
                    )}

                    {/* Step: done */}
                    {step === 'done' && (
                        <Stack direction="row" spacing={1} alignItems="center">
                            <VerifiedIcon sx={{ fontSize: 20, color: 'success.main' }} />
                            <Typography variant="body2" color="success.main" sx={{ fontWeight: 700 }}>
                                Email updated
                            </Typography>
                        </Stack>
                    )}

                    {/* Verified chip */}
                    <Box sx={{ mt: 1.5 }}>
                        <Chip
                            label={isEmailVerified ? 'Verified' : 'Not verified'}
                            color={isEmailVerified ? 'success' : 'default'}
                            variant={isEmailVerified ? 'outlined' : 'outlined'}
                            size="small"
                            icon={isEmailVerified ? <VerifiedIcon fontSize="small" /> : <ErrorIcon fontSize="small" />}
                            sx={{ fontWeight: 700 }}
                        />
                        {!isEmailVerified && (
                            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5, lineHeight: 1.5 }}>
                                Your email is not yet verified. Change it above to verify.
                            </Typography>
                        )}
                    </Box>
                </Box>
            </CardContent>
        </Card>
    );
}
