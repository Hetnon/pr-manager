import { TEST_SESSION_IDS } from './sessionsMapFixtures.js';
import { TEST_USERS } from './testUsers.js';

/**
 * Mock Sessions Collection Data
 * 
 * Structure matches Firestore sessions collection:
 * - Document ID: sessionId
 * - Field: data (JSON string containing session data)
 */
export const mockSessionsData = {
    // active@example.com sessions
    [TEST_SESSION_IDS.ACTIVE_USER_SESSION_1]: {
        data: JSON.stringify({
            cookie: {
                originalMaxAge: 2592000000,
                expires: '2026-03-18T10:00:00.000Z',
                secure: true,
                httpOnly: true,
                domain: 'localhost',
                path: '/',
                sameSite: 'strict'
            },
            userEmail: TEST_USERS.ACTIVE,
            userType: 'user',
            userStatus: 'active',
            csrfToken: 'csrf-token-123'
        })
    },

    [TEST_SESSION_IDS.ACTIVE_USER_SESSION_2]: {
        data: JSON.stringify({
            cookie: {
                originalMaxAge: 2592000000,
                expires: '2026-03-18T11:00:00.000Z',
                secure: true,
                httpOnly: true,
                domain: 'localhost',
                path: '/',
                sameSite: 'strict'
            },
            userEmail: TEST_USERS.ACTIVE,
            userType: 'user',
            userStatus: 'active',
            csrfToken: 'csrf-token-456'
        })
    },

    // inactive@example.com session
    [TEST_SESSION_IDS.INACTIVE_USER_SESSION]: {
        data: JSON.stringify({
            cookie: {
                originalMaxAge: 2592000000,
                expires: '2026-03-17T09:00:00.000Z',
                secure: true,
                httpOnly: true,
                domain: 'localhost',
                path: '/',
                sameSite: 'strict'
            },
            userEmail: TEST_USERS.INACTIVE,
            userType: 'user',
            userStatus: 'inactive',
            csrfToken: 'csrf-token-abc'
        })
    },

    // admin@example.com sessions
    [TEST_SESSION_IDS.ADMIN_SESSION_1]: {
        data: JSON.stringify({
            cookie: {
                originalMaxAge: 2592000000,
                expires: '2026-03-16T08:00:00.000Z',
                secure: true,
                httpOnly: true,
                domain: 'localhost',
                path: '/',
                sameSite: 'strict'
            },
            userEmail: TEST_USERS.ADMIN,
            userType: 'master-admin',
            userStatus: 'active',
            csrfToken: 'csrf-token-001'
        })
    },

    [TEST_SESSION_IDS.ADMIN_SESSION_2]: {
        data: JSON.stringify({
            cookie: {
                originalMaxAge: 2592000000,
                expires: '2026-03-17T09:00:00.000Z',
                secure: true,
                httpOnly: true,
                domain: 'localhost',
                path: '/',
                sameSite: 'strict'
            },
            userEmail: TEST_USERS.ADMIN,
            userType: 'master-admin',
            userStatus: 'active',
            csrfToken: 'csrf-token-002'
        })
    },

    [TEST_SESSION_IDS.ADMIN_SESSION_3]: {
        data: JSON.stringify({
            cookie: {
                originalMaxAge: 2592000000,
                expires: '2026-03-18T10:00:00.000Z',
                secure: true,
                httpOnly: true,
                domain: 'localhost',
                path: '/',
                sameSite: 'strict'
            },
            userEmail: TEST_USERS.ADMIN,
            userType: 'master-admin',
            userStatus: 'active',
            csrfToken: 'csrf-token-003'
        })
    }
};
