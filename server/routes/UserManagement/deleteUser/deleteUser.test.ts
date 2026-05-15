import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import type { Request, Response } from 'express';
import { deleteUser } from './deleteUser.js';
import { initializeAllDatabasesForTests, tearDownAllDatabasesForTests } from '../../../databases/databases.js';
import { TEST_USERS } from 'testing/mocks/expressServer/testUsers.js';

describe('deleteUser', () => {
    beforeAll(async () => {
        await initializeAllDatabasesForTests();
    }, 15000);

    afterAll(async () => {
        await tearDownAllDatabasesForTests();
    }, 15000);

    function createMockReq(params: Record<string, string | undefined> = {}): Partial<Request> {
        return {
            params: { userEmail: TEST_USERS.ACTIVE, ...params } as Record<string, string>,
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

    it('should delete a user and respond with 200', async () => {
        const req = createMockReq();
        const res = createMockRes();

        await deleteUser(req as Request, res as unknown as Response);

        expect(res.statusCode).toBe(200);
        expect((res.jsonData as { message: string }).message).toBe('User deleted');
    });

    it('should return 400 when userEmail is missing', async () => {
        const req = createMockReq({ userEmail: undefined });
        const res = createMockRes();

        await deleteUser(req as Request, res as unknown as Response);

        expect(res.statusCode).toBe(400);
        expect((res.jsonData as { errorMessage: string }).errorMessage).toBe('User email is required to delete user');
    });
});
