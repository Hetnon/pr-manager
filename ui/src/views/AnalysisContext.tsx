import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { PR } from '@shared/pr.js';
import { AuthContext } from '../SessionAuthLayer/AuthContext.js';
import { listPrs } from '../api/prs.js';
import { ApiError } from '../api/client.js';
import { RepoContext } from '../repo/RepoContext.js';
import { useBranchAnalysis } from './branches/hooks/useBranchAnalysis/useBranchAnalysis.js';
import { usePrAnalysis } from './prs/usePrAnalysis/usePrAnalysis.js';
import { loadCachedPrs, saveCachedPrs, prSetKey } from '../analysis/prCache.js';

interface AnalysisContextValue {
    prs: PR[] | null;          // all the PRs in the chosen repo - null while loading
    prLoadStatus: string;      // transient "Loading…" / "Loaded N at HH:MM"
    contentError: string | null;
    loadPrs: () => Promise<void>;   // refetch just the PRs (after a merge/close/push or refresh request)
    refreshRepo: () => void;     // full reread: reload PRs + rerun the branch/PR analysis
    branchesAnalysis: ReturnType<typeof useBranchAnalysis>;
    prsAnalysis: ReturnType<typeof usePrAnalysis>;
}

// Non-null: shape too large for a meaningful default; AnalysisProvider always supplies it.
export const AnalysisContext = createContext<AnalysisContextValue>(null as unknown as AnalysisContextValue);


export function AnalysisProvider({ children }: Readonly<{ children: ReactNode }>) {
    const { currentRepoSlug, currentRepoOwnerAndName } = useContext(RepoContext);
    const { recheckSession } = useContext(AuthContext);
    const [refreshRepoNonce, setRefreshRepoNonce] = useState(0);
    const refreshRepo = useCallback(() => setRefreshRepoNonce((nonce) => nonce + 1), []);


    const [prs, setPrs] = useState<PR[] | null>(() =>
        currentRepoOwnerAndName ? loadCachedPrs(`${currentRepoOwnerAndName.owner}/${currentRepoOwnerAndName.name}`) : null,
    );
    const [prLoadStatus, setPrLoadStatus] = useState('');
    const [contentError, setContentError] = useState<string | null>(null);


    useEffect(() => {
        setPrs(currentRepoOwnerAndName ? loadCachedPrs(`${currentRepoOwnerAndName.owner}/${currentRepoOwnerAndName.name}`) : null);
    }, [currentRepoSlug]);

    const loadPrs = useCallback(async () => {
        if (!currentRepoOwnerAndName) return;
        const slug = `${currentRepoOwnerAndName.owner}/${currentRepoOwnerAndName.name}`;
        setPrLoadStatus('Loading…');
        setPrs(null);
        setContentError(null);
        try {
            const loaded = await listPrs(currentRepoOwnerAndName.owner, currentRepoOwnerAndName.name);
            saveCachedPrs(slug, loaded);
            // Same PRs → keep the old reference so the identity-keyed analysis doesn't re-run.
            setPrs((current) => (current && prSetKey(current) === prSetKey(loaded) ? current : loaded));
            setPrLoadStatus(`Loaded ${loaded.length} open PR(s) at ${new Date().toLocaleTimeString()}`);
        } catch (error) {
            // If the server says we lost the session, refresh auth state to redirect to login.
            if (error instanceof ApiError && (error.status === 401 || error.status === 403)) {
                recheckSession();
                return;
            }
            setContentError(`Error: ${(error as Error).message}`);
            setPrLoadStatus('');
        }
    }, [currentRepoOwnerAndName, recheckSession]);


    useEffect(() => {
        // Reload on repo change and on the App-level refresh signal.
        void loadPrs();
    }, [currentRepoSlug, refreshRepoNonce]);

    const branchesAnalysis = useBranchAnalysis(refreshRepoNonce);
    const prsAnalysis = usePrAnalysis(prs ?? []);

    const value = useMemo<AnalysisContextValue>(() => ({
        prs, prLoadStatus, contentError, loadPrs, refreshRepo, branchesAnalysis, prsAnalysis
    }), [prs, prLoadStatus, contentError, loadPrs, refreshRepo, branchesAnalysis, prsAnalysis]);
    return <AnalysisContext.Provider value={value}>{children}</AnalysisContext.Provider>;
}
