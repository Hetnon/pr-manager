import { useContext } from 'react';
import { AuthContext } from './AuthContext.js';

// Shown when the session check fails for a technical reason (server down, network
// dropped) — a generic, retryable message rather than the raw error.
export default function SessionError() {
    const { recheckSession } = useContext(AuthContext);
    return (
        <div className="error">
            <p>Couldn't reach the server to check your session — it may be down, or your connection dropped.</p>
            <button onClick={recheckSession}>Try again</button>
        </div>
    );
}
