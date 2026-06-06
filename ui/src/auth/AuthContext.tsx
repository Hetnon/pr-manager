import { createContext, useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import {
    checkSession as apiCheckSession,
    initiateGithubLogin,
    logout as apiLogout,
} from '../api/auth.js';
import { setCsrfToken } from '../api/csrf.js';
import { ApiError } from '../api/client.js';

interface AuthState {
    loggedIn: boolean;
    loading: boolean;
    // The session check failed for a technical reason (server down, network) —
    // distinct from "not logged in". Drives a generic retry screen.
    checkFailed: boolean;
}

interface AuthContextValue extends AuthState {
    refreshSession: () => Promise<void>;
    login: () => Promise<void>;
    logout: () => Promise<void>;
}

// Default is the "logged out, still loading" state with no-op actions. The
// AuthProvider always supplies the real value, so this only satisfies the type —
// callers read useContext(AuthContext) directly, no null guard.
export const AuthContext = createContext<AuthContextValue>({
    loggedIn: false,
    loading: true,
    checkFailed: false,
    refreshSession: async () => {},
    login: async () => {},
    logout: async () => {},
});

export function AuthProvider({ children }: Readonly<{ children: ReactNode }>) {
    const [session, setSession] = useState<AuthState>({ loggedIn: false, loading: true, checkFailed: false });

    const refreshSession = useCallback(async () => {
        setSession((prev) => ({ ...prev, loading: true, checkFailed: false }));
        try {
            const sessionInfo = await apiCheckSession();
            setCsrfToken(sessionInfo.token ?? null);
            setSession({ loggedIn: sessionInfo.loggedIn, loading: false, checkFailed: false });
        } catch (error) {
            console.error('Failed to check session:', error);
            setCsrfToken(null);
            // 401/403 means genuinely not logged in (→ Login). Anything else is a
            // technical failure we can't recover from silently (→ retry screen).
            const isAuthError = error instanceof ApiError && (error.status === 401 || error.status === 403);
            setSession({ loggedIn: false, loading: false, checkFailed: !isAuthError });
        }
    }, []);

    useEffect(() => {
        void refreshSession();
    }, [refreshSession]);

    const login = useCallback(async () => {
        const url = await initiateGithubLogin();
        globalThis.location.assign(url);
    }, []);

    const logout = useCallback(async () => {
        await apiLogout().catch(() => { /* ignore — clearing client state anyway */ });
        setCsrfToken(null);
        setSession({ loggedIn: false, loading: false, checkFailed: false });
    }, []);

    const value = useMemo(() => ({
        ...session,
        refreshSession,
        login,
        logout,
    }), [session, refreshSession, login, logout]);

    return (
        <AuthContext.Provider value={value}>
            {children}
        </AuthContext.Provider>
    );
}