import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { getUserCollectionDocument } from './getUserCollectionDocument.js';
import { userTestSetup, userTestTeardown } from '../userTestSetup.js';
import { TEST_USERS } from 'testing/mocks/expressServer/testUsers.js';

describe('getUserCollectionDocument', () => {
    beforeAll(async () => {
        await userTestSetup();
    }, 15000);

    afterAll(async () => {
        await userTestTeardown();
    }, 15000);

    // --- users collection ---

    it('should return user document data for an existing user', async () => {
        const result = await getUserCollectionDocument(TEST_USERS.ACTIVE, 'users');
        expect(result).toBeDefined();
        expect(result).not.toBeNull();
        expect(result.experiences).toBeDefined();
        expect(Array.isArray(result.experiences)).toBe(true);
    });

    it('should return null for a non-existent user in the users collection', async () => {
        const result = await getUserCollectionDocument(TEST_USERS.NO_SESSIONS, 'users');
        expect(result).toBeNull();
    });

    // --- userBasicInformation collection ---

    it('should return basic info for an existing user', async () => {
        const result = await getUserCollectionDocument(TEST_USERS.ACTIVE, 'userBasicInformation');
        expect(result).toBeDefined();
        expect(result).not.toBeNull();
        expect(result.userEmail).toBe(TEST_USERS.ACTIVE);
        expect(result.firstName).toBeDefined();
        expect(result.userStatus).toBeDefined();
    });

    it('should return null for a non-existent user in userBasicInformation', async () => {
        const result = await getUserCollectionDocument(TEST_USERS.NO_SESSIONS, 'userBasicInformation');
        expect(result).toBeNull();
    });

    // --- usersSensitiveInformation collection ---

    it('should return sensitive info for an existing user (not throw)', async () => {
        const result = await getUserCollectionDocument(TEST_USERS.ACTIVE, 'usersSensitiveInformation');
        expect(result).toBeDefined();
        expect(result).not.toBeNull();
        expect(result.password).toBeDefined();
    });

    it('should return null for a non-existent user in usersSensitiveInformation', async () => {
        const result = await getUserCollectionDocument(TEST_USERS.NO_SESSIONS, 'usersSensitiveInformation');
        expect(result).toBeNull();
    });

    // --- userResumes collection ---

    it('should return resumes data for an existing user', async () => {
        const result = await getUserCollectionDocument(TEST_USERS.ACTIVE, 'userResumes');
        expect(result).toBeDefined();
        expect(result.resumes).toBeDefined();
        expect(result.resumes.length).toBeGreaterThan(0);
    });

    it('should return null for a user with no resumes document', async () => {
        const result = await getUserCollectionDocument(TEST_USERS.INACTIVE, 'userResumes');
        expect(result).toBeNull();
    });

    // --- validation ---

    it('should throw when no email is provided', async () => {
        await expect(getUserCollectionDocument(null, 'users'))
            .rejects.toThrow('User email and collection name are required to get user data');
    });

    it('should throw when empty string email is provided', async () => {
        await expect(getUserCollectionDocument('', 'users'))
            .rejects.toThrow('User email and collection name are required to get user data');
    });
});
