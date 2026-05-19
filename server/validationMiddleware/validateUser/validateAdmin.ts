import type { Request, Response, NextFunction } from 'express';

export function validateAdmin(req: Request, res: Response, next: NextFunction): void {
    const allowedUserTypes = ['admin', 'master-admin'];
    const userType = req.session?.userType;

    if (!allowedUserTypes.includes(userType as string)) {
        const newError = Object.assign(
            new Error('User does not have permission to access this feature. Please log in again with an account that has the necessary permissions.'),
            { statusCode: 403 }
        );
        return next(newError);
    }
    return next();
}
