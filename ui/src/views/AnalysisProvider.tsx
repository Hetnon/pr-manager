import { useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import type { PR } from '@shared/pr.js';
import { AuthContext } from '../SessionAuthLayer/AuthContext.js';
import { listPrs } from '../api/prs.js';
import { ApiError } from '../api/client.js';
import { RepoContext } from '../repo/RepoContext.js';
import { useBranchAnalysis } from './branches/useBranchAnalysis/useBranchAnalysis.js';
import { usePrAnalysis } from './prs/usePrAnalysis/usePrAnalysis.js';
import { loadCachedPrs, saveCachedPrs, prSetKey } from './prs/prCache.js';
import { formatDateTime } from '../lib/formatDate.js';
import { AnalysisContext, type AnalysisContextValue } from './AnalysisContext.js';

export function AnalysisProvider({ children }: Readonly<{ children: ReactNode }>) {
    const { currentRepoSlug, currentRepoOwnerAndName } = useContext(RepoContext);
    const { recheckSession } = useContext(AuthContext);
    const [refreshRepoNonce, setRefreshRepoNonce] = useState(0);

    // Blocking status modal for user-initiated refresh/merge. `armed` guards the
    // completion watcher against firing on the render where the modal opens but the
    // async work hasn't flipped its flags to busy yet.
    const [refreshModalOpen, setRefreshModalOpen] = useState(false);
    const [refreshModalSettled, setRefreshModalSettled] = useState(false);
    const refreshArmedRef = useRef(false);

    const refreshRepo = useCallback(() => {
        refreshArmedRef.current = false;
        setRefreshModalOpen(true);
        setRefreshModalSettled(false);
        setRefreshRepoNonce((nonce) => nonce + 1);
    }, []);
    const closeRefreshModal = useCallback(() => setRefreshModalOpen(false), []);


    const [prs, setPrs] = useState<PR[] | null>(() =>
        currentRepoOwnerAndName ? loadCachedPrs(`${currentRepoOwnerAndName.owner}/${currentRepoOwnerAndName.name}`) : null,
    );
    const [prLoadStatus, setPrLoadStatus] = useState('');
    const [prsLoading, setPrsLoading] = useState(false);
    const [contentError, setContentError] = useState<string | null>(null);


    useEffect(() => {
        setPrs(currentRepoOwnerAndName ? loadCachedPrs(`${currentRepoOwnerAndName.owner}/${currentRepoOwnerAndName.name}`) : null);
    }, [currentRepoSlug]);

    const loadPrs = useCallback(async () => {
        if (!currentRepoOwnerAndName) return;
        const slug = `${currentRepoOwnerAndName.owner}/${currentRepoOwnerAndName.name}`;
        setPrsLoading(true);
        setPrLoadStatus('Loading…');
        setPrs(null);
        setContentError(null);
        try {
            const loaded = await listPrs(currentRepoOwnerAndName.owner, currentRepoOwnerAndName.name);
            saveCachedPrs(slug, loaded);
            // Same PRs → keep the old reference so the identity-keyed analysis doesn't re-run.
            setPrs((current) => (current && prSetKey(current) === prSetKey(loaded) ? current : loaded));
            setPrLoadStatus(`Loaded ${loaded.length} open PR(s) at ${formatDateTime(new Date().toISOString())}`);
        } catch (error) {
            // If the server says we lost the session, refresh auth state to redirect to login.
            if (error instanceof ApiError && (error.status === 401 || error.status === 403)) {
                recheckSession();
                return;
            }
            setContentError(`Error: ${(error as Error).message}`);
            setPrLoadStatus('');
        } finally {
            setPrsLoading(false);
        }
    }, [currentRepoOwnerAndName, recheckSession]);


    useEffect(() => {
        // Reload on repo change and on the App-level refresh signal.
        void loadPrs();
    }, [currentRepoSlug, refreshRepoNonce]);

    const branchesAnalysis = useBranchAnalysis(refreshRepoNonce);
    const prsAnalysis = usePrAnalysis(prs ?? []);

    // Drive the refresh modal's "settled" state: while it's open, once we've seen the
    // async work start (armed) and both the PR load and the branch read+fetch have
    // finished, enable the OK button. `refreshing` is gap-free, so this can't misfire
    // between the branch read and the origin fetch.
    const refreshBusy = prsLoading || branchesAnalysis.refreshing;
    useEffect(() => {
        if (!refreshModalOpen) return;
        if (refreshBusy) { refreshArmedRef.current = true; return; }
        if (refreshArmedRef.current) setRefreshModalSettled(true);
    }, [refreshModalOpen, refreshBusy]);

    const value = useMemo<AnalysisContextValue>(() => ({
        prs, prLoadStatus, prsLoading, contentError, loadPrs, refreshRepo,
        refreshModalOpen, refreshModalSettled, closeRefreshModal,
        branchesAnalysis, prsAnalysis
    }), [prs, prLoadStatus, prsLoading, contentError, loadPrs, refreshRepo,
        refreshModalOpen, refreshModalSettled, closeRefreshModal,
        branchesAnalysis, prsAnalysis]);
    return <AnalysisContext.Provider value={value}>{children}</AnalysisContext.Provider>;
}
