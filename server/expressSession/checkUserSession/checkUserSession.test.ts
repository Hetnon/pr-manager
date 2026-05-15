// @ts-nocheck
// firestore/sessions/sessionCheck/checkUserSession.test.js

import { describe, it, expect, beforeAll, afterAll, beforeEach, jest } from '@jest/globals';
import { mockSessionsData } from 'testing/mocks/expressServer/sessionFixtures.js';
import { TEST_SESSION_IDS } from 'testing/mocks/expressServer/sessionsMapFixtures.js';
import { TEST_USERS } from 'testing/mocks/expressServer/testUsers.js';
import { initializeAllDatabasesForTests, tearDownAllDatabasesForTests } from '../../databases/databases.js';
import { initializeCSRF, _resetCSRF } from '../../validation_middleware/tokenManager/tokenManager.js';


describe('Check User Session Integration Tests', () => {
    let checkUserSession;

    beforeAll(async () => {
        initializeCSRF();
        await initializeAllDatabasesForTests();
        const { getSessionStore} = await import('../../databases/databases.js');
        // Ensure we start with a fresh store instance for testing
        await getSessionStore();
        const checkModule = await import('./checkUserSession.js');
        checkUserSession = checkModule.checkUserSession;
    });

    

    afterAll(async () => {
        await tearDownAllDatabasesForTests();
        _resetCSRF();
    });

    describe('with active user session', () => {
        let req, res;

        beforeEach(async () => {
            const sessionData = JSON.parse(mockSessionsData[TEST_SESSION_IDS.ACTIVE_USER_SESSION_1].data);
            
            req = {
                session: {
                    id: TEST_SESSION_IDS.ACTIVE_USER_SESSION_1,
                    ...sessionData
                },
                sessionID: TEST_SESSION_IDS.ACTIVE_USER_SESSION_1
            };

            res = {
                status: jest.fn().mockReturnThis(),
                json: jest.fn().mockReturnThis()
            };
        });

        it('should return loggedIn true with token and user info for active user', async () => {
            await checkUserSession(req, res);

            expect(res.status).toHaveBeenCalledWith(200);
            
            const jsonCall = res.json.mock.calls[0][0].responseObject;
            expect(jsonCall.loggedIn).toBe(true);
            expect(jsonCall.token).toBeDefined();
            expect(typeof jsonCall.token).toBe('string');
            expect(jsonCall.userInfo).toBeUndefined();
        });

        it('should generate CSRF token', async () => {
            await checkUserSession(req, res);

            const jsonCall = res.json.mock.calls[0][0].responseObject;
            expect(jsonCall.token).toBeTruthy();
            expect(typeof jsonCall.token).toBe('string');
        });
    });

    describe('with inactive user session', () => {
        let req, res;

        beforeEach(() => {
            const sessionData = JSON.parse(mockSessionsData[TEST_SESSION_IDS.INACTIVE_USER_SESSION].data);
            
            req = {
                session: {
                    id: TEST_SESSION_IDS.INACTIVE_USER_SESSION,
                    ...sessionData
                },
                sessionID: TEST_SESSION_IDS.INACTIVE_USER_SESSION
            };

            res = {
                status: jest.fn().mockReturnThis(),
                json: jest.fn().mockReturnThis()
            };
        });

        it('should return loggedIn false when userStatus is inactive', async () => {
            await checkUserSession(req, res);

            expect(res.status).toHaveBeenCalledWith(200);
            expect(res.json).toHaveBeenCalledWith({ responseObject: { loggedIn: false } });
        });
    });

    describe('with admin user session', () => {
        let req, res;

        beforeEach(() => {
            const sessionData = JSON.parse(mockSessionsData[TEST_SESSION_IDS.ADMIN_SESSION_1].data);
            
            req = {
                session: {
                    id: TEST_SESSION_IDS.ADMIN_SESSION_1,
                    ...sessionData
                },
                sessionID: TEST_SESSION_IDS.ADMIN_SESSION_1
            };

            res = {
                status: jest.fn().mockReturnThis(),
                json: jest.fn().mockReturnThis()
            };
        });

        it('should return loggedIn true for admin with active status', async () => {
            await checkUserSession(req, res);

            expect(res.status).toHaveBeenCalledWith(200);
            
            const jsonCall = res.json.mock.calls[0][0].responseObject;
            expect(jsonCall.loggedIn).toBe(true);
            expect(jsonCall.token).toBeDefined();
            expect(typeof jsonCall.token).toBe('string');
            expect(jsonCall.userInfo).toBeUndefined();
        });

        it('should not include user info in response payload', async () => {
            await checkUserSession(req, res);

            const jsonCall = res.json.mock.calls[0][0].responseObject;
            expect(jsonCall.userInfo).toBeUndefined();
        });
    });

    describe('with missing or invalid session data', () => {
        let req, res;

        beforeEach(() => {
            res = {
                status: jest.fn().mockReturnThis(),
                json: jest.fn().mockReturnThis()
            };
        });

        it('should return loggedIn false when userEmail is missing', async () => {
            req = {
                session: {
                    id: 'test-session',
                    userStatus: 'active'
                    // userEmail is missing
                }
            };

            await checkUserSession(req, res);

            expect(res.status).toHaveBeenCalledWith(200);
            expect(res.json).toHaveBeenCalledWith({ responseObject: { loggedIn: false } });
        });

        it('should return loggedIn false when userEmail is null', async () => {
            req = {
                session: {
                    id: 'test-session',
                    userEmail: null,
                    userStatus: 'active'
                }
            };

            await checkUserSession(req, res);

            expect(res.json).toHaveBeenCalledWith({ responseObject: { loggedIn: false } });
        });

        it('should return loggedIn false when userStatus is missing', async () => {
            req = {
                session: {
                    id: 'test-session',
                    userEmail: TEST_USERS.ACTIVE
                    // userStatus is missing
                }
            };

            await checkUserSession(req, res);

            expect(res.json).toHaveBeenCalledWith({ responseObject: { loggedIn: false } });
        });

        it('should return loggedIn false when userStatus is pending', async () => {
            req = {
                session: {
                    id: 'test-session',
                    userEmail: TEST_USERS.ACTIVE,
                    userStatus: 'pending'
                }
            };

            await checkUserSession(req, res);

            expect(res.json).toHaveBeenCalledWith({ responseObject: { loggedIn: false } });
        });

        it('should return loggedIn false when userStatus is suspended', async () => {
            req = {
                session: {
                    id: 'test-session',
                    userEmail: TEST_USERS.ACTIVE,
                    userStatus: 'suspended'
                }
            };

            await checkUserSession(req, res);

            expect(res.json).toHaveBeenCalledWith({ responseObject: { loggedIn: false } });
        });

        it('should return loggedIn false when session is null', async () => {
            req = { session: null };

            await checkUserSession(req, res);

            expect(res.json).toHaveBeenCalledWith({ responseObject: { loggedIn: false } });
        });

        it('should return loggedIn false when session is undefined', async () => {
            req = {};

            await checkUserSession(req, res);

            expect(res.json).toHaveBeenCalledWith({ responseObject: { loggedIn: false } });
        });
    });

    describe('multiple sessions for same user', () => {
        it('should handle first session correctly', async () => {
            const sessionData = JSON.parse(mockSessionsData[TEST_SESSION_IDS.ACTIVE_USER_SESSION_1].data);
            
            const req = {
                session: {
                    id: TEST_SESSION_IDS.ACTIVE_USER_SESSION_1,
                    ...sessionData
                }
            };

            const res = {
                status: jest.fn().mockReturnThis(),
                json: jest.fn().mockReturnThis()
            };

            await checkUserSession(req, res);

            const jsonCall = res.json.mock.calls[0][0].responseObject;
            expect(jsonCall.loggedIn).toBe(true);
            expect(typeof jsonCall.token).toBe('string');
        });

        it('should handle second session correctly', async () => {
            const sessionData = JSON.parse(mockSessionsData[TEST_SESSION_IDS.ACTIVE_USER_SESSION_2].data);
            
            const req = {
                session: {
                    id: TEST_SESSION_IDS.ACTIVE_USER_SESSION_2,
                    ...sessionData
                }
            };

            const res = {
                status: jest.fn().mockReturnThis(),
                json: jest.fn().mockReturnThis()
            };

            await checkUserSession(req, res);

            const jsonCall = res.json.mock.calls[0][0].responseObject;
            expect(jsonCall.loggedIn).toBe(true);
            expect(typeof jsonCall.token).toBe('string');
        });

        it('should generate different CSRF tokens for different sessions', async () => {
            const session1Data = JSON.parse(mockSessionsData[TEST_SESSION_IDS.ACTIVE_USER_SESSION_1].data);
            const session2Data = JSON.parse(mockSessionsData[TEST_SESSION_IDS.ACTIVE_USER_SESSION_2].data);
            
            const req1 = {
                session: {
                    id: TEST_SESSION_IDS.ACTIVE_USER_SESSION_1,
                    ...session1Data
                }
            };

            const req2 = {
                session: {
                    id: TEST_SESSION_IDS.ACTIVE_USER_SESSION_2,
                    ...session2Data
                }
            };

            const res1 = {
                status: jest.fn().mockReturnThis(),
                json: jest.fn().mockReturnThis()
            };

            const res2 = {
                status: jest.fn().mockReturnThis(),
                json: jest.fn().mockReturnThis()
            };

            await checkUserSession(req1, res1);
            await checkUserSession(req2, res2);

            const token1 = res1.json.mock.calls[0][0].responseObject.token;
            const token2 = res2.json.mock.calls[0][0].responseObject.token;

            expect(token1).toBeDefined();
            expect(token2).toBeDefined();
            expect(token1).not.toBe(token2);
        });
    });

    describe('response payload shape', () => {
        it('should not include user info for active user', async () => {
            const sessionData = JSON.parse(mockSessionsData[TEST_SESSION_IDS.ACTIVE_USER_SESSION_1].data);
            
            const req = {
                session: {
                    id: TEST_SESSION_IDS.ACTIVE_USER_SESSION_1,
                    ...sessionData
                }
            };

            const res = {
                status: jest.fn().mockReturnThis(),
                json: jest.fn().mockReturnThis()
            };

            await checkUserSession(req, res);

            const jsonCall = res.json.mock.calls[0][0].responseObject;
            expect(jsonCall.loggedIn).toBe(true);
            expect(typeof jsonCall.token).toBe('string');
            expect(jsonCall.userInfo).toBeUndefined();
        });

        it('should not include user info for admin user', async () => {
            const sessionData = JSON.parse(mockSessionsData[TEST_SESSION_IDS.ADMIN_SESSION_1].data);
            
            const req = {
                session: {
                    id: TEST_SESSION_IDS.ADMIN_SESSION_1,
                    ...sessionData
                }
            };

            const res = {
                status: jest.fn().mockReturnThis(),
                json: jest.fn().mockReturnThis()
            };

            await checkUserSession(req, res);

            const jsonCall = res.json.mock.calls[0][0].responseObject;
            expect(jsonCall.loggedIn).toBe(true);
            expect(typeof jsonCall.token).toBe('string');
            expect(jsonCall.userInfo).toBeUndefined();
        });
    });
});
