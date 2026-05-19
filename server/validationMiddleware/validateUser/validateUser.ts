import type { Request, Response, NextFunction } from 'express';

export function validateUser(req: Request, res: Response, next: NextFunction): void {
    const userEmail = req.session?.userEmail;
    const userStatus = req.session?.userStatus;

    if (!userEmail) {
        const newError = Object.assign(new Error('Authentication required. Please log in.'), { statusCode: 401 });
        return next(newError);
    }

    if (userStatus !== 'active') {
        const newError = Object.assign(new Error('Account is not active. Access denied.'), { statusCode: 403 });
        return next(newError);
    }
    return next();
}
