import { apiFetch } from './client.js';
import type { PR } from '@shared/pr.js';
import type { MergeStrategy, MergePrResult } from '@shared/merge.js';
import type { CheckConflictsResponse } from '@shared/conflicts.js';

export function listPrs(owner: string, repo: string): Promise<PR[]> {
    return apiFetch<PR[]>('/api/prs', { query: { owner, repo } });
}

export function mergePr(
    owner: string,
    repo: string,
    prNumber: number,
    strategy: MergeStrategy = 'squash',
    deleteBranch = true,
): Promise<MergePrResult> {
    return apiFetch<MergePrResult>('/api/merge-pr', {
        method: 'POST',
        body: { owner, repo, prNumber, strategy, deleteBranch },
    });
}

export function checkMasterConflicts(
    owner: string,
    repo: string,
    prNumbers: number[],
): Promise<CheckConflictsResponse> {
    return apiFetch<CheckConflictsResponse>(
        '/api/master-conflicts',
        { method: 'POST', body: { owner, repo, prNumbers } },
    );
}
