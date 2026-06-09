import { apiFetch } from './client.js';
import type { PR } from '@shared/pr.js';
import type { MergeStrategy, MergePrResult } from '@shared/merge.js';
import type { CheckConflictsResponse } from '@shared/conflicts.js';
import type { ClosePrResult, CreatePrPayload, CreatePrResult } from '@shared/git.js';

export function listPrs(owner: string, repo: string): Promise<PR[]> {
    return apiFetch<PR[]>('/api/prs', { query: { owner, repo } });
}

export function createPr(payload: CreatePrPayload): Promise<CreatePrResult> {
    return apiFetch<CreatePrResult>('/api/create-pr', { method: 'POST', body: payload });
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

// Closes a PR without merging (disregard it). GitHub has no delete; reopenable.
export function closePr(owner: string, repo: string, prNumber: number): Promise<ClosePrResult> {
    return apiFetch<ClosePrResult>('/api/close-pr', {
        method: 'POST',
        body: { owner, repo, prNumber },
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
