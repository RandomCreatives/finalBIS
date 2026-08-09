import { useEffect, useRef, useState } from 'react';
import { Box, Typography } from '@mui/material';
import { fetchTelegramConfig } from '../auth/telegram';

/**
 * Renders the official Telegram Login Widget.
 *
 * The widget script injects an iframe button; when the user authorizes, it
 * calls the global `onTelegramAuth(user)` with the bot-signed identity, which
 * we forward to `onAuth`. The bot username comes from the backend
 * (/api/auth/telegram-config), with the build-time env var as fallback, so
 * the widget appears as soon as the server is configured — no rebuild needed.
 *
 * Used on the login page (sign-in) and in Settings (account linking).
 */
export default function TelegramLoginButton({ onAuth, size = 'large' }) {
    const containerRef = useRef(null);
    const onAuthRef = useRef(onAuth);
    const [config, setConfig] = useState(null); // null = loading

    useEffect(() => {
        onAuthRef.current = onAuth;
    }, [onAuth]);

    useEffect(() => {
        let cancelled = false;
        fetchTelegramConfig().then((cfg) => {
            if (!cancelled) setConfig(cfg);
        });
        return () => {
            cancelled = true;
        };
    }, []);

    useEffect(() => {
        if (!config?.enabled || !containerRef.current) return undefined;

        const container = containerRef.current;
        const script = document.createElement('script');
        script.async = true;
        script.src = 'https://telegram.org/js/telegram-widget.js?22';
        script.setAttribute('data-telegram-login', config.botUsername);
        script.setAttribute('data-size', size);
        script.setAttribute('data-onauth', 'onTelegramAuth(user)');
        script.setAttribute('data-request-access', 'write');

        window.onTelegramAuth = (user) => onAuthRef.current(user);

        container.appendChild(script);

        return () => {
            container.innerHTML = '';
            delete window.onTelegramAuth;
        };
    }, [config, size]);

    if (config === null) return null; // still fetching bot config

    if (!config.enabled) {
        return (
            <Typography variant="caption" color="text.disabled" sx={{ textAlign: 'center' }}>
                Telegram sign-in is not enabled for this school yet.
            </Typography>
        );
    }

    return <Box ref={containerRef} sx={{ display: 'flex', justifyContent: 'center' }} />;
}
