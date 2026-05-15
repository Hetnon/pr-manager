import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { createUserDB } from './createUser.js';
import { getUserCollectionDocument } from '../getUserCollectionDocument/getUserCollectionDocument.js';
import { userTestSetup, userTestTeardown } from '../userTestSetup.js';
import { getFirestoreCollection } from '../../firebase_apis.js';

const TEST_CREATE_EMAIL = 'createuser-test@example.com';

describe('createUserDB', () => {
    beforeAll(async () => {
        await userTestSetup();
    }, 15000);

    afterAll(async () => {
        // Clean up created test documents
        const usersCollection = getFirestoreCollection('users');
        const usersBasicCollection = getFirestoreCollection('userBasicInformation');
        await usersCollection.doc(TEST_CREATE_EMAIL).delete();
        await usersBasicCollection.doc(TEST_CREATE_EMAIL).delete();
        await userTestTeardown();
    }, 15000);

    it('should create both users and userBasicInformation documents', async () => {
        const userData = {
            userEmail: TEST_CREATE_EMAIL,
            firstName: 'Test',
            lastName: 'Create',
            userStatus: 'active',
            userType: 'user',
        };

        const result = await createUserDB(userData);
        expect(result).toEqual({ success: true, message: 'User created successfully' });

        // Verify users document was created with empty arrays
        const userDoc = await getUserCollectionDocument(TEST_CREATE_EMAIL, 'users');
        expect(userDoc).toBeDefined();
        expect(userDoc.achievements).toEqual([]);
        expect(userDoc.additionalInfo).toEqual([]);
        expect(userDoc.educationInformation).toEqual([]);
        expect(userDoc.experiences).toEqual([]);
        expect(userDoc.professionalDevelopmentInformation).toEqual([]);
        expect(userDoc.referencesInformation).toEqual([]);

        // Verify userBasicInformation document was created with provided data
        const basicInfoDoc = await getUserCollectionDocument(TEST_CREATE_EMAIL, 'userBasicInformation');
        expect(basicInfoDoc).toBeDefined();
        expect(basicInfoDoc.userEmail).toBe(TEST_CREATE_EMAIL);
        expect(basicInfoDoc.firstName).toBe('Test');
        expect(basicInfoDoc.userStatus).toBe('active');
    });

    it('should throw when no userData is provided', async () => {
        await expect(createUserDB(null))
            .rejects.toThrow('User data with user Email is required to create a user');
    });

    it('should throw when userData has no userEmail', async () => {
        await expect(createUserDB({ firstName: 'No Email' }))
            .rejects.toThrow('User data with user Email is required to create a user');
    });

    it('should throw with statusCode 400 for validation errors', async () => {
        try {
            await createUserDB(null);
        } catch (error) {
            expect(error.statusCode).toBe(400);
        }
    });
});
