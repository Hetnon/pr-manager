import type { Request, Response } from 'express';
import { fetchPRs } from '../../../utils/fetchPRs.js';
import { validateRepo } from '../../../utils/validateRepo.js';
import { getUserToken } from '../../../databases/databases.js';
import { requireParam } from '../../../utils/requireParam/requireParam.js';

export async function listPrs(req: Request, res: Response): Promise<void> {
    const owner = req.query.owner as string | undefined;
    const repo = req.query.repo as string | undefined;
    requireParam(owner, 'owner query param is required');
    requireParam(repo, 'repo query param is required');

    const userEmail = req.session.userEmail!;
    const token = (await getUserToken(userEmail)) as string | null;
    if (!token) {
        throw Object.assign(new Error('No GitHub token stored — please re-authenticate'), { statusCode: 401 });
    }

    const v = await validateRepo(`${owner}/${repo}`, token);
    if (!v.ok) {
        res.status(400).json({ error: v.error, needsRepo: true });
        return;
    }

    const prs = await fetchPRs(v.owner, v.repo, token);
    res.status(200).json(prs);
}
