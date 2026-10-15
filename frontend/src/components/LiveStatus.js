import { Box, CircularProgress, IconButton, Stack, Tooltip, Typography } from '@mui/material';
import RefreshIcon from '@mui/icons-material/Refresh';
import { formatTime } from '../utils/schoolTime';
import { LIVE_REFRESH_MS } from '../hooks/useLiveApi';

/**
 * "● Live · Updated 08:52:10 EAT  ⟳" — tells the reader the numbers keep
 * themselves fresh, when they last did (school time), and lets them refresh
 * now. Pass the fields from useLiveApi.
 */
export default function LiveStatus({
    updatedAt, refreshing = false, stale = false, onRefresh, live = true, intervalMs = LIVE_REFRESH_MS,
}) {
    const time = updatedAt
        ? formatTime(updatedAt, { hour: '2-digit', minute: '2-digit', second: '2-digit' })
        : null;

    let text = 'Loading…';
    if (time) {
        if (stale) text = `Couldn't refresh — showing ${time} EAT`;
        else text = `${live ? 'Live · ' : ''}Updated ${time} EAT`;
    }

    const seconds = Math.round(intervalMs / 1000);
    const hint = live
        ? `Updates by itself every ${seconds} seconds while this page is open. Click to update now.`
        : 'Update now';

    return (
        <Stack direction="row" spacing={0.75} alignItems="center" data-testid="live-status">
            {live && (
                <Box
                    aria-hidden
                    sx={{
                        width: 8, height: 8, borderRadius: '50%', flexShrink: 0,
                        bgcolor: stale ? 'warning.main' : 'success.main',
                        '@keyframes livePulse': { '0%, 100%': { opacity: 1 }, '50%': { opacity: 0.35 } },
                        animation: stale ? 'none' : 'livePulse 2s ease-in-out infinite',
                    }}
                />
            )}
            <Typography variant="caption" role="status" aria-live="polite"
                sx={{ fontWeight: 600, color: stale ? 'warning.dark' : 'text.secondary', whiteSpace: 'nowrap' }}>
                {text}
            </Typography>
            {onRefresh && (
                <Tooltip title={hint}>
                    <span>
                        <IconButton size="small" onClick={() => onRefresh()} disabled={refreshing} aria-label="Update now">
                            {refreshing ? <CircularProgress size={14} /> : <RefreshIcon fontSize="small" />}
                        </IconButton>
                    </span>
                </Tooltip>
            )}
        </Stack>
    );
}
