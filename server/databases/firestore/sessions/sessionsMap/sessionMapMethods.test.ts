import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { removeSessionFromMap, includeSessionInMap, getUserSessionsMap } from './sessionMapMethods.js';
import { TEST_SESSION_IDS } from 'testing/mocks/expressServer/sessionsMapFixtures.js';
import { TEST_USERS } from 'testing/mocks/expressServer/testUsers.js';
import { firestoreSetupForTests, firestoreTeardownForTests } from '../../firestoreTestSetup.js';
import { Timestamp } from '../../firebaseApis.js';

describe('Session Map Integration Tests', () => {
    beforeAll(async () => {
        await firestoreSetupForTests();
    });

    afterAll(async () => {
        await firestoreTeardownForTests();
    });

    describe('removeSessionFromMap (integration tests)', () => {
        it('should remove session from active user', async () => {
            await removeSessionFromMap(TEST_USERS.ACTIVE, TEST_SESSION_IDS.ACTIVE_USER_SESSION_1);
            const data = await getUserSessionsMap(TEST_USERS.ACTIVE);
            
            expect(data[TEST_SESSION_IDS.ACTIVE_USER_SESSION_1]).toBeUndefined();
            expect(data[TEST_SESSION_IDS.ACTIVE_USER_SESSION_2]).toBeDefined();
        });

        it('should remove session from admin user', async () => {
            await removeSessionFromMap(TEST_USERS.ADMIN, TEST_SESSION_IDS.ADMIN_SESSION_1);
            const data = await getUserSessionsMap(TEST_USERS.ADMIN);
            
            expect(data[TEST_SESSION_IDS.ADMIN_SESSION_1]).toBeUndefined();
            expect(data[TEST_SESSION_IDS.ADMIN_SESSION_2]).toBeDefined();
            expect(data[TEST_SESSION_IDS.ADMIN_SESSION_3]).toBeDefined();
        });

        it('should handle removing non-existent session gracefully', async () => {
            // Should not throw
            await expect(
                removeSessionFromMap(TEST_USERS.ACTIVE, TEST_SESSION_IDS.NON_EXISTENT)
            ).resolves.not.toThrow();
        });
    });


    describe('includeSessionInMap (integration tests)', () => {
        const testUser = 'test-include@example.com';
        const testSessionId = 'test-session-999';

        afterAll(async () => {
            await removeSessionFromMap(testUser, testSessionId);
        });

        it('should add session to user document', async () => {
            await includeSessionInMap(testUser, testSessionId);
            const data = await getUserSessionsMap(testUser);
            
            expect(data[testSessionId]).toBeDefined();
            expect(data[testSessionId]).toBeInstanceOf(Timestamp);
        });

        it('should merge with existing sessions', async () => {
            const newSessionId = 'test-session-888';
            
            await includeSessionInMap(testUser, newSessionId);
            const data = await getUserSessionsMap(testUser);
            expect(data[testSessionId]).toBeDefined(); // Old session still there
            expect(data[newSessionId]).toBeDefined(); // New session added
            
            // Cleanup
            await removeSessionFromMap(testUser, newSessionId);
        });
    });

    describe('getUserSessionsMap', () => {
        const testUser = 'test-read@example.com';
        const testSessionId = 'test-read-session-123';

        beforeAll(async () => {
            await includeSessionInMap(testUser, testSessionId);
        });

        afterAll(async () => {
            await removeSessionFromMap(testUser, testSessionId);
        });

        it('should return sessions map for existing user', async () => {
            const data = await getUserSessionsMap(testUser);
            expect(data).not.toBeNull();
            expect(data[testSessionId]).toBeDefined();
            expect(data[testSessionId]).toBeInstanceOf(Timestamp);
        });

        it('should return null for non-existent user', async () => {
            const data = await getUserSessionsMap('nonexistent@example.com');
            expect(data).toBeNull();
        });

        it('should return all sessions for admin user', async () => {
            const data = await getUserSessionsMap(TEST_USERS.ADMIN);
            expect(data).not.toBeNull();
            expect(Object.keys(data).length).toBeGreaterThan(0);
        });
    });
});


