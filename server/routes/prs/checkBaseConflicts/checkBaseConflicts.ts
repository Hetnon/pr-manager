import type { Request, Response } from 'express';
import { checkBaseConflict } from '../../../utils/checkBaseConflict.js';
import { validateRepo } from '../../../utils/validateRepo.js';
import { getUserToken } from '../../../databases/databases.js';
import { requireParam } from '../../../utils/requireParam/requireParam.js';
import type { CheckConflictsResponse, CheckBaseConflictResult } from '@shared/conflicts.js';

// PR-vs-PR pairwise detection moved out — see server/_archived/pairwisePrConflicts.ts.
// The browser now computes pairwise locally via isomorphic-git mergeFile so we
// get real 3-way merge semantics instead of the line-range heuristic.
export async function checkBaseConflicts(req: Request, res: Response): Promise<void> {
    const body = req.body as { owner?: string; repo?: string; prNumbers?: number[] };
    requireParam(body.owner, 'owner is required');
    requireParam(body.repo, 'repo is required');
    requireParam(Array.isArray(body.prNumbers), 'prNumbers must be an array');

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

    const results: Record<string, CheckBaseConflictResult> = {};
    for (const n of body.prNumbers ?? []) {
        results[String(n)] = await checkBaseConflict(v.owner, v.repo, n, token);
    }
    const response: CheckConflictsResponse = { results };
    res.status(200).json(response);
}
