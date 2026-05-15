import type { Request, Response } from 'express';
import { saveErrorsToDB } from '../../../databases/databases.js';
import { requireParam } from '../../../utils/requireParam/requireParam.js';

export async function logError(req: Request, res: Response): Promise<void> {
    const errorPayload = req.body as Record<string, unknown>;
    requireParam(errorPayload, 'Error payload is required');
    const userEmail = req.session?.userEmail ?? 'unknown-user';
    const payload = {
        userEmail,
        IP: req.ip,
        url: req.originalUrl,
        method: req.method,
        ...errorPayload,
    };
    await saveErrorsToDB(payload);
    res.status(200).json({ message: 'Error logged successfully' });
}
