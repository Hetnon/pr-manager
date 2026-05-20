import type { DeleteRemoteBranchResponse } from '@shared/branches.js';
import { apiFetch } from './client.js';

export function deleteRemoteBranch(
    owner: string,
    repo: string,
    branch: string,
): Promise<DeleteRemoteBranchResponse> {
    return apiFetch<DeleteRemoteBranchResponse>('/api/delete-branch', {
        method: 'POST',
        body: { owner, repo, branch },
    });
}
