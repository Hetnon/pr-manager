// @ts-nocheck
import { getFirestoreCollection } from '../../firebase_apis.js';
import { mockBrowserInfoData } from 'testing/mocks/expressServer/browserInfoFixtures.js';
import { TEST_USERS } from 'testing/mocks/expressServer/testUsers.js';

export async function initializeBrowserInfoForTests() {
    const browserInfoCollection = getFirestoreCollection('browserInfo');
    for (const infoData of mockBrowserInfoData) {
        await browserInfoCollection.add(infoData);
    }
}

export async function cleanupBrowserInfoForTests() {
    const browserInfoCollection = getFirestoreCollection('browserInfo');
    const markerSnapshot = await browserInfoCollection.where('testMarker', '==', true).get();
    const markerDeletes = markerSnapshot.docs.map(doc => doc.ref.delete());

    const testUserEmails = Object.values(TEST_USERS);
    const userDeletes = [];
    for (const userEmail of testUserEmails) {
        const snapshot = await browserInfoCollection.where('userEmail', '==', userEmail).get();
        snapshot.docs.forEach(doc => userDeletes.push(doc.ref.delete()));
    }

    await Promise.all([...markerDeletes, ...userDeletes]);
}
