import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { FirestoreStore } from '@google-cloud/connect-firestore';
import { firestoreSetupForTests, firestoreTeardownForTests } from '../../firestoreTestSetup.js';

describe('Session Store Tests', () => {
    let store;
    beforeAll(async () => {
        await firestoreSetupForTests();
        const { getSessionStore} = await import('./sessionStore.js');
        store = await getSessionStore();
    });

    afterAll(async () => {
        await firestoreTeardownForTests();
    });

    describe('Store Initialization', () => {
        it('should create a store instance', () => {
            expect(store).toBeDefined();
            expect(store).not.toBeNull();
        });

        it('should be an instance of FirestoreStore', () => {
            expect(store).toBeInstanceOf(FirestoreStore);
        });

        it('should have the correct collection kind', () => {
            // The kind property determines the collection name in Firestore
            expect(store.kind).toBe('sessions');
        });

        it('should use the same database instance as Firebase', async () => {
            const { getFirebaseDB } = await import('../../firebaseApis.js');
            const db = getFirebaseDB();
            expect(store.db).toBe(db);
        });

        it('should have required store methods', () => {
            // Express session store interface requires these methods
            expect(typeof store.get).toBe('function');
            expect(typeof store.set).toBe('function');
            expect(typeof store.destroy).toBe('function');
        });
    });

    describe('Store Configuration', () => {
        it('should have database configured', () => {
            expect(store.db).toBeDefined();
            expect(store.db).not.toBeNull();
        });

        it('should reference the sessions collection', () => {
            // Verify the collection reference exists
            const sessionsCollection = store.db.collection('sessions');
            expect(sessionsCollection).toBeDefined();
            expect(sessionsCollection.id).toBe('sessions');
        });

        it('should have correct kind matching collection name', () => {
            expect(store.kind).toBe('sessions');
        });
    });
});
