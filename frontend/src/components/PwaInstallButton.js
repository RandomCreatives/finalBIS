import { useState } from 'react';
import {
    Box, Button, Dialog, DialogActions, DialogContent, DialogTitle,
    Stack, Tooltip, Typography,
} from '@mui/material';
import GetAppIcon from '@mui/icons-material/GetApp';
import IosShareIcon from '@mui/icons-material/IosShare';
import AddBoxOutlinedIcon from '@mui/icons-material/AddBoxOutlined';
import { usePwaInstall } from '../utils/pwaInstall';

export function IosInstallDialog({ open, onClose }) {
    return (
        <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth>
            <DialogTitle sx={{ fontWeight: 800 }}>
                Install BIS NOC Gerji on iPhone / iPad
            </DialogTitle>
            <DialogContent dividers>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 2, lineHeight: 1.6 }}>
                    Add BIS NOC Gerji to your Home Screen for one-tap full-screen access and push notifications:
                </Typography>
                <Stack spacing={1.75}>
                    <Stack direction="row" spacing={1.5} alignItems="center">
                        <Box
                            sx={{
                                width: 32, height: 32, borderRadius: 1.5,
                                bgcolor: 'action.hover', color: 'primary.main',
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                flexShrink: 0,
                            }}
                        >
                            <IosShareIcon fontSize="small" />
                        </Box>
                        <Typography variant="body2">
                            <strong>1.</strong> Tap the <strong>Share</strong> icon in Safari’s toolbar.
                        </Typography>
                    </Stack>
                    <Stack direction="row" spacing={1.5} alignItems="center">
                        <Box
                            sx={{
                                width: 32, height: 32, borderRadius: 1.5,
                                bgcolor: 'action.hover', color: 'primary.main',
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                flexShrink: 0,
                            }}
                        >
                            <AddBoxOutlinedIcon fontSize="small" />
                        </Box>
                        <Typography variant="body2">
                            <strong>2.</strong> Choose <strong>Add to Home Screen</strong>, then tap <strong>Add</strong>.
                        </Typography>
                    </Stack>
                </Stack>
            </DialogContent>
            <DialogActions sx={{ px: 2.5, py: 1.5 }}>
                <Button onClick={onClose} variant="contained" size="small" sx={{ textTransform: 'none', fontWeight: 700 }}>
                    Got it
                </Button>
            </DialogActions>
        </Dialog>
    );
}

/**
 * Top-bar "Install app" button for all users across desktop & mobile.
 * Hidden automatically when already installed as a standalone PWA, inside
 * Telegram's internal WebView, or when the browser does not expose install UI.
 */
export default function PwaInstallButton({ visible = true }) {
    const { canNativeInstall, isIos, canShowInstallUi, triggerInstall } = usePwaInstall();
    const [iosDialogOpen, setIosDialogOpen] = useState(false);

    if (!visible || !canShowInstallUi) return null;

    const handleClick = async () => {
        if (canNativeInstall) {
            await triggerInstall();
        } else if (isIos) {
            setIosDialogOpen(true);
        }
    };

    return (
        <>
            <Tooltip title="Install BIS NOC Gerji on this device">
                <Button
                    size="small"
                    variant="outlined"
                    startIcon={<GetAppIcon sx={{ fontSize: 17 }} />}
                    onClick={handleClick}
                    data-testid="pwa-install-button"
                    sx={{
                        display: 'inline-flex',
                        borderRadius: 2,
                        textTransform: 'none',
                        fontWeight: 700,
                        px: { xs: 1.1, sm: 1.5 },
                        minWidth: 0,
                        whiteSpace: 'nowrap',
                    }}
                >
                    <Box component="span" sx={{ display: { xs: 'inline', sm: 'none' } }}>
                        Install
                    </Box>
                    <Box component="span" sx={{ display: { xs: 'none', sm: 'inline' } }}>
                        Install app
                    </Box>
                </Button>
            </Tooltip>
            <IosInstallDialog open={iosDialogOpen} onClose={() => setIosDialogOpen(false)} />
        </>
    );
}
