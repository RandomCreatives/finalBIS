import { createContext, useContext, useEffect, useMemo, useState, useCallback } from 'react';
import { authApi } from '../api/endpoints';
import { getToken, setToken, clearToken } from '../api/client';

const AuthContext = createContext(null);

/**
 * Holds the signed-in user.
 *
 * The session is validated against /auth/me on load rather than trusted from
 * localStorage. localStorage tells us which token to try; only the server
 * decides whether it is valid and what role it carries.
 */
export function AuthProvider({ children }) {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        let cancelled = false;

        const restore = async () => {
            if (!getToken()) {
                setLoading(false);
                return;
            }
            try {
                const me = await authApi.me();
                if (!cancelled) setUser(me);
            } catch {
                clearToken();
            } finally {
                if (!cancelled) setLoading(false);
            }
        };

        restore();
        return () => { cancelled = true; };
    }, []);

    const login = useCallback(async (email, password) => {
        const { token, user: profile } = await authApi.login(email, password);
        setToken(token);
        setUser(profile);
        return profile;
    }, []);

    const gmailLogin = useCallback(async (email, code) => {
        const { token, user: profile } = await authApi.gmailVerify(email, code);
        setToken(token);
        setUser(profile);
        return profile;
    }, []);

    const logout = useCallback(() => {
        clearToken();
        setUser(null);
    }, []);

    const updateUser = useCallback((updatedProfile) => {
        setUser(updatedProfile);
    }, []);

    const value = useMemo(
        () => ({
            user,
            loading,
            login,
            logout,
            updateUser,
            gmailLogin,
            isAdmin: user?.role === 'admin',
            isAuthenticated: Boolean(user),
        }),
        [user, loading, login, logout, updateUser, gmailLogin]
    );

    return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
    const ctx = useContext(AuthContext);
    if (!ctx) throw new Error('useAuth must be used inside an AuthProvider');
    return ctx;
}
