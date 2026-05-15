import { describe, it, expect, beforeAll, afterAll, beforeEach } from '@jest/globals';
import { deleteUser } from './deleteUser.js';
import { getUserCollectionDocument } from '../getUserCollectionDocument/getUserCollectionDocument.js';
import { userTestSetup, userTestTeardown } from '../userTestSetup.js';
import { getFirestoreCollection } from '../../firebase_apis.js';

const TEST_DELETE_EMAIL = 'deleteuser-test@example.com';

describe('deleteUser', () => {
    beforeAll(async () => {
        await userTestSetup();
    }, 15000);

    afterAll(async () => {
        await userTestTeardown();
    }, 15000);

    beforeEach(async () => {
        // Seed documents across collections for the test user
        const usersCollection = getFirestoreCollection('users');
        const usersBasicCollection = getFirestoreCollection('userBasicInformation');
        const sensitiveCollection = getFirestoreCollection('usersSensitiveInformation');
        const resumesCollection = getFirestoreCollection('userResumes');
        const scrappedCollection = getFirestoreCollection('scrappedInformation');

        await usersCollection.doc(TEST_DELETE_EMAIL).set({ experiences: [], achievements: [] });
        await usersBasicCollection.doc(TEST_DELETE_EMAIL).set({ userEmail: TEST_DELETE_EMAIL, firstName: 'Delete' });
        await sensitiveCollection.doc(TEST_DELETE_EMAIL).set({ password: 'test-password' });
        await resumesCollection.doc(TEST_DELETE_EMAIL).set({ resumes: [] });
        await scrappedCollection.doc(TEST_DELETE_EMAIL).set({ linkedin: {} });
    });

    it('should delete user documents across all collections', async () => {
        const result = await deleteUser(TEST_DELETE_EMAIL);
        expect(result).toEqual({ success: true, message: 'User deleted successfully' });

        // Verify all documents are deleted
        const userDoc = await getUserCollectionDocument(TEST_DELETE_EMAIL, 'users');
        expect(userDoc).toBeNull();

        const basicDoc = await getUserCollectionDocument(TEST_DELETE_EMAIL, 'userBasicInformation');
        expect(basicDoc).toBeNull();

        const sensitiveDoc = await getUserCollectionDocument(TEST_DELETE_EMAIL, 'usersSensitiveInformation');
        expect(sensitiveDoc).toBeNull();

        const resumesDoc = await getUserCollectionDocument(TEST_DELETE_EMAIL, 'userResumes');
        expect(resumesDoc).toBeNull();

        const scrappedDoc = await getUserCollectionDocument(TEST_DELETE_EMAIL, 'scrappedInformation');
        expect(scrappedDoc).toBeNull();
    });

    it('should update waiting list status to deleted if user is on waiting list', async () => {
        const waitingListCollection = getFirestoreCollection('waitingList');
        await waitingListCollection.doc(TEST_DELETE_EMAIL).set({ email: TEST_DELETE_EMAIL, dateAdded: new Date() });

        await deleteUser(TEST_DELETE_EMAIL);

        const waitingDoc = await waitingListCollection.doc(TEST_DELETE_EMAIL).get();
        expect(waitingDoc.exists).toBe(true);
        expect(waitingDoc.data().userStatus).toBe('deleted');

        // Clean up
        await waitingListCollection.doc(TEST_DELETE_EMAIL).delete();
    });

    it('should handle deleting a user that has no documents without throwing', async () => {
        const emptyEmail = 'nodelete-nodata@example.com';
        // Seed minimal data so the function runs through
        const usersBasicCollection = getFirestoreCollection('userBasicInformation');
        await usersBasicCollection.doc(emptyEmail).set({ userEmail: emptyEmail });

        const result = await deleteUser(emptyEmail);
        expect(result).toEqual({ success: true, message: 'User deleted successfully' });

        // Clean up
        await usersBasicCollection.doc(emptyEmail).delete();
    });

    it('should throw when no email is provided', async () => {
        await expect(deleteUser(null))
            .rejects.toThrow('User email is required to delete a user');
    });

    it('should throw with statusCode 400 for validation errors', async () => {
        try {
            await deleteUser('');
        } catch (error) {
            expect(error.statusCode).toBe(400);
        }
    });
});
