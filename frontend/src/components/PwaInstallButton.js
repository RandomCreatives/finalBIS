import { useEffect, useState } from 'react';
import DownloadIcon from '@mui/icons-material/Download';
import { Button } from '@mui/material';

export default function PwaInstallButton({ visible = false }) {
    const [installEvent, setInstallEvent] = useState(null);
    const [installed, setInstalled] = useState(false);

    useEffect(() => {
        const standalone = window.matchMedia?.('(display-mode: standalone)').matches
            || window.navigator.standalone === true;
        setInstalled(standalone);

        const handleInstallPrompt = (event) => {
            event.preventDefault();
            setInstallEvent(event);
        };
        const handleInstalled = () => {
            setInstalled(true);
            setInstallEvent(null);
        };

        window.addEventListener('beforeinstallprompt', handleInstallPrompt);
        window.addEventListener('appinstalled', handleInstalled);
        return () => {
            window.removeEventListener('beforeinstallprompt', handleInstallPrompt);
            window.removeEventListener('appinstalled', handleInstalled);
        };
    }, []);

    if (!visible || installed || !installEvent) return null;

    const install = async () => {
        await installEvent.prompt();
        await installEvent.userChoice;
        setInstallEvent(null);
    };

    return (
        <Button
            onClick={install}
            size="small"
            startIcon={<DownloadIcon sx={{ fontSize: 16 }} />}
            aria-label="Install BIS Gerji app"
            sx={{
                textTransform: 'none', fontWeight: 700, color: 'primary.main',
                border: '1px solid', borderColor: 'primary.main', borderRadius: 1, px: 1.25,
                display: { xs: 'none', sm: 'inline-flex' },
            }}
        >
            Install app
        </Button>
    );
}
