// @ts-nocheck
import { jest, describe, it, expect, beforeEach } from '@jest/globals';

jest.unstable_mockModule('../../databases/databases.js', () => ({
    includeSessionInMap: jest.fn()
}));

const { includeUserInfoToSession } = await import('./includeUserInfoToSession.js');

describe('includeUserInfoToSession', () => {
    let req;

    beforeEach(() => {
        jest.clearAllMocks();

        req = {
            session: {
                // Mock regenerate as a callback-style function
                regenerate: jest.fn((callback) => callback(null)),
                // Mock save as a callback-style function
                save: jest.fn((callback) => callback(null)),
                userEmail: null,
                userType: null,
                userStatus: null
            }
        };
    });

    it('should regenerate session, set user data, and save', async () => {
        await includeUserInfoToSession(req, 'user@example.com', 'premium', 'active');

        expect(req.session.regenerate).toHaveBeenCalledTimes(1);
        expect(req.session.save).toHaveBeenCalledTimes(1);
        
        expect(req.session.userEmail).toBe('user@example.com');
        expect(req.session.userType).toBe('premium');
        expect(req.session.userStatus).toBe('active');
    });

    it('should handle different user types', async () => {
        await includeUserInfoToSession(req, 'admin@example.com', 'admin', 'verified');

        expect(req.session.userEmail).toBe('admin@example.com');
        expect(req.session.userType).toBe('admin');
        expect(req.session.userStatus).toBe('verified');
    });

    it('should throw error when session regeneration fails', async () => {
        const regenerateError = new Error('Regenerate failed');
        req.session.regenerate = jest.fn((callback) => callback(regenerateError));

        await expect(
            includeUserInfoToSession(req, 'user@example.com', 'premium', 'active')
        ).rejects.toThrow('Regenerate failed');

        expect(req.session.userEmail).toBeNull();
        expect(req.session.save).not.toHaveBeenCalled();
    });

    it('should throw error when session save fails', async () => {
        const saveError = new Error('Save failed');
        req.session.save = jest.fn((callback) => callback(saveError));

        await expect(
            includeUserInfoToSession(req, 'user@example.com', 'premium', 'active')
        ).rejects.toThrow('Save failed');

        expect(req.session.userEmail).toBe('user@example.com');
        expect(req.session.regenerate).toHaveBeenCalled();
    });

    it('should call regenerate and save in correct order', async () => {
        const callOrder = [];

        req.session.regenerate = jest.fn((callback) => {
            callOrder.push('regenerate');
            callback(null);
        });

        req.session.save = jest.fn((callback) => {
            callOrder.push('save');
            callback(null);
        });

        await includeUserInfoToSession(req, 'user@example.com', 'premium', 'active');

        expect(callOrder).toEqual(['regenerate', 'save']);
    });

    it('should handle null or undefined user data', async () => {
        await includeUserInfoToSession(req, null, undefined, '');

        expect(req.session.userEmail).toBeNull();
        expect(req.session.userType).toBeUndefined();
        expect(req.session.userStatus).toBe('');
        expect(req.session.save).toHaveBeenCalled();
    });
});
