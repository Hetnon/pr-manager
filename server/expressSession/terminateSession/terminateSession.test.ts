// @ts-nocheck

import { jest, describe, it, expect, beforeEach } from '@jest/globals';
// Mock BEFORE importing the module that uses it

const removeSessionFromMap = jest.fn();
jest.unstable_mockModule('../../databases/databases.js', () => ({
    removeSessionFromMap: removeSessionFromMap
}));

// Mock the database module
jest.mock('../../databases/databases.js'); // with this, all imports of '../../databases/databases.js' from now on will be mocked


// Dynamic import AFTER mock is registered - must import dynamically to ensure the mock is in place
const {terminateSession} = await import('./terminateSession.js');

describe('terminateSession', () => {
    let req, res, originalEnv;

    beforeEach(async () => {
        originalEnv = { ...process.env };
        jest.clearAllMocks();
        // need to call sessionConfig to reset the session name for tests
        const sessionConfigModule = await import('../sessionConfig/sessionConfig.js');
        process.env.NODE_ENV = 'development';
        process.env.COOKIE_DOMAIN = 'localhost';
        process.env.SESSION_SECRET = 'test-secret-key';
        req = {
            session: {
                id: 'test-session-123',
                userEmail: 'test@example.com',
                cookie: {
                    domain: '.applyturbo.com',
                    sameSite: 'lax'
                },
                destroy: jest.fn((callback) => callback(null)) // Success case
            }
        };
        sessionConfigModule.createSessionConfig({ get: jest.fn(), set: jest.fn() }); // This will reset the session name to default based on NODE_ENV
        // Mock request object


        // Mock response object — terminateSession ends with res.status(200).json(...)
        res = {
            clearCookie: jest.fn(),
            status: jest.fn(function () { return this; }),
            json: jest.fn(function () { return this; }),
        };

        // Mock the database function to resolve successfully
        removeSessionFromMap.mockResolvedValue(undefined);
    });

    afterEach(() => {
        process.env = originalEnv;
    });

    it('should destroy session, clear cookie, and remove from DB', async () => {
        await terminateSession(req, res);

        expect(req.session.destroy).toHaveBeenCalledTimes(1);
        expect(res.clearCookie).toHaveBeenCalledWith('development', {
            path: '/',
            httpOnly: true,
            secure: true,
            sameSite: 'lax',
            domain: '.applyturbo.com'
        });
        expect(removeSessionFromMap).toHaveBeenCalledWith('test@example.com', 'test-session-123');
    });

    it('should handle different cookie configurations', async () => {
        req.session.cookie = {
            domain: 'localhost',
            sameSite: 'strict'
        };

        await terminateSession(req, res);

        expect(res.clearCookie).toHaveBeenCalledWith('development', {
            path: '/',
            httpOnly: true,
            secure: true,
            sameSite: 'strict',
            domain: 'localhost'
        });
    });

    it('should throw error when session destroy fails', async () => {
        const destroyError = new Error('Session destroy failed');
        req.session.destroy = jest.fn((callback) => callback(destroyError));

        await expect(terminateSession(req, res, 'connect.sid')).rejects.toThrow('Session destroy failed');

        // Should not proceed to clear cookie or DB cleanup
        expect(res.clearCookie).not.toHaveBeenCalled();
        expect(removeSessionFromMap).not.toHaveBeenCalled();
    });

    it('should throw error when DB cleanup fails', async () => {
        const dbError = new Error('Database connection failed');
        removeSessionFromMap.mockRejectedValue(dbError);

        await expect(terminateSession(req, res, 'connect.sid')).rejects.toThrow('Database connection failed');

        // Session should still be destroyed and cookie cleared before DB error
        expect(req.session.destroy).toHaveBeenCalled();
        expect(res.clearCookie).toHaveBeenCalled();
    });

    it('should skip DB cleanup when userEmail is missing', async () => {
        req.session.userEmail = undefined;

        await terminateSession(req, res, 'connect.sid');

        // Impl guards: `if (userEmail) await removeSessionFromMap(...)`
        expect(removeSessionFromMap).not.toHaveBeenCalled();
    });

    it('should call destroy, clearCookie, and DB cleanup in correct order', async () => {
        const callOrder = [];

        req.session.destroy = jest.fn((callback) => {
            callOrder.push('destroy');
            callback(null);
        });
        res.clearCookie = jest.fn(() => callOrder.push('clearCookie'));
        removeSessionFromMap.mockImplementation(() => {
            callOrder.push('removeFromDB');
            return Promise.resolve();
        });

        await terminateSession(req, res, 'connect.sid');

        expect(callOrder).toEqual(['destroy', 'clearCookie', 'removeFromDB']);
    });
});
