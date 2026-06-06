import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { PR } from '@shared/pr.js';
import { AuthContext } from '../auth/AuthContext.js';
import { listPrs } from '../api/prs.js';
import { ApiError } from '../api/client.js';
import { RepoContext } from '../repo/RepoContext.js';
import { useBranchAnalysis } from '../views/branches/hooks/useBranchAnalysis.js';
import { usePrAnalysis } from '../views/prs/usePrAnalysis.js';

interface AnalysisContextValue {
    prs: PR[] | null;          // null while loading
    prLoadStatus: string;      // transient "Loading…" / "Loaded N at HH:MM"
    contentError: string | null;
    reloadPrs: () => void;     // refetch just the PRs (after a merge/close/push)
    branch: ReturnType<typeof useBranchAnalysis>;
    pr: ReturnType<typeof usePrAnalysis>;
}

// Typed non-null (the shape is too large for a meaningful default) so callers
// read useContext(AnalysisContext) directly. AnalysisProvider always supplies the
// value; a missing provider surfaces as a natural dev-time error.
export const AnalysisContext = createContext<AnalysisContextValue>(null as unknown as AnalysisContextValue);

// The repo's data layer. Fetches the open PRs and runs the branch + PR analyses,
// all above the view toggle — so checks happen regardless of which tab is open
// (and in parallel), and tab switches don't re-run anything. Reports each check's
// progress into the shared top-level modal. The views consume the results here.
export function AnalysisProvider({ refreshNonce, children }: Readonly<{ refreshNonce: number; children: ReactNode }>) {
    const { repo: repoSlug, repoOwnerAndName, folderHandle } = useContext(RepoContext);
    const owner = repoOwnerAndName?.owner ?? null;
    const repoName = repoOwnerAndName?.name ?? null;
    const { refreshSession } = useContext(AuthContext);

    const [prs, setPrs] = useState<PR[] | null>(null);
    const [prLoadStatus, setPrLoadStatus] = useState('');
    const [contentError, setContentError] = useState<string | null>(null);

    const loadPrs = useCallback(async () => {
        if (!repoOwnerAndName) return;
        setPrLoadStatus('Loading…');
        setPrs(null);
        setContentError(null);
        try {
            const loaded = await listPrs(repoOwnerAndName.owner, repoOwnerAndName.name);
            setPrs(loaded);
            setPrLoadStatus(`Loaded ${loaded.length} open PR(s) at ${new Date().toLocaleTimeString()}`);
        } catch (error) {
            // If the server says we lost the session, refresh auth state to redirect to login.
            if (error instanceof ApiError && (error.status === 401 || error.status === 403)) {
                await refreshSession();
                return;
            }
            setContentError(`Error: ${(error as Error).message}`);
            setPrLoadStatus('');
        }
    }, [repoOwnerAndName, refreshSession]);

    // Reload on repo change and on the App-level refresh signal.
    useEffect(() => {
        void loadPrs();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [repoSlug, refreshNonce]);

    const reloadPrs = useCallback(() => { void loadPrs(); }, [loadPrs]);

    const branch = useBranchAnalysis(folderHandle, owner, repoName, refreshNonce);
    const pr = usePrAnalysis(prs ?? [], owner ?? '', repoName ?? '', folderHandle);

    const value = useMemo<AnalysisContextValue>(
        () => ({ prs, prLoadStatus, contentError, reloadPrs, branch, pr }),
        [prs, prLoadStatus, contentError, reloadPrs, branch, pr],
    );
    return <AnalysisContext.Provider value={value}>{children}</AnalysisContext.Provider>;
}
