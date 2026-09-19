import { useEffect, useRef, useState } from 'react';
import { Box, Typography } from '@mui/material';
import SendIcon from '@mui/icons-material/Send';
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
 * purpose='login' grays out into a placeholder while the bot function is
 * being finished (backend sets loginEnabled=false); 'link' stays active.
 */
export default function TelegramLoginButton({ onAuth, size = 'large', purpose = 'login' }) {
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

        // Use a unique callback name per mount to avoid clobbering a handler
        // that is active in another tab or a sibling component instance.
        const callbackName = `onTelegramAuth_${Math.random().toString(36).slice(2)}`;

        const script = document.createElement('script');
        script.async = true;
        script.src = 'https://telegram.org/js/telegram-widget.js?22';
        script.setAttribute('data-telegram-login', config.botUsername);
        script.setAttribute('data-size', size);
        script.setAttribute('data-onauth', `${callbackName}(user)`);
        script.setAttribute('data-request-access', 'write');

        window[callbackName] = (user) => onAuthRef.current(user);

        container.appendChild(script);

        return () => {
            container.innerHTML = '';
            delete window[callbackName];
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

    // Grayed-out state: the bot exists but widget sign-in is paused.
    if (purpose === 'login' && !config.loginEnabled) {
        return (
            <Box sx={{ textAlign: 'center' }}>
                <Box
                    sx={{
                        display: 'inline-flex', alignItems: 'center', gap: 1,
                        px: 2.5, py: 1.1, borderRadius: 999,
                        border: '1px solid', borderColor: 'divider',
                        color: 'text.disabled', fontWeight: 700, fontSize: 14,
                        opacity: 0.65, cursor: 'not-allowed', userSelect: 'none',
                    }}
                    aria-disabled="true"
                >
                    <SendIcon sx={{ fontSize: 17 }} />
                    Sign in with Telegram
                </Box>
                <Typography variant="caption" color="text.disabled"
                    sx={{ display: 'block', mt: 0.75, lineHeight: 1.5 }}>
                    Telegram sign-in is paused while we finish the bot — use your email and password.
                </Typography>
            </Box>
        );
    }

    return <Box ref={containerRef} sx={{ display: 'flex', justifyContent: 'center' }} />;
}
