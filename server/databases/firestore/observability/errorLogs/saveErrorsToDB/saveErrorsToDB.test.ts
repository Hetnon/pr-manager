import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { saveErrorsToDB } from './saveErrorsToDB.js';
import { firestoreSetupForTests, firestoreTeardownForTests } from '../../../firestoreTestSetup.js';
import { getFirestoreCollection } from '../../../firebase_apis.js';
import { TEST_USERS } from 'testing/mocks/expressServer/testUsers.js';

describe('saveErrorsToDB', () => {
    beforeAll(async () => {
        await firestoreSetupForTests();
    });

    afterAll(async () => {
        await firestoreTeardownForTests();
    });

    // 1 - Saves a server error handler payload
    it('should save a server error handler payload to the errorLogs collection', async () => {
        const payload = {
            userEmail: TEST_USERS.ACTIVE,
            error: {
                message: 'Test server error',
                statusCode: 500,
            },
            body: { someField: 'someValue' },
            query: {},
            params: {},
            IP: '127.0.0.1',
            url: '/api/test-endpoint',
            method: 'POST',
            origin: 'server-error-handler',
        };

        await saveErrorsToDB(payload);

        const snapshot = await getFirestoreCollection('errorLogs')
            .where('userEmail', '==', TEST_USERS.ACTIVE)
            .where('origin', '==', 'server-error-handler')
            .where('url', '==', '/api/test-endpoint')
            .get();

        expect(snapshot.empty).toBe(false);
        const doc = snapshot.docs[0].data();
        expect(doc.error.message).toBe('Test server error');
        expect(doc.error.statusCode).toBe(500);
        expect(doc.body.someField).toBe('someValue');
        expect(doc.method).toBe('POST');
        expect(doc.IP).toBe('127.0.0.1');
    });

    // 2 - Saves a client-reported extension error payload
    it('should save a client-reported extension error payload', async () => {
        const payload = {
            userEmail: TEST_USERS.INACTIVE,
            IP: '192.168.1.5',
            url: '/api/log-error',
            method: 'POST',
            error: {
                message: 'Extension call failed',
                stack: 'Error: Extension call failed\n    at extensionCall',
                name: 'Error',
                statusCode: null,
                nodes: null,
                nonThrowing: null,
            },
            origin: 'extensionCall',
            task: 'apply-for-job',
            website: 'linkedin',
            device: { name: 'desktop', type: 'desktop' },
            browserInfo: { name: 'Chrome/Brave', version: '120.0', engine: 'Chromium', fullVersion: '120.0' },
        };

        await saveErrorsToDB(payload);

        const snapshot = await getFirestoreCollection('errorLogs')
            .where('userEmail', '==', TEST_USERS.INACTIVE)
            .where('origin', '==', 'extensionCall')
            .get();

        expect(snapshot.empty).toBe(false);
        const doc = snapshot.docs[0].data();
        expect(doc.error.message).toBe('Extension call failed');
        expect(doc.task).toBe('apply-for-job');
        expect(doc.website).toBe('linkedin');
        expect(doc.device.type).toBe('desktop');
    });

    // 3 - Always sets status to 'new' regardless of payload
    it('should always set status to "new" even if payload contains a different status', async () => {
        const payload = {
            userEmail: TEST_USERS.ACTIVE,
            error: { message: 'Status override test' },
            IP: '127.0.0.1',
            url: '/api/log-error',
            method: 'POST',
            origin: 'extensionCall',
            status: 'resolved', // should be overwritten
        };

        await saveErrorsToDB(payload);

        const snapshot = await getFirestoreCollection('errorLogs')
            .where('userEmail', '==', TEST_USERS.ACTIVE)
            .where('error.message', '==', 'Status override test')
            .get();

        expect(snapshot.empty).toBe(false);
        const doc = snapshot.docs[0].data();
        expect(doc.status).toBe('new');
    });

    // 4 - Adds a server-side createdAt timestamp
    it('should add a server-side createdAt timestamp', async () => {
        const payload = {
            userEmail: TEST_USERS.ADMIN,
            error: { message: 'Timestamp test' },
            IP: '10.0.0.1',
            url: '/api/log-error',
            method: 'POST',
            origin: 'extensionCall',
        };

        await saveErrorsToDB(payload);

        const snapshot = await getFirestoreCollection('errorLogs')
            .where('userEmail', '==', TEST_USERS.ADMIN)
            .where('error.message', '==', 'Timestamp test')
            .get();

        expect(snapshot.empty).toBe(false);
        const doc = snapshot.docs[0].data();
        expect(doc.createdAt).toBeDefined();
        expect(doc.createdAt).not.toBeNull();
    });

    // 5 - Does not throw when the DB write fails (swallows the error via try/catch)
    it('should not throw when the DB write fails', async () => {
        await expect(saveErrorsToDB({})).resolves.not.toThrow();
    });
});
