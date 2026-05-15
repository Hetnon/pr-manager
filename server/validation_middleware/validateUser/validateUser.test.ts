import { jest, describe, it, expect, beforeEach } from '@jest/globals';
import type { Request, Response, NextFunction } from 'express';

const { validateUser } = await import('./validateUser.js');

describe('validateUser', () => {
    let req: Partial<Request> & { session: Record<string, unknown> };
    let res: Partial<Response>;
    let next: jest.MockedFunction<NextFunction>;

    beforeEach(() => {
        jest.clearAllMocks();

        req = {
            session: {
                userEmail: 'user@example.com',
                userStatus: 'active',
            },
        } as typeof req;

        res = {};
        next = jest.fn() as typeof next;
    });

    it('should call next() when user is authenticated and active', () => {
        validateUser(req as Request, res as Response, next);

        expect(next).toHaveBeenCalledTimes(1);
        expect(next).toHaveBeenCalledWith();
    });

    it('should return 401 error when userEmail is missing', () => {
        req.session.userEmail = null;

        validateUser(req as Request, res as Response, next);

        expect(next).toHaveBeenCalledTimes(1);
        const error = next.mock.calls[0][0] as Error & { statusCode: number };
        expect(error).toBeInstanceOf(Error);
        expect(error.message).toBe('Authentication required. Please log in.');
        expect(error.statusCode).toBe(401);
    });

    it('should return 401 error when userEmail is undefined', () => {
        delete req.session.userEmail;

        validateUser(req as Request, res as Response, next);

        expect(next).toHaveBeenCalledTimes(1);
        const error = next.mock.calls[0][0] as Error & { statusCode: number };
        expect(error.statusCode).toBe(401);
    });

    it('should return 401 error when session does not exist', () => {
        (req as unknown as { session: null }).session = null;

        validateUser(req as Request, res as Response, next);

        expect(next).toHaveBeenCalledTimes(1);
        const error = next.mock.calls[0][0] as Error & { statusCode: number };
        expect(error.message).toBe('Authentication required. Please log in.');
        expect(error.statusCode).toBe(401);
    });

    it('should return 403 error when userStatus is not active', () => {
        req.session.userStatus = 'suspended';

        validateUser(req as Request, res as Response, next);

        expect(next).toHaveBeenCalledTimes(1);
        const error = next.mock.calls[0][0] as Error & { statusCode: number };
        expect(error).toBeInstanceOf(Error);
        expect(error.message).toBe('Account is not active. Access denied.');
        expect(error.statusCode).toBe(403);
    });

    it('should return 403 error when userStatus is pending', () => {
        req.session.userStatus = 'pending';

        validateUser(req as Request, res as Response, next);

        const error = next.mock.calls[0][0] as Error & { statusCode: number };
        expect(error.statusCode).toBe(403);
    });

    it('should return 403 error when userStatus is undefined', () => {
        delete req.session.userStatus;

        validateUser(req as Request, res as Response, next);

        const error = next.mock.calls[0][0] as Error & { statusCode: number };
        expect(error.statusCode).toBe(403);
    });

    it('should check userEmail before userStatus', () => {
        req.session.userEmail = null;
        req.session.userStatus = 'suspended';

        validateUser(req as Request, res as Response, next);

        const error = next.mock.calls[0][0] as Error & { statusCode: number };
        expect(error.statusCode).toBe(401);
    });

    it('should allow user with active status and valid email', () => {
        req.session.userEmail = 'admin@example.com';
        req.session.userStatus = 'active';

        validateUser(req as Request, res as Response, next);

        expect(next).toHaveBeenCalledWith();
    });
});
