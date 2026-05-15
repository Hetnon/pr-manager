import type { Request, Response } from 'express';
import { checkMasterConflict } from '../../../utils/checkMasterConflict.js';
import { validateRepo } from '../../../utils/validateRepo.js';
import { getUserToken } from '../../../databases/databases.js';
import { requireParam } from '../../../utils/requireParam/requireParam.js';
import type { CheckMasterConflictResult } from '@shared/conflicts.js';

export async function checkMasterConflicts(req: Request, res: Response): Promise<void> {
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

    const results: Record<string, CheckMasterConflictResult> = {};
    // Sequential to be polite to GitHub API rate limits; PR counts here are typically small.
    for (const n of body.prNumbers ?? []) {
        results[String(n)] = await checkMasterConflict(v.owner, v.repo, n, token);
    }
    res.status(200).json({ results });
}
