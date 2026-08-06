import { Navigate, useLocation } from 'react-router-dom';
import { Box, CircularProgress } from '@mui/material';
import { useAuth } from './AuthContext';

/**
 * Route guard.
 *
 * This is a usability layer, not the security boundary — the API authorises
 * every request independently. It stops a signed-out user from seeing an
 * empty shell, and hides admin screens from teachers.
 */
export default function RequireAuth({ children, roles }) {
    const { user, loading } = useAuth();
    const location = useLocation();

    if (loading) {
        return (
            <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh' }}>
                <CircularProgress />
            </Box>
        );
    }

    if (!user) {
        return <Navigate to="/login" state={{ from: location }} replace />;
    }

    if (roles && !roles.includes(user.role)) {
        return <Navigate to="/app" replace />;
    }

    return children;
}
