import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { getErrorListFromDB } from './getErrorListFromDB.js';
import { firestoreSetupForTests, firestoreTeardownForTests } from '../../../firestoreTestSetup.js';
import { TEST_USERS } from 'testing/mocks/expressServer/testUsers.js';
import { TEST_BATCH_SEARCH_ID, TEST_APPLICATION_ID, TEST_JOB_LISTING_ID } from 'testing/mocks/expressServer/errorLogsFixtures.js';

describe('getErrorListFromDB', () => {
    beforeAll(async () => {
        await firestoreSetupForTests();
    });

    afterAll(async () => {
        await firestoreTeardownForTests();
    });

    // 1 - Filter by userEmail returns only that user's errors
    it('should return only errors for the given userEmail', async () => {
        const result = await getErrorListFromDB({ userEmail: TEST_USERS.ACTIVE });
        expect(result.length).toBeGreaterThan(0);
        result.forEach(error => {
            expect(error.userEmail).toBe(TEST_USERS.ACTIVE);
        });
    });

    // 2 - Filter by userEmail for a different user
    it('should return errors for INACTIVE user', async () => {
        const result = await getErrorListFromDB({ userEmail: TEST_USERS.INACTIVE });
        expect(result.length).toBeGreaterThan(0);
        result.forEach(error => {
            expect(error.userEmail).toBe(TEST_USERS.INACTIVE);
        });
    });

    // 3 - Filter by status 'new' returns only new errors
    it('should return only errors with status "new" when filtered by statuses', async () => {
        const result = await getErrorListFromDB({ statuses: ['new'] });
        expect(result.length).toBeGreaterThan(0);
        result.forEach(error => {
            expect(error.status).toBe('new');
        });
    });

    // 4 - Filter by multiple statuses
    it('should return errors matching any of the provided statuses', async () => {
        const result = await getErrorListFromDB({ statuses: ['new', 'in-progress'] });
        expect(result.length).toBeGreaterThan(0);
        result.forEach(error => {
            expect(['new', 'in-progress']).toContain(error.status);
        });
    });

    // 5 - Filter by batchSearchId returns matching errors
    it('should return only errors for the given batchSearchId', async () => {
        const result = await getErrorListFromDB({ batchSearchId: TEST_BATCH_SEARCH_ID });
        expect(result.length).toBeGreaterThan(0);
        result.forEach(error => {
            expect(error.batchSearchId).toBe(TEST_BATCH_SEARCH_ID);
        });
    });

    // 6 - Filter by applicationId returns matching errors
    it('should return only errors for the given applicationId', async () => {
        const result = await getErrorListFromDB({ applicationId: TEST_APPLICATION_ID });
        expect(result.length).toBeGreaterThan(0);
        result.forEach(error => {
            expect(error.applicationId).toBe(TEST_APPLICATION_ID);
        });
    });

    // 7 - Filter by jobListingId returns matching errors
    it('should return only errors for the given jobListingId', async () => {
        const result = await getErrorListFromDB({ jobListingId: TEST_JOB_LISTING_ID });
        expect(result.length).toBeGreaterThan(0);
        result.forEach(error => {
            expect(error.jobListingId).toBe(TEST_JOB_LISTING_ID);
        });
    });

    // 8 - Results are ordered by createdAt descending
    it('should return results ordered by createdAt descending', async () => {
        const result = await getErrorListFromDB({ userEmail: TEST_USERS.ACTIVE });
        expect(result.length).toBeGreaterThan(1);
        for (let i = 0; i < result.length - 1; i++) {
            const current = new Date(result[i].createdAt);
            const next = new Date(result[i + 1].createdAt);
            expect(current >= next).toBe(true);
        }
    });

    // 9 - Each result includes an id field from the document
    it('should include the document id in each result', async () => {
        const result = await getErrorListFromDB({ userEmail: TEST_USERS.ACTIVE });
        expect(result.length).toBeGreaterThan(0);
        result.forEach(error => {
            expect(error.id).toBeDefined();
            expect(typeof error.id).toBe('string');
        });
    });

    // 10 - createdAt is converted (returned as ISO string or passthrough)
    it('should return createdAt as a string', async () => {
        const result = await getErrorListFromDB({ userEmail: TEST_USERS.ACTIVE });
        expect(result.length).toBeGreaterThan(0);
        result.forEach(error => {
            expect(typeof error.createdAt).toBe('string');
            expect(() => new Date(error.createdAt)).not.toThrow();
        });
    });

    // 11 - Pagination: errorsPerPage limits the number of results
    it('should respect errorsPerPage limit', async () => {
        const result = await getErrorListFromDB({ errorsPerPage: 2 });
        expect(result.length).toBeLessThanOrEqual(2);
    });

    // 12 - Pagination: pageNumber 2 returns different results than page 1
    it('should return different results for different page numbers', async () => {
        const page1 = await getErrorListFromDB({ errorsPerPage: 2, pageNumber: 1 });
        const page2 = await getErrorListFromDB({ errorsPerPage: 2, pageNumber: 2 });

        if (page1.length === 2 && page2.length > 0) {
            const page1Ids = page1.map(e => e.id);
            const page2Ids = page2.map(e => e.id);
            page2Ids.forEach(id => {
                expect(page1Ids).not.toContain(id);
            });
        }
    });

    // 13 - Returns empty array when no errors match the filters
    it('should return an empty array when no errors match the filters', async () => {
        const result = await getErrorListFromDB({ userEmail: TEST_USERS.NO_SESSIONS });
        expect(result).toEqual([]);
    });

    // 14 - Combined filters: userEmail + status
    it('should apply combined filters (userEmail + statuses)', async () => {
        const result = await getErrorListFromDB({
            userEmail: TEST_USERS.ACTIVE,
            statuses: ['new'],
        });
        expect(result.length).toBeGreaterThan(0);
        result.forEach(error => {
            expect(error.userEmail).toBe(TEST_USERS.ACTIVE);
            expect(error.status).toBe('new');
        });
    });
});
