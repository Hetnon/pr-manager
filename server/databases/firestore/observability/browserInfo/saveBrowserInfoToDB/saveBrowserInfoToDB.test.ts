import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { saveBrowserInfoToDB } from './saveBrowserInfoToDB.js';
import { firestoreSetupForTests, firestoreTeardownForTests } from '../../../firestoreTestSetup.js';
import { getFirestoreCollection } from '../../../firebaseApis.js';
import { TEST_USERS } from 'testing/mocks/expressServer/testUsers.js';

describe('saveBrowserInfoToDB', () => {
    beforeAll(async () => {
        await firestoreSetupForTests();
    });

    afterAll(async () => {
        await firestoreTeardownForTests();
    });

    // 1 - Saves the full payload (as built by logBrowserInfo) to the browserInfo collection
    it('should save the full browser info payload to the collection', async () => {
        const payload = {
            testMarker: true,
            userEmail: TEST_USERS.ACTIVE,
            browserInfo: {
                name: 'Safari',
                version: '17.0',
                engine: 'WebKit',
                fullVersion: '17.0',
            },
            extensionConnected: false,
            device: {
                name: 'iPhone',
                type: 'mobile',
                screen: { width: 390, height: 844, pixelRatio: 3, colorDepth: 24 },
                hardware: { cpuCores: 6, memoryGB: 'Unknown', touchPoints: 5 },
                isTouchScreen: true,
                isOnline: true,
                platform: 'iOS',
            },
            IP: '10.0.0.5',
        };

        await saveBrowserInfoToDB(payload);

        const snapshot = await getFirestoreCollection('browserInfo')
            .where('testMarker', '==', true)
            .where('browserInfo.engine', '==', 'WebKit')
            .get();

        expect(snapshot.empty).toBe(false);
        const doc = snapshot.docs[0].data();
        expect(doc.userEmail).toBe(TEST_USERS.ACTIVE);
        expect(doc.browserInfo.name).toBe('Safari');
        expect(doc.browserInfo.version).toBe('17.0');
        expect(doc.extensionConnected).toBe(false);
        expect(doc.device.type).toBe('mobile');
        expect(doc.device.screen.width).toBe(390);
        expect(doc.IP).toBe('10.0.0.5');
    });

    // 2 - Adds a server-side timestamp field
    it('should add a server-side timestamp to the saved document', async () => {
        const payload = {
            testMarker: true,
            userEmail: TEST_USERS.ACTIVE,
            browserInfo: { name: 'Edge', version: '120.0', engine: 'Chromium', fullVersion: '120.0' },
            extensionConnected: true,
            device: { name: 'desktop', type: 'desktop' },
            IP: '::1',
        };

        await saveBrowserInfoToDB(payload);

        const snapshot = await getFirestoreCollection('browserInfo')
            .where('testMarker', '==', true)
            .where('browserInfo.name', '==', 'Edge')
            .get();

        expect(snapshot.empty).toBe(false);
        const doc = snapshot.docs[0].data();
        expect(doc.timestamp).toBeDefined();
        expect(doc.timestamp).not.toBeNull();
    });

    // 3 - Each call creates a new document (uses .add(), not .set())
    it('should create a new document on each call', async () => {
        const payload = {
            testMarker: true,
            userEmail: TEST_USERS.ADMIN,
            browserInfo: { name: 'Chrome/Brave', version: '121.0', engine: 'Chromium', fullVersion: '121.0' },
            extensionConnected: true,
            device: { name: 'desktop', type: 'desktop' },
            IP: '192.168.1.1',
        };

        await saveBrowserInfoToDB(payload);
        await saveBrowserInfoToDB(payload);

        const snapshot = await getFirestoreCollection('browserInfo')
            .where('testMarker', '==', true)
            .where('userEmail', '==', TEST_USERS.ADMIN)
            .where('browserInfo.version', '==', '121.0')
            .get();

        expect(snapshot.size).toBeGreaterThanOrEqual(2);
    });

    // 4 - Unknown-user is saved when no session exists
    it('should save payload with unknown-user email', async () => {
        const payload = {
            testMarker: true,
            userEmail: 'unknown-user',
            browserInfo: { name: 'Unknown', version: 'Unknown', engine: 'Unknown', fullVersion: 'Unknown' },
            extensionConnected: false,
            device: { name: 'desktop', type: 'desktop' },
            IP: '0.0.0.0',
        };

        await expect(saveBrowserInfoToDB(payload)).resolves.not.toThrow();

        const snapshot = await getFirestoreCollection('browserInfo')
            .where('testMarker', '==', true)
            .where('userEmail', '==', 'unknown-user')
            .get();

        expect(snapshot.empty).toBe(false);
    });
});
