import type { Request, Response } from 'express';
import type { CreatePrPayload } from '@shared/git.js';
import { createPullRequest } from '../../../utils/createPullRequest.js';
import { validateRepo } from '../../../utils/validateRepo.js';
import { getUserToken } from '../../../databases/databases.js';
import { requireParam } from '../../../utils/requireParam/requireParam.js';

export async function createPr(req: Request, res: Response): Promise<void> {
    const body = req.body as Partial<CreatePrPayload>;
    requireParam(body.owner, 'owner is required');
    requireParam(body.repo, 'repo is required');
    requireParam(body.head, 'head branch is required');
    requireParam(body.base, 'base branch is required');
    requireParam(body.title, 'title is required');

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

    const result = await createPullRequest(body as CreatePrPayload, token);
    res.status(201).json(result);
}
