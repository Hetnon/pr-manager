import { useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import type { PR } from '@shared/pr.js';
import { AuthProvider, useAuth } from './auth/AuthContext.js';
import AuthGate from './auth/AuthGate.js';
import LogoutButton from './auth/LogoutButton.js';
import RepoSelector from './repo/RepoSelector.js';
import { useRepoSelection } from './repo/useRepoSelection.js';
import { listPrs } from './api/prs.js';
import { ApiError } from './api/client.js';
import PrMatrix from './prMatrix/PrMatrix.js';
import DevActions from './report/DevActions.js';
import MasterCheck from './masterCheck/MasterCheck.js';

function PrMatrixApp() {
    const { repo, setRepo, parsed } = useRepoSelection();
    const [pickerOpen, setPickerOpen] = useState(false);
    const [prs, setPrs] = useState<PR[] | null>(null);
    const [status, setStatus] = useState('');
    const [contentError, setContentError] = useState<string | null>(null);
    const initializedRef = useRef(false);
    const { refresh: refreshSession } = useAuth();

    useEffect(() => {
        initializedRef.current = true;
        if (!parsed) {
            setPickerOpen(true);
            return;
        }
        void loadPRs(parsed);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [repo]);

    async function loadPRs(p = parsed) {
        if (!p) return;
        setStatus('Loading…');
        setPrs(null);
        setContentError(null);

        try {
            const data = await listPrs(p.owner, p.name);
            setPrs(data);
            setStatus(`Loaded ${data.length} open PR(s) at ${new Date().toLocaleTimeString()}`);
        } catch (e) {
            // If the server says we lost the session, refresh auth state to redirect to login.
            if (e instanceof ApiError && (e.status === 401 || e.status === 403)) {
                await refreshSession();
                return;
            }
            setContentError(`Error: ${(e as Error).message}`);
            setStatus('');
        }
    }

    function handleSelectRepo(ownerRepo: string) {
        setRepo(ownerRepo);
        setPickerOpen(false);
    }

    return (
        <>
            <header>
                <div className="controls">
                    {repo && <span className="repo-display" title={repo}>{repo}</span>}
                    {repo && <button onClick={() => setPickerOpen(true)}>Change repo</button>}
                    {repo && <button onClick={() => void loadPRs()}>↻ Refresh</button>}
                    <span id="status">{status}</span>
                    <LogoutButton />
                </div>
            </header>
            <main>
                {contentError && <p className="error">{contentError}</p>}
                {!contentError && parsed && prs === null && <p className="loading">{initializedRef.current ? 'Loading PRs…' : 'Loading…'}</p>}
                {!contentError && parsed && Array.isArray(prs) && (
                    <>
                        <PrMatrix prs={prs} />
                        <DevActions prs={prs} />
                        <MasterCheck prs={prs} owner={parsed.owner} repo={parsed.name} onMerged={() => void loadPRs()} />
                    </>
                )}
            </main>
            {pickerOpen && (
                <RepoSelector
                    initialValue={repo ?? ''}
                    currentRepo={repo}
                    firstRun={!repo}
                    onSelect={handleSelectRepo}
                    onCancel={() => setPickerOpen(false)}
                />
            )}
        </>
    );
}

function App() {
    return (
        <AuthProvider>
            <AuthGate>
                <PrMatrixApp />
            </AuthGate>
        </AuthProvider>
    );
}

const root = document.getElementById('root');
if (!root) throw new Error('No #root element');
createRoot(root).render(<App />);
