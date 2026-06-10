import { useState } from 'react';
import { initiateGithubLogin } from '../api/auth.js';

export default function GitHubLogin() {
    const [error, setError] = useState<string | null>(null);
    const [pending, setPending] = useState(false);

    async function handleLogin() {
        setError(null);
        setPending(true);
        try {
            const url = await initiateGithubLogin();
            globalThis.location.assign(url);
        } catch (error) {
            setError((error as Error).message);
            setPending(false);
        }
    }

    return (
        <div className="login-screen">
            <h1>PR Matrix</h1>
            <p>Sign in with GitHub to view and merge open PRs across your repositories.</p>
            <button className="primary" onClick={handleLogin} disabled={pending}>
                {pending ? 'Redirecting…' : 'Sign in with GitHub'}
            </button>
            {error && <p className="error">{error}</p>}
        </div>
    );
}
