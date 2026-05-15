import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { updateUserSessions } from './updateUserSessions.js';
import { firestoreSetupForTests, firestoreTeardownForTests } from '../../../firestoreTestSetup.js';
import { TEST_USERS } from 'testing/mocks/expressServer/testUsers.js';
import { TEST_SESSION_IDS } from 'testing/mocks/expressServer/sessionsMapFixtures.js';
import { getFirestoreCollection } from '../../../firebase_apis.js';

const getSessionData = async (sessionId) => {
    const doc = await getFirestoreCollection('sessions').doc(sessionId).get();
    if (!doc.exists) return null;
    return JSON.parse(doc.data().data || '{}');
};

describe('updateUserSessions', () => {
    beforeAll(async () => {
        await firestoreSetupForTests();
    });

    afterAll(async () => {
        await firestoreTeardownForTests();
    });

    // 1 - Active user has 2 sessions, both should be updated
    it('should update all sessions for a user with multiple sessions', async () => {
        await updateUserSessions(TEST_USERS.ACTIVE, { userStatus: 'suspended' });

        const session1 = await getSessionData(TEST_SESSION_IDS.ACTIVE_USER_SESSION_1);
        const session2 = await getSessionData(TEST_SESSION_IDS.ACTIVE_USER_SESSION_2);

        expect(session1.userStatus).toBe('suspended');
        expect(session2.userStatus).toBe('suspended');
    });

    // 2 - Update preserves existing fields not in infoToUpdate
    it('should preserve existing session fields not included in infoToUpdate', async () => {
        await updateUserSessions(TEST_USERS.ACTIVE, { userStatus: 'active' });

        const session1 = await getSessionData(TEST_SESSION_IDS.ACTIVE_USER_SESSION_1);

        expect(session1.userEmail).toBe(TEST_USERS.ACTIVE);
        expect(session1.csrfToken).toBe('csrf-token-123');
        expect(session1.cookie).toBeDefined();
        expect(session1.userStatus).toBe('active');
    });

    // 3 - Admin user has 3 sessions, all should be updated
    it('should update all sessions for admin user with 3 sessions', async () => {
        await updateUserSessions(TEST_USERS.ADMIN, { userType: 'admin' });

        const session1 = await getSessionData(TEST_SESSION_IDS.ADMIN_SESSION_1);
        const session2 = await getSessionData(TEST_SESSION_IDS.ADMIN_SESSION_2);
        const session3 = await getSessionData(TEST_SESSION_IDS.ADMIN_SESSION_3);

        expect(session1.userType).toBe('admin');
        expect(session2.userType).toBe('admin');
        expect(session3.userType).toBe('admin');
    });

    // 4 - Inactive user has 1 session, should be updated
    it('should update the single session for inactive user', async () => {
        await updateUserSessions(TEST_USERS.INACTIVE, { userStatus: 'active' });

        const session = await getSessionData(TEST_SESSION_IDS.INACTIVE_USER_SESSION);
        expect(session.userStatus).toBe('active');
    });

    // 5 - User with no sessions map document returns early without error
    it('should return without error for a user with no sessions map document', async () => {
        await expect(
            updateUserSessions('nonexistent@example.com', { userStatus: 'suspended' })
        ).resolves.not.toThrow();
    });

    // 6 - User with empty sessions map returns early without error
    it('should return without error for a user with an empty sessions map', async () => {
        await expect(
            updateUserSessions(TEST_USERS.NO_SESSIONS, { userStatus: 'suspended' })
        ).resolves.not.toThrow();
    });

    // 7 - Multiple fields updated at once
    it('should update multiple fields in a single call', async () => {
        await updateUserSessions(TEST_USERS.INACTIVE, {
            userStatus: 'suspended',
            userType: 'restricted'
        });

        const session = await getSessionData(TEST_SESSION_IDS.INACTIVE_USER_SESSION);
        expect(session.userStatus).toBe('suspended');
        expect(session.userType).toBe('restricted');
        expect(session.userEmail).toBe(TEST_USERS.INACTIVE); // preserved
    });

    // 8 - No email provided throws error
    it('should throw when no email is provided', async () => {
        await expect(updateUserSessions(null, { userStatus: 'suspended' }))
            .rejects.toThrow('User email and infoToUpdate object are required');
    });

    // 9 - No infoToUpdate provided throws error
    it('should throw when infoToUpdate is not provided', async () => {
        await expect(updateUserSessions(TEST_USERS.ACTIVE, null))
            .rejects.toThrow('User email and infoToUpdate object are required');
    });

    // 10 - infoToUpdate is not an object throws error
    it('should throw when infoToUpdate is not an object', async () => {
        await expect(updateUserSessions(TEST_USERS.ACTIVE, 'suspended'))
            .rejects.toThrow('User email and infoToUpdate object are required');
    });

    // 11 - New field added that didn't exist before
    it('should add a new field to session data that did not exist before', async () => {
        await updateUserSessions(TEST_USERS.ACTIVE, { newCustomField: 'customValue' });

        const session1 = await getSessionData(TEST_SESSION_IDS.ACTIVE_USER_SESSION_1);
        const session2 = await getSessionData(TEST_SESSION_IDS.ACTIVE_USER_SESSION_2);

        expect(session1.newCustomField).toBe('customValue');
        expect(session2.newCustomField).toBe('customValue');
    });

    // 12 - Other users' sessions are not affected
    it('should not modify sessions belonging to other users', async () => {
        const inactiveBefore = await getSessionData(TEST_SESSION_IDS.INACTIVE_USER_SESSION);

        await updateUserSessions(TEST_USERS.ACTIVE, { userStatus: 'suspended' });

        const inactiveAfter = await getSessionData(TEST_SESSION_IDS.INACTIVE_USER_SESSION);
        expect(inactiveAfter.userStatus).toBe(inactiveBefore.userStatus);
    });
});
