import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { updateUserFields } from './updateUserFields.js';
import { getUserCollectionDocument } from '../../getUserCollectionDocument/getUserCollectionDocument.js';
import { userTestSetup, userTestTeardown } from '../../userTestSetup.js';
import { TEST_USERS } from 'testing/mocks/expressServer/testUsers.js';

describe('updateUserFields', () => {
    beforeAll(async () => {
        await userTestSetup();
    }, 15000);

    afterAll(async () => {
        await userTestTeardown();
    }, 15000);

    // --- direct update (no fieldName) ---

    it('should update fields directly on the user document', async () => {
        const result = await updateUserFields(TEST_USERS.ACTIVE, {
            achievements: [{ id: 'ACH-TEST', description: 'Test Achievement' }],
        });
        expect(result).toEqual({ success: true, message: 'User fields updated successfully' });

        const userDoc = await getUserCollectionDocument(TEST_USERS.ACTIVE, 'users');
        expect(userDoc.achievements).toEqual([{ id: 'ACH-TEST', description: 'Test Achievement' }]);
    });

    // --- fieldName update (no merge) ---

    it('should update a specific field by name', async () => {
        const newEducation = [
            { id: 'ED-NEW', institution: 'Oxford', degree: 'PhD CS', year: '2025' },
        ];
        const result = await updateUserFields(TEST_USERS.ACTIVE, newEducation, 'educationInformation');
        expect(result).toEqual({ success: true, message: 'User fields updated successfully' });

        const userDoc = await getUserCollectionDocument(TEST_USERS.ACTIVE, 'users');
        expect(userDoc.educationInformation).toEqual(newEducation);
    });

    // --- merge with array (arrayUnion) ---

    it('should merge array fields using arrayUnion', async () => {
        const newExperience = {
            id: 'EX-MERGE',
            company: 'MergeCorp',
            roles: [{ id: 'R-MERGE', title: 'Tester', startDate: '2025-01', endDate: '' }],
        };
        const result = await updateUserFields(TEST_USERS.ADMIN, [newExperience], 'experiences', true);
        expect(result).toEqual({ success: true, message: 'User fields updated successfully' });

        const userDoc = await getUserCollectionDocument(TEST_USERS.ADMIN, 'users');
        const experienceIds = userDoc.experiences.map(e => e.id);
        expect(experienceIds).toContain('EX004'); // original
        expect(experienceIds).toContain('EX-MERGE'); // merged
    });

    // --- merge with object (spread) ---

    it('should merge object fields using spread', async () => {
        // First set a base object field
        await updateUserFields(TEST_USERS.INACTIVE, { key1: 'value1' }, 'additionalInfo');

        // Now merge additional keys
        const result = await updateUserFields(TEST_USERS.INACTIVE, { key2: 'value2' }, 'additionalInfo', true);
        expect(result).toEqual({ success: true, message: 'User fields updated successfully' });

        const userDoc = await getUserCollectionDocument(TEST_USERS.INACTIVE, 'users');
        expect(userDoc.additionalInfo).toEqual({ key1: 'value1', key2: 'value2' });
    });

    // --- validation errors ---

    it('should throw when no email is provided', async () => {
        await expect(updateUserFields(null, { test: true }))
            .rejects.toThrow('User email is required to update user document');
    });

    it('should throw when no fields are provided', async () => {
        await expect(updateUserFields(TEST_USERS.ACTIVE, null))
            .rejects.toThrow('Fields to update must be provided as an object');
    });

    it('should throw when merge is true but no fieldName is provided', async () => {
        await expect(updateUserFields(TEST_USERS.ACTIVE, { test: true }, '', true))
            .rejects.toThrow('Field name is required when merging fields in updating user document');
    });

    it('should throw 404 when user document does not exist', async () => {
        try {
            await updateUserFields(TEST_USERS.NO_SESSIONS, { test: true });
        } catch (error) {
            expect(error.message).toBe('User document does not exist to update');
            expect(error.statusCode).toBe(404);
        }
    });

    it('should throw when merge fields is not array or object', async () => {
        await expect(updateUserFields(TEST_USERS.ACTIVE, 'string-value', 'experiences', true))
            .rejects.toThrow('Fields must be an array or an object when merging fields in updating user document');
    });
});
