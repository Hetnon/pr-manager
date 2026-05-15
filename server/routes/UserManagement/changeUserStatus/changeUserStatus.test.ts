import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import type { Request, Response } from 'express';
import { changeUserStatus } from './changeUserStatus.js';
import { initializeAllDatabasesForTests, tearDownAllDatabasesForTests } from '../../../databases/databases.js';
import { TEST_USERS } from 'testing/mocks/expressServer/testUsers.js';

describe('changeUserStatus', () => {
    beforeAll(async () => {
        await initializeAllDatabasesForTests();
    }, 15000);

    afterAll(async () => {
        await tearDownAllDatabasesForTests();
    }, 15000);

    function createMockReq(body: Record<string, unknown> = {}): Partial<Request> {
        return {
            body: { userEmail: TEST_USERS.ACTIVE, newStatus: 'inactive', ...body },
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

    it('should update user status and respond with 200', async () => {
        const req = createMockReq();
        const res = createMockRes();

        await changeUserStatus(req as Request, res as unknown as Response);

        expect(res.statusCode).toBe(200);
        expect((res.jsonData as { message: string }).message).toBe('User status changed');
    });

    it('should throw 400 when userEmail is missing', async () => {
        const req = createMockReq({ userEmail: '' });
        const res = createMockRes();

        await expect(changeUserStatus(req as Request, res as unknown as Response)).rejects.toThrow(
            'User email is required to change user status',
        );
    });
});
