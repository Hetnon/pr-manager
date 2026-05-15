import type { ReactNode } from 'react';
import { useAuth } from './AuthContext.js';
import Login from './Login.js';

export default function AuthGate({ children }: { children: ReactNode }) {
    const { loggedIn, loading } = useAuth();
    if (loading) return <p className="loading">Checking session…</p>;
    if (!loggedIn) return <Login />;
    return <>{children}</>;
}
