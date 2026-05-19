import type { Request, Response } from 'express';
import { mergePr as mergePrApi } from '../../../utils/mergePr.js';
import { validateRepo } from '../../../utils/validateRepo.js';
import { getUserToken } from '../../../databases/databases.js';
import { requireParam } from '../../../utils/requireParam/requireParam.js';
import type { MergeStrategy } from '@shared/merge.js';

export async function mergePr(req: Request, res: Response): Promise<void> {
    const body = req.body as {
        owner?: string;
        repo?: string;
        prNumber?: number;
        strategy?: MergeStrategy;
        deleteBranch?: boolean;
    };
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

    const result = await mergePrApi(v.owner, v.repo, body.prNumber!, body.strategy, token, body.deleteBranch);
    res.status(result.ok ? 200 : 500).json(result);
}
