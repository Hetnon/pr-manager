import { createContext } from 'react';

export interface AuthContextValue {
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
