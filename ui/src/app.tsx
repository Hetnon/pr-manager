import { useCallback, useContext, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { AuthProvider } from './auth/AuthContext.js';
import AuthGate from './auth/AuthGate.js';
import RepoSelector from './repo/RepoSelector.js';
import { RepoProvider, RepoContext } from './repo/RepoContext.js';
import AppHeader, { type View } from './Header/AppHeader.js';
import AppMain from './views/AppMain.js';

function App() {
    const { pickerOpen } = useContext(RepoContext);
    const [view, setView] = useState<View>('branches');
    // Bumped on Refresh / on permission upgrade — both views watch this to
    // reread local state and reload PRs.
    const [refreshNonce, setRefreshNonce] = useState(0);

    const triggerRefresh = useCallback(() => {
        setRefreshNonce((nonce) => nonce + 1);
    }, []);

    return (
        <>
            <AppHeader
                view={view}
                onSelectView={setView}
                onRefresh={triggerRefresh}
            />
            <AppMain
                view={view}
                refreshNonce={refreshNonce}
            />
            {pickerOpen && <RepoSelector />}
        </>
    );
}

function Root() {
    return (
        <AuthProvider>
            <AuthGate>
                <RepoProvider>
                    <App />
                </RepoProvider>
            </AuthGate>
        </AuthProvider>
    );
}

const root = document.getElementById('root');
if (!root) throw new Error('No #root element');
createRoot(root).render(<Root />);
