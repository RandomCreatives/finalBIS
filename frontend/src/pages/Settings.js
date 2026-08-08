import { useState } from 'react';
import {
    Box,
    Card,
    CardContent,
    Typography,
    Grid,
    TextField,
    Button,
    Divider,
    Avatar,
    Alert,
    IconButton,
    InputAdornment,
    Stack,
    Switch,
    FormControlLabel,
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
} from '@mui/material';
import PersonIcon from '@mui/icons-material/Person';
import LockIcon from '@mui/icons-material/Lock';
import VisibilityIcon from '@mui/icons-material/Visibility';
import VisibilityOffIcon from '@mui/icons-material/VisibilityOff';
import SaveIcon from '@mui/icons-material/Save';
import SettingsIcon from '@mui/icons-material/Settings';
import LightModeIcon from '@mui/icons-material/LightMode';
import DarkModeIcon from '@mui/icons-material/DarkMode';
import VerifiedIcon from '@mui/icons-material/Verified';
import VerifiedUserIcon from '@mui/icons-material/VerifiedUser';
import { useAuth } from '../auth/AuthContext';
import { useColorScheme } from '../theme';
import { authApi } from '../api/endpoints';

const ROLE_LABELS = {
    admin: 'System Administrator',
    main_teacher: 'Main Teacher',
    assistant_teacher: 'Assistant Teacher',
    subject_teacher: 'Subject Teacher',
};

