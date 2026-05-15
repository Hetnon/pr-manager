import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import type { Request, Response } from 'express';
import { getUsersList } from './getUsersList.js';
import { initializeAllDatabasesForTests, tearDownAllDatabasesForTests } from '../../../databases/databases.js';

describe('getUsersList', () => {
    beforeAll(async () => {
        await initializeAllDatabasesForTests();
    }, 15000);

    afterAll(async () => {
        await tearDownAllDatabasesForTests();
    }, 15000);

    function createMockReq(params: Record<string, string> = {}): Partial<Request> {
        return {
            params: { pageNumber: '1', usersPerPage: '10', ...params },
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

    it('should return a paginated users list with 200', async () => {
        const req = createMockReq();
        const res = createMockRes();

        await getUsersList(req as Request, res as unknown as Response);

        expect(res.statusCode).toBe(200);
        const responseObject = (res.jsonData as { responseObject: { users: unknown[]; page: number; perPage: number } }).responseObject;
        expect(responseObject).toBeDefined();
        expect(Array.isArray(responseObject.users)).toBe(true);
        expect(responseObject.page).toBe(1);
        expect(responseObject.perPage).toBe(10);
    });

    it('should parse string params to integers and return users', async () => {
        const req = createMockReq({ pageNumber: '1', usersPerPage: '25' });
        const res = createMockRes();

        await getUsersList(req as Request, res as unknown as Response);

        expect(res.statusCode).toBe(200);
        const responseObject = (res.jsonData as { responseObject: { users: unknown[] } }).responseObject;
        expect(Array.isArray(responseObject.users)).toBe(true);
    });
});
