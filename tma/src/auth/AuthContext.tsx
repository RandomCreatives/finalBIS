import { createContext, useContext, useState, useCallback } from 'react';
import type { ReactNode } from 'react';
import { api } from '../api/api';
import { getToken, logout } from '../auth/auth';

interface User {
    id: string;
    name: string;
    email: string;
    role: string;
    school_id: string;
}

interface AuthContextType {
    user: User | null;
    token: string | null;
    isLoading: boolean;
    login: (token: string, user: User) => void;
    logout: () => void;
    checkAuth: () => void;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function useAuth() {
    const ctx = useContext(AuthContext);
    if (!ctx) throw new Error('useAuth must be used within AuthProvider');
    return ctx;
}

export function AuthProvider({ children }: { children: ReactNode }) {
    const [user, setUser] = useState<User | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    const token = getToken();
    if (token) {
        api.get('/auth/me')
            .then((data) => setUser(data.user))
            .catch(() => logout())
            .finally(() => setIsLoading(false));
    } else {
        setIsLoading(false);
    }

    const doLogin = useCallback((token: string, user: User) => {
        localStorage.setItem('tma_token', token);
        setUser(user);
    }, []);

    const doLogout = useCallback(() => {
        logout();
        setUser(null);
    }, []);

    return (
        <AuthContext.Provider value={{ user, token, isLoading, login: doLogin, logout: doLogout, checkAuth: () => {} }}>
            {children}
        </AuthContext.Provider>
    );
}

