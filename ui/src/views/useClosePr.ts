import { useCallback, useContext, useState } from 'react';
import { RepoContext } from '../repo/RepoContext.js';
import * as prApi from '../api/prs.js';

// Close a PR without merging (GitHub has no delete-PR; closing is the reopenable
// equivalent). Shared by the PR view and the branches view. `onClosed` fires on
// success so the caller can refetch the PR list. `confirmDetail` is an optional
// extra hint shown in the confirm dialog (e.g. the PR title).
export function useClosePr(onClosed?: () => void) {
    const { currentRepoOwnerAndName } = useContext(RepoContext);
    const owner = currentRepoOwnerAndName?.owner ?? null;
    const repo = currentRepoOwnerAndName?.name ?? null;
    const [closingPr, setClosingPr] = useState<number | null>(null);
    const [lastClose, setLastClose] = useState<{ ok: boolean; prNumber: number; message: string } | null>(null);

    const close = useCallback(async (prNumber: number, confirmDetail?: string) => {
        if (!owner || !repo) return;
        const detail = confirmDetail ? ` (${confirmDetail})` : '';
        if (!window.confirm(`Close PR #${prNumber}${detail} without merging? You can reopen it on GitHub.`)) return;
        setClosingPr(prNumber);
        setLastClose(null);
        try {
            const result = await prApi.closePr(owner, repo, prNumber);
            if (result.ok) {
                setLastClose({ ok: true, prNumber, message: `Closed #${prNumber} (not merged).` });
                onClosed?.();
            } else {
                setLastClose({ ok: false, prNumber, message: result.error });
            }
        } catch (error) {
            setLastClose({ ok: false, prNumber, message: (error as Error).message });
        } finally {
            setClosingPr(null);
        }
    }, [owner, repo, onClosed]);

    return { closingPr, lastClose, close };
}
