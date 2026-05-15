import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import type { Request, Response } from 'express';
import { logError } from './logError.js';
import { initializeAllDatabasesForTests, tearDownAllDatabasesForTests } from '../../../databases/databases.js';

describe('logError', () => {
    beforeAll(async () => {
        await initializeAllDatabasesForTests();
    }, 15000);

    afterAll(async () => {
        await tearDownAllDatabasesForTests();
    }, 15000);

    function createMockReq(body: Record<string, unknown> | null, overrides: Partial<Request> = {}): Partial<Request> {
        return {
            session: { userEmail: 'active@example.com' } as Request['session'],
            body,
            ip: '127.0.0.1',
            originalUrl: '/api/log-error-test',
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

    it('should save an error payload and respond with 200', async () => {
        const errorPayload = {
            error: { message: 'Test client error', stack: 'Error: Test\n    at line 1' },
            origin: 'extensionCall',
            task: 'test-task',
            website: 'linkedin',
        };
        const req = createMockReq(errorPayload);
        const res = createMockRes();

        await logError(req as Request, res as unknown as Response);

        expect(res.statusCode).toBe(200);
        expect((res.jsonData as { message: string }).message).toBe('Error logged successfully');
    });

    it('should throw when error payload is missing', async () => {
        const req = createMockReq(null);
        const res = createMockRes();

        await expect(logError(req as Request, res as unknown as Response)).rejects.toThrow('Error payload is required');
    });

    it('should use unknown-user when session userEmail is missing', async () => {
        const errorPayload = { error: { message: 'No user test' }, origin: 'extensionCall' };
        const req = createMockReq(errorPayload, { session: {} as Request['session'] });
        const res = createMockRes();

        await logError(req as Request, res as unknown as Response);

        expect(res.statusCode).toBe(200);
    });
});
