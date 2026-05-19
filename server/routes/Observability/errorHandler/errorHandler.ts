import type { Request, Response, NextFunction } from 'express';
import type { AppError } from '@shared/error.js';
import { saveErrorsToDB } from '../../../databases/databases.js';

export function errorHandler(error: AppError, req: Request, res: Response, _next: NextFunction): void {
    console.error(error);
    const userEmail = req.session?.userEmail ?? 'unknown-user';
    const payload = {
        userEmail,
        error: {
            ...error,
            name: error.name,
            message: error.message,
            stack: error.stack,
        },
        body: req.body as unknown,
        query: req.query,
        params: req.params,
        IP: req.ip,
        url: req.originalUrl,
        method: req.method,
        origin: 'server-error-handler',
    };

    saveErrorsToDB(payload);

    res.status(error.statusCode ?? 500).json({
        errorMessage: error.message || 'An unexpected error occurred',
        stack: error.stack,
        ...error,
    });
}
