import { useCallback, useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import type { PR } from '@shared/pr.js';
import { AuthProvider, useAuth } from './auth/AuthContext.js';
import AuthGate from './auth/AuthGate.js';
import RepoSelector from './repo/RepoSelector.js';
import { useRepoSelection } from './repo/useRepoSelection.js';
import { listPrs } from './api/prs.js';
import { ApiError } from './api/client.js';
import AppHeader, { type View } from './Header/AppHeader.js';
import AppMain from './views/AppMain.js';

function App() {
    const { 
        repo, setRepoCallBack, // currently chosen repo
        parsed, // 
        folderHandle 
    } = useRepoSelection();
    const [pickerOpen, setPickerOpen] = useState(false);
    const [view, setView] = useState<View>('branches');
    const [prs, setPrs] = useState<PR[] | null>(null);
    const [status, setStatus] = useState('');
    const [contentError, setContentError] = useState<string | null>(null);
    const initializedRef = useRef(false);
    const { refresh: refreshSession } = useAuth();
    // Bumped on Refresh / on permission upgrade — LocalBranchesPanel watches
    // this to know when to reread local state + try a fetch.
    const [refreshNonce, setRefreshNonce] = useState(0);

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

    function handleSelectRepo(ownerRepo: string, handle: FileSystemDirectoryHandle) {
        setRepoCallBack(ownerRepo, handle);
        setPickerOpen(false);
    }

    const triggerRefresh = useCallback(() => {
        setRefreshNonce((n) => n + 1);
        if (parsed) void loadPRs(parsed);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [parsed]);

    return (
        <>
            <AppHeader
                repo={repo}
                folderHandle={folderHandle}
                view={view}
                status={status}
                onSelectView={setView}
                onOpenPicker={() => setPickerOpen(true)}
                onRefresh={triggerRefresh}
            />
            <AppMain
                view={view}
                prs={prs}
                parsed={parsed}
                folderHandle={folderHandle}
                contentError={contentError}
                initialized={initializedRef.current}
                refreshNonce={refreshNonce}
                onPushed={triggerRefresh}
                onMerged={() => void loadPRs()}
            />
            {pickerOpen && (
                <RepoSelector
                    currentRepo={repo}
                    firstRun={!repo}
                    onSelect={handleSelectRepo}
                    onCancel={() => setPickerOpen(false)}
                />
            )}
        </>
    );
}

function Root() {
    return (
        <AuthProvider>
            <AuthGate>
                <App />
            </AuthGate>
        </AuthProvider>
    );
}

const root = document.getElementById('root');
if (!root) throw new Error('No #root element');
createRoot(root).render(<Root />);
