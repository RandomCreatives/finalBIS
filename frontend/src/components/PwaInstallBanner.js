import { useState } from 'react';
import {
    Box, Button, IconButton, Paper, Stack, Typography,
} from '@mui/material';
import { alpha, useTheme } from '@mui/material/styles';
import CloseIcon from '@mui/icons-material/Close';
import GetAppIcon from '@mui/icons-material/GetApp';
import IosShareIcon from '@mui/icons-material/IosShare';
import { usePwaInstall } from '../utils/pwaInstall';
import { IosInstallDialog } from './PwaInstallButton';

/**
 * Polite, smart, dismissible PWA install notification banner (Option A).
 * - Shows automatically on Android/Desktop when `beforeinstallprompt` fires
 *   and on iPhone/iPad Safari when not yet added to Home Screen.
 * - Suppressed automatically when already running as a standalone PWA, inside
 *   Telegram's internal WebView, or while snoozed ("Not now" → 14 days).
 * - Even after snoozing, users can install anytime from Settings or the top bar.
 */
export default function PwaInstallBanner() {
    const theme = useTheme();
    const dark = theme.palette.mode === 'dark';
    const {
        canNativeInstall,
        isIos,
        shouldShowBanner,
        triggerInstall,
        snoozeBanner,
    } = usePwaInstall();
    const [iosDialogOpen, setIosDialogOpen] = useState(false);

    if (!shouldShowBanner) return null;

    const handleInstall = async () => {
        const outcome = await triggerInstall();
        if (outcome === 'dismissed') {
            snoozeBanner();
        }
    };

    return (
        <>
            <Paper
                elevation={8}
                role="region"
                aria-label="Install app notification"
                data-testid="pwa-install-banner"
                sx={{
                    position: 'fixed',
                    bottom: { xs: 14, sm: 20 },
                    right: { xs: 12, sm: 24 },
                    left: { xs: 12, sm: 'auto' },
                    width: { xs: 'auto', sm: 410 },
                    maxWidth: 'calc(100vw - 24px)',
                    zIndex: 1250,
                    p: 2,
                    borderRadius: 3,
                    border: `1px solid ${dark ? alpha('#94a3b8', 0.24) : alpha('#0f172a', 0.1)}`,
                    bgcolor: dark
                        ? alpha(theme.palette.background.paper, 0.94)
                        : alpha('#ffffff', 0.96),
                    backdropFilter: 'blur(14px)',
                    boxShadow: dark
                        ? '0 16px 40px rgba(0, 0, 0, 0.55)'
                        : '0 16px 40px rgba(15, 23, 42, 0.16)',
                }}
            >
                <Stack direction="row" spacing={1.5} alignItems="flex-start">
                    <Box
                        component="img"
                        src="/favicon.svg"
                        alt="BIS NOC Gerji"
                        sx={{
                            width: 40,
                            height: 40,
                            borderRadius: 2,
                            flexShrink: 0,
                            mt: 0.25,
                        }}
                    />
                    <Box sx={{ flex: 1, minWidth: 0 }}>
                        <Stack direction="row" justifyContent="space-between" alignItems="flex-start" spacing={1}>
                            <Typography variant="subtitle2" sx={{ fontWeight: 800, lineHeight: 1.3 }}>
                                {isIos && !canNativeInstall
                                    ? 'Add BIS NOC Gerji to Home Screen'
                                    : 'Install BIS NOC Gerji App'}
                            </Typography>
                            <IconButton
                                size="small"
                                aria-label="Dismiss install banner"
                                onClick={() => snoozeBanner()}
                                sx={{ mt: -0.5, mr: -0.75, color: 'text.secondary' }}
                            >
                                <CloseIcon fontSize="small" />
                            </IconButton>
                        </Stack>

                        {isIos && !canNativeInstall ? (
                            <Typography
                                variant="caption"
                                color="text.secondary"
                                sx={{ display: 'block', mt: 0.5, lineHeight: 1.55 }}
                            >
                                Tap <strong>Share</strong> (<IosShareIcon sx={{ fontSize: 13, verticalAlign: 'text-bottom' }} />) in Safari, then choose{' '}
                                <strong>Add to Home Screen</strong> for instant access &amp; push alerts.
                            </Typography>
                        ) : (
                            <Typography
                                variant="caption"
                                color="text.secondary"
                                sx={{ display: 'block', mt: 0.5, lineHeight: 1.55 }}
                            >
                                Add the app to your device for one-tap access to attendance, timetables, marksheets &amp; alerts.
                            </Typography>
                        )}

                        <Stack direction="row" spacing={1} sx={{ mt: 1.5 }} alignItems="center">
                            {canNativeInstall ? (
                                <Button
                                    size="small"
                                    variant="contained"
                                    startIcon={<GetAppIcon sx={{ fontSize: 16 }} />}
                                    onClick={handleInstall}
                                    data-testid="pwa-banner-install"
                                    sx={{ textTransform: 'none', fontWeight: 700, borderRadius: 1.75, px: 1.75 }}
                                >
                                    Install
                                </Button>
                            ) : (
                                <Button
                                    size="small"
                                    variant="outlined"
                                    startIcon={<IosShareIcon sx={{ fontSize: 15 }} />}
                                    onClick={() => setIosDialogOpen(true)}
                                    data-testid="pwa-banner-ios-guide"
                                    sx={{ textTransform: 'none', fontWeight: 700, borderRadius: 1.75, px: 1.5 }}
                                >
                                    How to install
                                </Button>
                            )}
                            <Button
                                size="small"
                                variant="text"
                                color="inherit"
                                onClick={() => snoozeBanner()}
                                data-testid="pwa-banner-snooze"
                                sx={{ textTransform: 'none', fontWeight: 600, color: 'text.secondary' }}
                            >
                                Not now
                            </Button>
                        </Stack>
                    </Box>
                </Stack>
            </Paper>
            <IosInstallDialog open={iosDialogOpen} onClose={() => setIosDialogOpen(false)} />
        </>
    );
}
