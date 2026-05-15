import { TEST_USERS } from './testUsers.js';

/**
 * Mock User Documents
 *
 * Collection: users
 * Document ID: userEmail
 * Schema mirrors createUser.ts: { userEmail, githubLogin, githubId, name,
 * avatarUrl, creationDate, lastLogin, userStatus, userType, encryptedToken,
 * encryptedDek, kmsKeyName, tokenScopes }.
 */
const blankToken = { encryptedToken: '', encryptedDek: '', kmsKeyName: '', tokenScopes: [] };

export const mockUserDocumentsData = {
    [TEST_USERS.ACTIVE]: {
        userEmail: TEST_USERS.ACTIVE,
        githubLogin: 'active-user',
        githubId: 1001,
        name: 'Active User',
        avatarUrl: 'https://avatars.githubusercontent.com/u/1001',
        creationDate: '2026-01-01T00:00:00.000Z',
        lastLogin: '2026-02-15T10:00:00.000Z',
        userStatus: 'active',
        userType: 'user',
        ...blankToken,
    },
    [TEST_USERS.INACTIVE]: {
        userEmail: TEST_USERS.INACTIVE,
        githubLogin: 'inactive-user',
        githubId: 1002,
        name: 'Inactive User',
        avatarUrl: 'https://avatars.githubusercontent.com/u/1002',
        creationDate: '2026-01-02T00:00:00.000Z',
        lastLogin: '2026-02-10T10:00:00.000Z',
        userStatus: 'inactive',
        userType: 'user',
        ...blankToken,
    },
    [TEST_USERS.ADMIN]: {
        userEmail: TEST_USERS.ADMIN,
        githubLogin: 'admin-user',
        githubId: 1003,
        name: 'Admin User',
        avatarUrl: 'https://avatars.githubusercontent.com/u/1003',
        creationDate: '2026-01-03T00:00:00.000Z',
        lastLogin: '2026-02-16T10:00:00.000Z',
        userStatus: 'active',
        userType: 'master-admin',
        ...blankToken,
    },
};
