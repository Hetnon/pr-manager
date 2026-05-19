// @ts-nocheck
import { getFirestoreCollection } from '../../firebaseApis.js';
import { mockErrorLogsData } from 'testing/mocks/expressServer/errorLogsFixtures.js';
import { TEST_USERS } from 'testing/mocks/expressServer/testUsers.js';

export async function initializeErrorLogsForTests() {
    const errorCollection = getFirestoreCollection('errorLogs');
    for (const errorData of mockErrorLogsData) {
        await errorCollection.add(errorData);
    }
}

export async function cleanupErrorLogsForTests() {
    const errorCollection = getFirestoreCollection('errorLogs');
    // Clean up by known test user emails
    const testUserEmails = Object.values(TEST_USERS);
    for (const userEmail of testUserEmails) {
        const snapshot = await errorCollection.where('userEmail', '==', userEmail).get();
        const deletePromises = snapshot.docs.map(doc => doc.ref.delete());
        await Promise.all(deletePromises);
    }
    // Clean up any orphan docs (e.g. from empty-payload tests) that have status 'new' but no userEmail
    const orphanSnapshot = await errorCollection.where('status', '==', 'new').get();
    const orphanDeletes = orphanSnapshot.docs
        .filter(doc => !doc.data().userEmail)
        .map(doc => doc.ref.delete());
    await Promise.all(orphanDeletes);
}
