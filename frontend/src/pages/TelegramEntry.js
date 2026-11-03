import { useEffect } from 'react';
import { Navigate, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { Box, CircularProgress } from '@mui/material';
import { useAuth } from '../auth/AuthContext';
import {
    dashboardPathForUser, loginPathForRole, safeNextPath,
} from '../auth/roleRouting';

export default function TelegramEntry() {
    const { role: targetRole } = useParams();
    const [searchParams] = useSearchParams();
    const navigate = useNavigate();
    const { user, loading, logout } = useAuth();

    const nextPath = safeNextPath(searchParams.get('next'));
    const loginPath = loginPathForRole(targetRole);
    const hasDifferentRole = Boolean(user && user.role !== targetRole);

    useEffect(() => {
        if (loading || !user || user.role === targetRole) return;

        // Telegram's linked role takes precedence over a different account left
        // in this browser. Clear that session before opening the right sign-in.
        logout();
        navigate(loginPath, {
            replace: true,
            state: {
                expectedRole: targetRole,
                ...(nextPath ? { from: { path: nextPath } } : {}),
            },
        });
    }, [
        loading, user, logout, navigate, loginPath, targetRole, nextPath,
    ]);

    if (loading || hasDifferentRole) {
        return (
            <Box sx={{ minHeight: '100vh', display: 'grid', placeItems: 'center' }}>
                <CircularProgress aria-label="Opening the correct sign-in" />
            </Box>
        );
    }

    if (!user) {
        return (
            <Navigate
                to={loginPath}
                state={{
                    expectedRole: targetRole,
                    ...(nextPath ? { from: { path: nextPath } } : {}),
                }}
                replace
            />
        );
    }

    return <Navigate to={nextPath || dashboardPathForUser(user)} replace />;
}
