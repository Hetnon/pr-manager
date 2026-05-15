import { apiFetch } from './client.js';
import type { PR } from '@shared/pr.js';
import type { MergeStrategy, MergePrResult } from '@shared/merge.js';
import type { CheckMasterConflictResult } from '@shared/conflicts.js';

export function listPrs(owner: string, repo: string): Promise<PR[]> {
    return apiFetch<PR[]>('/api/prs', { query: { owner, repo } });
}

export function mergePr(
    owner: string,
    repo: string,
    prNumber: number,
    strategy: MergeStrategy = 'squash',
): Promise<MergePrResult> {
    return apiFetch<MergePrResult>('/api/merge-pr', {
        method: 'POST',
        body: { owner, repo, prNumber, strategy },
    });
}

export async function checkMasterConflicts(
    owner: string,
    repo: string,
    prNumbers: number[],
): Promise<Record<string, CheckMasterConflictResult>> {
    const res = await apiFetch<{ results: Record<string, CheckMasterConflictResult> }>(
        '/api/master-conflicts',
        { method: 'POST', body: { owner, repo, prNumbers } },
    );
    return res.results;
}
