import { jest, describe, it, expect, beforeEach } from '@jest/globals';
import type { Request, Response, NextFunction } from 'express';

const { validateAdmin } = await import('./validateAdmin.js');

describe('validateAdmin', () => {
    let req: Partial<Request> & { session: Record<string, unknown> };
    let res: Partial<Response>;
    let next: jest.MockedFunction<NextFunction>;

    beforeEach(() => {
        jest.clearAllMocks();

        req = {
            session: {
                userType: 'admin',
            },
        } as typeof req;

        res = {};
        next = jest.fn() as typeof next;
    });

    it('should call next() when userType is admin (default allowed)', () => {
        req.session.userType = 'admin';

        validateAdmin(req as Request, res as Response, next);

        expect(next).toHaveBeenCalledTimes(1);
        expect(next).toHaveBeenCalledWith();
    });

    it('should call next() when userType is master-admin (default allowed)', () => {
        req.session.userType = 'master-admin';

        validateAdmin(req as Request, res as Response, next);

        expect(next).toHaveBeenCalledWith();
    });

    it('should return 403 error when userType is user', () => {
        req.session.userType = 'user';

        validateAdmin(req as Request, res as Response, next);

        expect(next).toHaveBeenCalledTimes(1);
        const error = next.mock.calls[0][0] as Error & { statusCode: number };
        expect(error).toBeInstanceOf(Error);
        expect(error.message).toBe('User does not have permission to access this feature. Please log in again with an account that has the necessary permissions.');
        expect(error.statusCode).toBe(403);
    });

    it('should return 403 error when userType is undefined', () => {
        delete req.session.userType;

        validateAdmin(req as Request, res as Response, next);

        const error = next.mock.calls[0][0] as Error & { statusCode: number };
        expect(error.statusCode).toBe(403);
    });

    it('should return 403 error when session does not exist', () => {
        (req as unknown as { session: null }).session = null;

        validateAdmin(req as Request, res as Response, next);

        const error = next.mock.calls[0][0] as Error & { statusCode: number };
        expect(error.statusCode).toBe(403);
    });

    it('should be case-sensitive for userType', () => {
        req.session.userType = 'Admin';

        validateAdmin(req as Request, res as Response, next);

        const error = next.mock.calls[0][0] as Error & { statusCode: number };
        expect(error.statusCode).toBe(403);
    });
});
