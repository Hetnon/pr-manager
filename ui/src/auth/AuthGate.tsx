import { useContext, type ReactNode } from 'react';
import { AuthContext } from './AuthContext.js';
import Login from './Login.js';
import SessionLoading from './SessionLoading.js';
import SessionError from './SessionError.js';

// Routes between the session states: checking → error (retryable) → login → app.
export default function AuthGate({ children }: Readonly<{ children: ReactNode }>) {
    const { loggedIn, loading, checkFailed, refreshSession } = useContext(AuthContext);
    if (loading) return <SessionLoading />;
    if (checkFailed) return <SessionError onRetry={() => void refreshSession()} />;
    if (!loggedIn) return <Login />;
    return <>{children}</>;
}
