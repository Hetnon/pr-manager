import type { Request, Response } from 'express';
import { getErrorListFromDB } from '../../../databases/databases.js';
import { throwValidationError } from '../../../utils/requireParam/requireParam.js';

export async function getErrorLogList(req: Request, res: Response): Promise<void> {
    const { pageNumber, batchSearchId, applicationId, jobListingId, statusFilters, userEmail, errorsPerPage } = req.query as Record<string, string | undefined>;

    const parsedPageSize = Number.parseInt(errorsPerPage ?? '');
    if (Number.isNaN(parsedPageSize) || parsedPageSize <= 0) throwValidationError('errorsPerPage must be a positive integer');

    const parsedPageNumber = Number.parseInt(pageNumber ?? '1');
    const statuses = statusFilters ? JSON.parse(statusFilters) as string[] : null;

    const payload = {
        pageNumber: parsedPageNumber,
        errorsPerPage: parsedPageSize,
        batchSearchId,
        statuses,
        applicationId,
        jobListingId,
        userEmail,
    };

    const errorLogList = await getErrorListFromDB(payload);
    res.status(200).json({ errorLogList });
}
