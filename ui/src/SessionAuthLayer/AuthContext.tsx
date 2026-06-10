import { createContext, useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import {
    apiCheckSession,
    apiLogout,
} from '../api/auth.js';
import { setCsrfToken } from '../api/csrf.js';
import { ApiError } from '../api/client.js';

interface AuthContextValue {
    loggedIn: boolean;
    loading: boolean;
    // The session check failed for a technical reason (server down, network) —
    // distinct from "not logged in". Drives a generic retry screen.
    checkFailed: boolean;
    recheckSession: () => void;
    logout: () => Promise<void>;
}

// Real value always comes from AuthProvider; this default only satisfies the type.
export const AuthContext = createContext<AuthContextValue>({
    loggedIn: false,
    loading: true,
    checkFailed: false,
    recheckSession: () => {},
    logout: async () => {},
});

export function AuthProvider({ children }: Readonly<{ children: ReactNode }>) {
    const [loggedIn, setLoggedIn] = useState(false);
    const [loading, setLoading] = useState(true);
    const [checkFailed, setCheckFailed] = useState(false);

    const [recheckSessionNonce, setRecheckSessionNonce] = useState(0); // Consumers bump this nonce via recheckSession; the effect below re-runs the check.
    const recheckSession = useCallback(() => setRecheckSessionNonce((nonce) => nonce + 1), []);

    useEffect(() => {
        async function checkSession() {
            setLoading(true);
            setCheckFailed(false);
            try {
                const sessionInfo = await apiCheckSession();
                setCsrfToken(sessionInfo.token ?? null);
                setLoggedIn(sessionInfo.loggedIn);
                setLoading(false);
            } catch (error) {
                console.error('Failed to check session:', error);
                setCsrfToken(null);
                setLoggedIn(false);
                setLoading(false);

                // 401/403 means genuinely not logged in (→ Login). Anything else is a technical failure we can't recover from silently (→ retry screen).
                const isAuthError = error instanceof ApiError && (error.status === 401 || error.status === 403);
                setCheckFailed(!isAuthError);
            }
        }
        void checkSession();
    }, [recheckSessionNonce]);

    const logout = useCallback(async () => {
        await apiLogout().catch(() => { /* ignore — clearing client state anyway */ });
        setCsrfToken(null);
        setLoggedIn(false);
        setLoading(false);
        setCheckFailed(false);
    }, []);

    const value = useMemo(() => ({
        loggedIn,
        loading,
        checkFailed,
        recheckSession,
        logout,
    }), [loggedIn, loading, checkFailed, recheckSession, logout]);

    return (
        <AuthContext.Provider value={value}>
            {children}
        </AuthContext.Provider>
    );
}