export default function Settings() {
    const { user, updateUser } = useAuth();
    const { toggleColorScheme } = useColorScheme();
    const theme = useColorScheme(); // to get the active mode or theme palette

    // Profile state
    const [name, setName] = useState(user?.name || '');
    const [profileSuccess, setProfileSuccess] = useState('');
    const [profileError, setProfileError] = useState('');
    const [updatingProfile, setUpdatingProfile] = useState(false);

    // Security/Password state
    const [currentPassword, setCurrentPassword] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [showCurrentPassword, setShowCurrentPassword] = useState(false);
    const [showNewPassword, setShowNewPassword] = useState(false);
    const [showConfirmPassword, setShowConfirmPassword] = useState(false);
    const [passwordSuccess, setPasswordSuccess] = useState('');
    const [passwordError, setPasswordError] = useState('');
    const [updatingPassword, setUpdatingPassword] = useState(false);

    // Gmail verification state
    const [verificationDialogOpen, setVerificationDialogOpen] = useState(false);
    const [verificationStep, setVerificationStep] = useState(1);
    const [gmailAddress, setGmailAddress] = useState('');
    const [verificationCode, setVerificationCode] = useState('');
    const [verificationError, setVerificationError] = useState('');
    const [verificationSuccess, setVerificationSuccess] = useState('');
    const [verificationLoading, setVerificationLoading] = useState(false);

    // Handle Profile Update
    const handleProfileSubmit = async (e) => {
        e.preventDefault();
        setProfileError('');
        setProfileSuccess('');

        if (!name.trim()) {
            setProfileError('Name is required');
            return;
        }

        setUpdatingProfile(true);
        try {
            const data = await authApi.updateProfile(name);
            updateUser(data.user);
            setProfileSuccess('Profile updated successfully!');
        } catch (err) {
            setProfileError(err.message || 'Failed to update profile');
        } finally {
            setUpdatingProfile(false);
        }
    };

    // Handle Password Change
    const handlePasswordSubmit = async (e) => {
        e.preventDefault();
        setPasswordError('');
        setPasswordSuccess('');

        if (!currentPassword) {
            setPasswordError('Current password is required');
            return;
        }

        if (newPassword.length < 10) {
            setPasswordError('New password must be at least 10 characters long');
            return;
        }

        if (newPassword !== confirmPassword) {
            setPasswordError('New passwords do not match');
            return;
        }

        setUpdatingPassword(true);
        try {
            await authApi.changePassword(currentPassword, newPassword);
            setPasswordSuccess('Password changed successfully!');
            setCurrentPassword('');
            setNewPassword('');
            setConfirmPassword('');
        } catch (err) {
            setPasswordError(err.message || 'Failed to change password');
        } finally {
            setUpdatingPassword(false);
        }
    };

    // Handle Gmail verification
    const handleRequestVerificationCode = async () => {
        setVerificationError('');
        setVerificationSuccess('');
        setVerificationLoading(true);
        try {
            await authApi.sendVerificationCode(gmailAddress);
            setVerificationStep(2);
            setVerificationSuccess('Verification code sent! Check your Gmail inbox.');
        } catch (err) {
            setVerificationError(err.message || 'Failed to send verification code');
        } finally {
            setVerificationLoading(false);
        }
    };

    const handleVerifyCode = async () => {
        setVerificationError('');
        setVerificationLoading(true);
        try {
            const result = await authApi.verifyCode(verificationCode);
            updateUser(result.user);
            setVerificationSuccess('Gmail address verified successfully!');
            setVerificationDialogOpen(false);
            setGmailAddress('');
            setVerificationCode('');
            setVerificationStep(1);
        } catch (err) {
            setVerificationError(err.message || 'Invalid verification code');
        } finally {
            setVerificationLoading(false);
        }
    };

    return (
        <Box sx={{ maxWidth: 1000, mx: 'auto', p: 1 }}>
            {/* Header */}
            <Stack direction="row" alignItems="center" spacing={1.5} sx={{ mb: 4 }}>
                <SettingsIcon color="primary" sx={{ fontSize: 32 }} />
                <Typography variant="h4" component="h1">
                    Account Settings
                </Typography>
            </Stack>

            <Grid container spacing={3}>
                {/* Left Side: Overview & Theme Preferences */}
                <Grid item xs={12} md={4}>
                    <Stack spacing={3}>
                        {/* Summary Profile Card */}
                        <Card>
                            <CardContent sx={{ textAlign: 'center', py: 4 }}>
                                <Avatar
                                    sx={{
                                        width: 80,
                                        height: 80,
                                        mx: 'auto',
                                        mb: 2,
                                        bgcolor: 'primary.main',
                                        fontSize: 28,
                                        fontWeight: 700,
                                    }}
                                >
                                    {user?.name?.charAt(0)?.toUpperCase()}
                                </Avatar>
                                <Typography variant="h6" sx={{ fontWeight: 700 }}>
                                    {user?.name}
                                </Typography>
                                <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                                    {ROLE_LABELS[user?.role] || user?.role}
                                </Typography>
                                <Typography variant="caption" color="text.disabled" display="block">
                                    {user?.email}
                                </Typography>

                                <Box sx={{ mt: 3, display: 'flex', gap: 1, flexWrap: 'wrap', justifyContent: 'center' }}>
                                    <Box
                                        sx={{
                                            px: 1.5,
                                            py: 0.5,
                                            borderRadius: 1,
                                            fontSize: 12,
                                            fontWeight: 700,
                                            bgcolor: 'success.light',
                                            color: 'success.contrastText',
                                            display: 'flex',
                                            alignItems: 'center',
                                        }}
                                    >
                                        Active
                                    </Box>
                                    {user?.isEmailVerified && (
                                        <Box
                                            sx={{
                                                px: 1.5,
                                                py: 0.5,
                                                borderRadius: 1,
                                                fontSize: 12,
                                                fontWeight: 700,
                                                bgcolor: 'info.light',
                                                color: 'info.contrastText',
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: 0.5,
                                            }}
                                        >
                                            <VerifiedIcon sx={{ fontSize: 14 }} />
                                            Gmail Verified
                                        </Box>
                                    )}
                                </Box>

                                <Box sx={{ mt: 2 }}>
                                    <Button
                                        variant="outlined"
                                        startIcon={<VerifiedUserIcon />}
                                        onClick={() => setVerificationDialogOpen(true)}
                                        disabled={user?.isEmailVerified}
                                        fullWidth
                                        sx={{ textTransform: 'none', fontWeight: 600 }}
                                    >
                                        {user?.isEmailVerified ? 'Gmail Already Verified' : 'Link Gmail Account'}
                                    </Button>
                                </Box>
                            </CardContent>
                        </Card>

                        {/* Theme Preferences Card */}
                        <Card>
                            <CardContent>
                                <Typography variant="subtitle1" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                    Display Settings
                                </Typography>
                                <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
                                    Personalise how the portal looks on your device.
                                </Typography>
                                
                                <Divider sx={{ my: 1.5 }} />

                                <FormControlLabel
                                    control={
                                        <Switch
                                            checked={theme.mode === 'dark'}
                                            onChange={toggleColorScheme}
                                            icon={<LightModeIcon sx={{ fontSize: 18 }} />}
                                            checkedIcon={<DarkModeIcon sx={{ fontSize: 18 }} />}
                                        />
                                    }
                                    label={
                                        <Typography variant="body2" sx={{ fontWeight: 600 }}>
                                            Dark Mode ({theme.mode === 'dark' ? 'Enabled' : 'Disabled'})
                                        </Typography>
                                    }
                                    sx={{ m: 0, justifyContent: 'space-between', display: 'flex', width: '100%' }}
                                />
                            </CardContent>
                        </Card>
                    </Stack>
                </Grid>

                {/* Right Side: Update Profile & Change Password Form fields */}
                <Grid item xs={12} md={8}>
                    <Stack spacing={3}>
                        {/* Profile Details Form Card */}
                        <Card>
                            <CardContent sx={{ p: 3 }}>
                                <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1, fontWeight: 700 }}>
                                    <PersonIcon color="primary" /> Personal Profile
                                </Typography>
                                <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
                                    Keep your profile details up-to-date.
                                </Typography>

                                {profileSuccess && (
                                    <Alert severity="success" sx={{ mb: 3 }}>
                                        {profileSuccess}
                                    </Alert>
                                )}
                                {profileError && (
                                    <Alert severity="error" sx={{ mb: 3 }}>
                                        {profileError}
                                    </Alert>
                                )}

                                <Box component="form" onSubmit={handleProfileSubmit}>
                                    <Grid container spacing={2}>
                                        <Grid item xs={12} sm={6}>
                                            <TextField
                                                fullWidth
                                                label="Full Name"
                                                variant="outlined"
                                                value={name}
                                                onChange={(e) => setName(e.target.value)}
                                            />
                                        </Grid>
                                        <Grid item xs={12} sm={6}>
                                            <TextField
                                                fullWidth
                                                label="Email Address"
                                                variant="outlined"
                                                value={user?.email || ''}
                                                disabled
                                                helperText="Contact your system administrator to change your email address."
                                            />
                                        </Grid>
                                    </Grid>

                                    <Box sx={{ mt: 3, display: 'flex', justifyContent: 'flex-end' }}>
                                        <Button
                                            type="submit"
                                            variant="contained"
                                            startIcon={<SaveIcon />}
                                            disabled={updatingProfile}
                                            sx={{ minWidth: 140 }}
                                        >
                                            {updatingProfile ? 'Saving...' : 'Save Profile'}
                                        </Button>
                                    </Box>
                                </Box>
                            </CardContent>
                        </Card>

                        {/* Change Password Card */}
                        <Card>
                            <CardContent sx={{ p: 3 }}>
                                <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1, fontWeight: 700 }}>
                                    <LockIcon color="primary" /> Security & Password
                                </Typography>
                                <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
                                    Change your password regularly to maintain security. New password must be at least 10 characters.
                                </Typography>

                                {passwordSuccess && (
                                    <Alert severity="success" sx={{ mb: 3 }}>
                                        {passwordSuccess}
                                    </Alert>
                                )}
                                {passwordError && (
                                    <Alert severity="error" sx={{ mb: 3 }}>
                                        {passwordError}
                                    </Alert>
                                )}

                                <Box component="form" onSubmit={handlePasswordSubmit}>
                                    <Stack spacing={2.5}>
                                        <TextField
                                            fullWidth
                                            type={showCurrentPassword ? 'text' : 'password'}
                                            label="Current Password"
                                            variant="outlined"
                                            value={currentPassword}
                                            onChange={(e) => setCurrentPassword(e.target.value)}
                                            InputProps={{
                                                endAdornment: (
                                                    <InputAdornment position="end">
                                                        <IconButton
                                                            onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                                                            edge="end"
                                                        >
                                                            {showCurrentPassword ? <VisibilityOffIcon /> : <VisibilityIcon />}
                                                        </IconButton>
                                                    </InputAdornment>
                                                ),
                                            }}
                                        />

                                        <TextField
                                            fullWidth
                                            type={showNewPassword ? 'text' : 'password'}
                                            label="New Password"
                                            variant="outlined"
                                            value={newPassword}
                                            onChange={(e) => setNewPassword(e.target.value)}
                                            helperText="Must be at least 10 characters."
                                            InputProps={{
                                                endAdornment: (
                                                    <InputAdornment position="end">
                                                        <IconButton
                                                            onClick={() => setShowNewPassword(!showNewPassword)}
                                                            edge="end"
                                                        >
                                                            {showNewPassword ? <VisibilityOffIcon /> : <VisibilityIcon />}
                                                        </IconButton>
                                                    </InputAdornment>
                                                ),
                                            }}
                                        />

                                        <TextField
                                            fullWidth
                                            type={showConfirmPassword ? 'text' : 'password'}
                                            label="Confirm New Password"
                                            variant="outlined"
                                            value={confirmPassword}
                                            onChange={(e) => setConfirmPassword(e.target.value)}
                                            InputProps={{
                                                endAdornment: (
                                                    <InputAdornment position="end">
                                                        <IconButton
                                                            onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                                                            edge="end"
                                                        >
                                                            {showConfirmPassword ? <VisibilityOffIcon /> : <VisibilityIcon />}
                                                        </IconButton>
                                                    </InputAdornment>
                                                ),
                                            }}
                                        />
                                    </Stack>

                                    <Box sx={{ mt: 3, display: 'flex', justifyContent: 'flex-end' }}>
                                        <Button
                                            type="submit"
                                            variant="contained"
                                            startIcon={<SaveIcon />}
                                            disabled={updatingPassword}
                                            sx={{ minWidth: 140 }}
                                        >
                                            {updatingPassword ? 'Updating...' : 'Update Password'}
                                        </Button>
                                    </Box>
                                </Box>
                            </CardContent>
                        </Card>
                    </Stack>
                </Grid>
            </Grid>

            {/* Gmail Verification Dialog */}
            <Dialog
                open={verificationDialogOpen}
                onClose={() => !verificationLoading && setVerificationDialogOpen(false)}
                maxWidth="xs"
                fullWidth
            >
                <DialogTitle sx={{ fontWeight: 700, display: 'flex', alignItems: 'center', gap: 1 }}>
                    <VerifiedUserIcon color="primary" />
                    Link Gmail Account
                </DialogTitle>
                <DialogContent>
                    {verificationError && (
                        <Alert severity="error" sx={{ mb: 2, borderRadius: 1 }}>
                            {verificationError}
                        </Alert>
                    )}
                    {verificationSuccess && (
                        <Alert severity="success" sx={{ mb: 2, borderRadius: 1 }}>
                            {verificationSuccess}
                        </Alert>
                    )}

                    {verificationStep === 1 ? (
                        <>
                            <Typography variant="body2" sx={{ mb: 2, color: 'text.secondary' }}>
                                Enter your Gmail address to receive a verification code. This will be used for passwordless sign-in.
                            </Typography>
                            <TextField
                                fullWidth
                                label="Gmail Address"
                                placeholder="your.name@gmail.com"
                                value={gmailAddress}
                                onChange={(e) => setGmailAddress(e.target.value)}
                                variant="outlined"
                                type="email"
                                required
                                disabled={verificationLoading}
                                sx={{ mb: 2 }}
                            />
                            <DialogActions sx={{ px: 0, pt: 1 }}>
                                <Button
                                    onClick={() => setVerificationDialogOpen(false)}
                                    disabled={verificationLoading}
                                    variant="text"
                                    sx={{ textTransform: 'none' }}
                                >
                                    Cancel
                                </Button>
                                <Button
                                    onClick={handleRequestVerificationCode}
                                    variant="contained"
                                    disabled={verificationLoading || !gmailAddress || !gmailAddress.endsWith('@gmail.com')}
                                    sx={{ textTransform: 'none', px: 3 }}
                                >
                                    {verificationLoading ? 'Sending...' : 'Send Code'}
                                </Button>
                            </DialogActions>
                        </>
                    ) : (
                        <>
                            <Typography variant="body2" sx={{ mb: 2, color: 'text.secondary' }}>
                                A 6-digit verification code has been sent to {gmailAddress}. Enter it below.
                            </Typography>
                            <TextField
                                fullWidth
                                label="6-Digit Verification Code"
                                placeholder="Enter code"
                                value={verificationCode}
                                onChange={(e) => setVerificationCode(e.target.value)}
                                variant="outlined"
                                required
                                disabled={verificationLoading}
                                helperText="Codes expire after 10 minutes."
                                sx={{ mb: 2 }}
                            />
                            <DialogActions sx={{ px: 0, pt: 1 }}>
                                <Button
                                    onClick={() => {
                                        setVerificationStep(1);
                                        setVerificationCode('');
                                        setVerificationError('');
                                        setVerificationSuccess('');
                                    }}
                                    disabled={verificationLoading}
                                    variant="text"
                                    sx={{ textTransform: 'none' }}
                                >
                                    Back
                                </Button>
                                <Button
                                    onClick={handleVerifyCode}
                                    variant="contained"
                                    disabled={verificationLoading || !verificationCode}
                                    sx={{ textTransform: 'none', px: 3 }}
                                >
                                    {verificationLoading ? 'Verifying...' : 'Verify'}
                                </Button>
                            </DialogActions>
                        </>
                    )}
                </DialogContent>
            </Dialog>
        </Box>
    );
}