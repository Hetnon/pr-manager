import admin from 'firebase-admin';
import { initializeAllFirebase, allCollections, _resetFirestoreDB } from './firebaseApis.js';
import { clearTimedSaves } from './setupAndRun/runFirebase.js';
import { _resetSessionStore } from './sessions/sessionStore/sessionStore.js';

// Test fixture helpers — imported directly so the production import chain
// (databases.ts → firestoreMethods.ts → *Methods.ts) does not pull in the
// `testing/` package, which only resolves under jest's moduleNameMapper.
import { initializeUserDocumentsForTests, cleanupUserDocumentsForTests } from './users/userMethodsForTesting.js';
import { initializeSessionForTests, cleanupSessionsForTests } from './sessions/sessionStore/sessionMethodsForTesting.js';
import { initializeSessionMapForTests, cleanupSessionMapForTests } from './sessions/sessionsMap/sessionMapMethodsForTesting.js';
import { initializeBrowserInfoForTests, cleanupBrowserInfoForTests } from './observability/browserInfo/browserInfoMethodsForTesting.js';
import { initializeErrorLogsForTests, cleanupErrorLogsForTests } from './observability/errorLogs/errorLogsMethodsForTesting.js';

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
    await initializeUserDocumentsForTests();
    await initializeSessionForTests();
    await initializeSessionMapForTests();
    await initializeBrowserInfoForTests();
    await initializeErrorLogsForTests();

    isFirebaseInitializedForTests = true;
}

export async function firestoreTeardownForTests(): Promise<void> {
    clearTimedSaves();
    await cleanupUserDocumentsForTests();
    await cleanupSessionsForTests();
    await cleanupSessionMapForTests();
    await cleanupBrowserInfoForTests();
    await cleanupErrorLogsForTests();

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
