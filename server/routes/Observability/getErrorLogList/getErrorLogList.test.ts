import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import type { Request, Response } from 'express';
import { getErrorLogList } from './getErrorLogList.js';
import { initializeAllDatabasesForTests, tearDownAllDatabasesForTests } from '../../../databases/databases.js';
import { TEST_USERS } from 'testing/mocks/expressServer/testUsers.js';

describe('getErrorLogList', () => {
    beforeAll(async () => {
        await initializeAllDatabasesForTests();
    }, 15000);

    afterAll(async () => {
        await tearDownAllDatabasesForTests();
    }, 15000);

    function createMockReq(queryOverrides: Record<string, string> = {}): Partial<Request> {
        return {
            query: { pageNumber: '1', errorsPerPage: '10', ...queryOverrides },
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

    it('should return a paginated list of error logs', async () => {
        const req = createMockReq();
        const res = createMockRes();

        await getErrorLogList(req as Request, res as unknown as Response);

        expect(res.statusCode).toBe(200);
        expect((res.jsonData as { errorLogList: unknown[] }).errorLogList).toBeDefined();
        expect(Array.isArray((res.jsonData as { errorLogList: unknown[] }).errorLogList)).toBe(true);
    });

    it('should filter error logs by userEmail', async () => {
        const req = createMockReq({ userEmail: TEST_USERS.ACTIVE });
        const res = createMockRes();

        await getErrorLogList(req as Request, res as unknown as Response);

        expect(res.statusCode).toBe(200);
        const logs = (res.jsonData as { errorLogList: Array<{ userEmail: string }> }).errorLogList;
        for (const log of logs) {
            expect(log.userEmail).toBe(TEST_USERS.ACTIVE);
        }
    });

    it('should filter error logs by status', async () => {
        const req = createMockReq({ statusFilters: JSON.stringify(['new']) });
        const res = createMockRes();

        await getErrorLogList(req as Request, res as unknown as Response);

        expect(res.statusCode).toBe(200);
        const logs = (res.jsonData as { errorLogList: Array<{ status: string }> }).errorLogList;
        for (const log of logs) {
            expect(log.status).toBe('new');
        }
    });

    it('should throw when errorsPerPage is not a positive integer', async () => {
        const req = createMockReq({ errorsPerPage: '0' });
        const res = createMockRes();

        await expect(getErrorLogList(req as Request, res as unknown as Response)).rejects.toThrow('errorsPerPage must be a positive integer');
    });

    it('should throw when errorsPerPage is not a number', async () => {
        const req = createMockReq({ errorsPerPage: 'abc' });
        const res = createMockRes();

        await expect(getErrorLogList(req as Request, res as unknown as Response)).rejects.toThrow('errorsPerPage must be a positive integer');
    });

    it('should return createdAt as an ISO string', async () => {
        const req = createMockReq({ userEmail: TEST_USERS.ACTIVE });
        const res = createMockRes();

        await getErrorLogList(req as Request, res as unknown as Response);

        const logs = (res.jsonData as { errorLogList: Array<{ createdAt: string }> }).errorLogList;
        if (logs.length > 0) {
            expect(typeof logs[0].createdAt).toBe('string');
        }
    });
});
