import type { Request, Response } from 'express';
import { closePullRequest } from '../../../utils/closePullRequest.js';
import { validateRepo } from '../../../utils/validateRepo.js';
import { getUserToken } from '../../../databases/databases.js';
import { requireParam } from '../../../utils/requireParam/requireParam.js';

// POST /api/close-pr — closes a PR without merging (disregard it). GitHub has no
// delete-PR; closing is the equivalent and is reversible (reopen on GitHub).
export async function closePr(req: Request, res: Response): Promise<void> {
    const body = req.body as { owner?: string; repo?: string; prNumber?: number };
    requireParam(body.owner, 'owner is required');
    requireParam(body.repo, 'repo is required');
    requireParam(body.prNumber, 'prNumber is required', 'number');

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

    const result = await closePullRequest(v.owner, v.repo, body.prNumber!, token);
    res.status(result.ok ? 200 : 500).json(result);
}
