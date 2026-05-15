import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import type { Request, Response, NextFunction } from 'express';
import { errorHandler } from './errorHandler.js';
import { initializeAllDatabasesForTests, tearDownAllDatabasesForTests } from '../../../databases/databases.js';

describe('errorHandler', () => {
    beforeAll(async () => {
        await initializeAllDatabasesForTests();
    }, 15000);

    afterAll(async () => {
        await tearDownAllDatabasesForTests();
    }, 15000);

    function createMockReq(overrides: Partial<Request> = {}): Partial<Request> {
        return {
            session: { userEmail: 'active@example.com' } as Request['session'],
            body: {},
            query: {},
            params: {},
            ip: '127.0.0.1',
            originalUrl: '/api/test-error-handler',
            method: 'POST',
            ...overrides,
        };
    }

    function createMockRes() {
        const res = {
            statusCode: undefined as number | undefined,
            jsonData: undefined as unknown,
            status(code: number) { this.statusCode = code; return this; },
            json(data: unknown) { this.jsonData = data; return this; },
        };
        return res;
    }

    it('should respond with the error status code and message', () => {
        const error = Object.assign(new Error('Something went wrong'), { statusCode: 500 });
        const req = createMockReq();
        const res = createMockRes();

        errorHandler(error, req as Request, res as unknown as Response, (() => {}) as NextFunction);

        expect(res.statusCode).toBe(500);
        expect((res.jsonData as { errorMessage: string; stack: string }).errorMessage).toBe('Something went wrong');
        expect((res.jsonData as { stack: string }).stack).toBeDefined();
    });

    it('should build the correct payload for saveErrorsToDB', () => {
        const error = Object.assign(new Error('DB test error'), { statusCode: 400 });
        const req = createMockReq();
        const res = createMockRes();

        errorHandler(error, req as Request, res as unknown as Response, (() => {}) as NextFunction);

        expect(res.statusCode).toBe(400);
        expect((res.jsonData as { errorMessage: string }).errorMessage).toBe('DB test error');
    });

    it('should use unknown-user when session userEmail is missing', () => {
        const error = Object.assign(new Error('No user error'), { statusCode: 500 });
        const req = createMockReq({ session: {} as Request['session'] });
        const res = createMockRes();

        errorHandler(error, req as Request, res as unknown as Response, (() => {}) as NextFunction);

        expect(res.statusCode).toBe(500);
        expect((res.jsonData as { errorMessage: string }).errorMessage).toBe('No user error');
    });
});
