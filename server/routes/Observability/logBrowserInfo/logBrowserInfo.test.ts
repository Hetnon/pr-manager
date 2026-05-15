import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import type { Request, Response } from 'express';
import { logBrowserInfo } from './logBrowserInfo.js';
import { initializeAllDatabasesForTests, tearDownAllDatabasesForTests } from '../../../databases/databases.js';
import { TEST_USERS } from 'testing/mocks/expressServer/testUsers.js';

describe('logBrowserInfo', () => {
    beforeAll(async () => {
        await initializeAllDatabasesForTests();
    }, 15000);

    afterAll(async () => {
        await tearDownAllDatabasesForTests();
    }, 15000);

    function createMockReq(body: Record<string, unknown> | null, overrides: Partial<Request> = {}): Partial<Request> {
        return {
            session: { userEmail: TEST_USERS.NO_SESSIONS } as Request['session'],
            body,
            ip: '127.0.0.1',
            ...overrides,
        };
    }

    function createMockRes(): { statusCode?: number; jsonData?: unknown; status: (code: number) => typeof res; json: (data: unknown) => typeof res } {
        const res = {
            statusCode: undefined as number | undefined,
            jsonData: undefined as unknown,
            status(code: number) { this.statusCode = code; return this; },
            json(data: unknown) { this.jsonData = data; return this; },
        };
        return res;
    }

    it('should save browser info payload and respond with 200', async () => {
        const body = {
            browserInfo: { name: 'Chrome/Brave', version: '120.0', engine: 'Chromium' },
            device: { name: 'desktop', type: 'desktop' },
        };
        const req = createMockReq(body);
        const res = createMockRes();

        await logBrowserInfo(req as Request, res as unknown as Response);

        expect(res.statusCode).toBe(200);
        expect((res.jsonData as { message: string }).message).toBe('Browser info logged successfully');
    });

    it('should throw when body is empty', async () => {
        const req = createMockReq({});
        const res = createMockRes();

        await expect(logBrowserInfo(req as Request, res as unknown as Response)).rejects.toThrow('Browser info payload is required');
    });

    it('should throw when body is null', async () => {
        const req = createMockReq(null);
        const res = createMockRes();

        await expect(logBrowserInfo(req as Request, res as unknown as Response)).rejects.toThrow('Browser info payload is required');
    });

    it('should use unknown-user when session userEmail is missing', async () => {
        const body = { browserInfo: { name: 'Firefox', version: '121.0' }, device: { name: 'mobile', type: 'mobile' } };
        const req = createMockReq(body, { session: {} as Request['session'] });
        const res = createMockRes();

        await logBrowserInfo(req as Request, res as unknown as Response);

        expect(res.statusCode).toBe(200);
    });
});
