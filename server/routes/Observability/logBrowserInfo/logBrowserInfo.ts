import type { Request, Response } from 'express';
import { saveBrowserInfoToDB } from '../../../databases/databases.js';
import { throwValidationError } from '../../../utils/requireParam/requireParam.js';

export async function logBrowserInfo(req: Request, res: Response): Promise<void> {
    const body = req.body as Record<string, unknown>;
    if (!body || Object.keys(body).length === 0) throwValidationError('Browser info payload is required');

    const userEmail = req.session?.userEmail ?? 'unknown-user';
    const payload = {
        userEmail,
        ...body,
        IP: req.ip,
    };

    await saveBrowserInfoToDB(payload);
    res.status(200).json({ message: 'Browser info logged successfully' });
}
