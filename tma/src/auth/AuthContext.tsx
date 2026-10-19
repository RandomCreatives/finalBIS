import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { api } from '../api/api';
import { clearToken, getToken, setToken as persistToken } from './auth';
import type { StaffUser } from './auth';

interface AuthContextType {
    user: StaffUser | null;
    token: string | null;
    isLoading: boolean;
    login: (token: string, user: StaffUser) => void;
    logout: () => void;
    checkAuth: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function useAuth() {
    const ctx = useContext(AuthContext);
    if (!ctx) throw new Error('useAuth must be used within AuthProvider');
    return ctx;
}

export function AuthProvider({ children }: { children: ReactNode }) {
    const [user, setUser] = useState<StaffUser | null>(null);
    const [token, setToken] = useState<string | null>(() => getToken());
    const [isLoading, setIsLoading] = useState(true);
    const active = useRef(true);

    // Validate a stored session once, on mount. This must be an effect: the
    // previous version fired the request during render, which React strict
    // mode runs twice and which loops on every state update.
    useEffect(() => {
        active.current = true;
        const stored = getToken();

        if (!stored) {
            setIsLoading(false);
            return () => {
                active.current = false;
            };
        }

        api.get('/auth/me')
            .then((data) => {
                if (!active.current) return;
                setUser(data.user as StaffUser);
                setToken(stored);
            })
            .catch(() => {
                if (!active.current) return;
                clearToken();
                setUser(null);
                setToken(null);
            })
            .finally(() => {
                if (active.current) setIsLoading(false);
            });

        return () => {
            active.current = false;
        };
    }, []);

    const login = useCallback((newToken: string, newUser: StaffUser) => {
        persistToken(newToken);
        setToken(newToken);
        setUser(newUser);
    }, []);

    const logout = useCallback(() => {
        clearToken();
        setToken(null);
        setUser(null);
    }, []);

    const checkAuth = useCallback(async () => {
        const stored = getToken();
        if (!stored) {
            setUser(null);
            setToken(null);
            return;
        }
        try {
            const data = await api.get('/auth/me');
            setUser(data.user as StaffUser);
            setToken(stored);
        } catch {
            clearToken();
            setUser(null);
            setToken(null);
        }
    }, []);

    return (
        <AuthContext.Provider value={{ user, token, isLoading, login, logout, checkAuth }}>
            {children}
        </AuthContext.Provider>
    );
}
