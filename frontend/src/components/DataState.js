import { Alert, Box, CircularProgress, Typography } from '@mui/material';

/**
 * Consistent loading / error / empty handling.
 *
 * The old pages swallowed failures in `catch { console.error }` and rendered
 * an empty table, so a 401 looked identical to "no data". Errors are now
 * always visible to the user.
 */
export default function DataState({ loading, error, empty, emptyMessage = 'Nothing to show yet.', children }) {
    if (loading) {
        return (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
                <CircularProgress />
            </Box>
        );
    }

    if (error) {
        return <Alert severity="error" sx={{ my: 2 }}>{error}</Alert>;
    }

    if (empty) {
        return (
            <Box sx={{ textAlign: 'center', py: 6 }}>
                <Typography color="text.secondary">{emptyMessage}</Typography>
            </Box>
        );
    }

    return children;
}
