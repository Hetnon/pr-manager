import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import {
    checkSession as apiCheckSession,
    initiateGithubLogin,
    logout as apiLogout,
} from '../api/auth.js';
import { setCsrfToken } from '../api/csrf.js';

interface AuthState {
    loggedIn: boolean;
    loading: boolean;
}

interface AuthContextValue extends AuthState {
    refresh: () => Promise<void>;
    login: () => Promise<void>;
    logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
    const [state, setState] = useState<AuthState>({ loggedIn: false, loading: true });

    const refresh = useCallback(async () => {
        setState((s) => ({ ...s, loading: true }));
        try {
            const session = await apiCheckSession();
            setCsrfToken(session.token ?? null);
            setState({ loggedIn: session.loggedIn, loading: false });
        } catch {
            setCsrfToken(null);
            setState({ loggedIn: false, loading: false });
        }
    }, []);

    useEffect(() => { void refresh(); }, [refresh]);

    const login = useCallback(async () => {
        const url = await initiateGithubLogin();
        window.location.assign(url);
    }, []);

    const logout = useCallback(async () => {
        await apiLogout().catch(() => { /* ignore — clearing client state anyway */ });
        setCsrfToken(null);
        setState({ loggedIn: false, loading: false });
    }, []);

    return (
        <AuthContext.Provider value={{ ...state, refresh, login, logout }}>
            {children}
        </AuthContext.Provider>
    );
}

export function useAuth(): AuthContextValue {
    const ctx = useContext(AuthContext);
    if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
    return ctx;
}
