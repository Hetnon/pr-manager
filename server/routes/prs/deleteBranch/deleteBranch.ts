import type { Request, Response } from 'express';
import type { DeleteRemoteBranchResponse } from '@shared/branches.js';
import { deleteRemoteBranch } from '../../../utils/deleteRemoteBranch.js';
import { validateRepo } from '../../../utils/validateRepo.js';
import { getUserToken } from '../../../databases/databases.js';
import { requireParam } from '../../../utils/requireParam/requireParam.js';

// POST /api/delete-branch — deletes a branch on origin via the GitHub API.
// Local-side deletion happens in the browser via isomorphic-git; this endpoint
// is the origin-side counterpart. Branch protection / missing-ref errors are
// surfaced through the result, not thrown.
export async function deleteBranch(req: Request, res: Response): Promise<void> {
    const body = req.body as { owner?: string; repo?: string; branch?: string };
    requireParam(body.owner, 'owner is required');
    requireParam(body.repo, 'repo is required');
    requireParam(body.branch, 'branch is required');

    const userEmail = req.session.userEmail!;
    const token = (await getUserToken(userEmail)) as string | null;
    if (!token) {
        throw Object.assign(new Error('No GitHub token stored — please re-authenticate'), { statusCode: 401 });
    }

    const v = await validateRepo(`${body.owner}/${body.repo}`, token);
    if (!v.ok) {
        res.status(400).json({ error: v.error });
        return;
    }

    const result = await deleteRemoteBranch(v.owner, v.repo, body.branch!, token);
    const response: DeleteRemoteBranchResponse = result.ok
        ? { ok: true, alreadyGone: result.alreadyGone }
        : { ok: false, error: result.error };
    res.status(200).json(response);
}
