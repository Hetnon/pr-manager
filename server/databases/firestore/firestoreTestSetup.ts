import admin from 'firebase-admin';
import { initializeAllFirebase, allCollections, _resetFirestoreDB } from './firebase_apis.js';
import { clearTimedSaves } from './setupAndRun/runFirebase.js';
import { initializeSessionsDataForTests, cleanupSessionsDataForTests, _resetSessionStore } from './sessions/sessionMethods.js';
import { initializeObservabilityDataForTests, cleanupObservabilityDataForTests } from './observability/observabilityMethods.js';
import { initializeUserDataForTests, cleanupUserDataForTests } from './users/userMethods.js';

let isFirebaseInitializedForTests = false;

export async function firestoreSetupForTests(): Promise<void> {
    if (isFirebaseInitializedForTests) {
        console.warn('Firebase already initialized for tests. Skipping re-initialization.');
        return;
    }
    process.env.NODE_ENV = 'development';
    process.env.GOOGLE_CLOUD_PROJECT = 'demo-project';
    process.env.FIRESTORE_EMULATOR_HOST = 'localhost:8080';
    process.env.COOKIE_DOMAIN = 'localhost';

    await initializeAllFirebase('test');

    _resetSessionStore();
    await initializeUserDataForTests();
    await initializeSessionsDataForTests();
    await initializeObservabilityDataForTests();

    isFirebaseInitializedForTests = true;
}

export async function firestoreTeardownForTests(): Promise<void> {
    clearTimedSaves();
    await cleanupUserDataForTests();
    await cleanupSessionsDataForTests();
    await cleanupObservabilityDataForTests();

    if (admin.apps.length > 0) {
        await admin.app().delete();
    }
    isFirebaseInitializedForTests = false;
    _resetGlobalFirebaseState();
}

export function _resetGlobalFirebaseState(): void {
    _resetFirestoreDB();
    Object.keys(allCollections).forEach((key) => {
        allCollections[key] = null;
    });
}
