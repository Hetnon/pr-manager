// @ts-nocheck
import { getFirestoreCollection } from '../../firebase_apis.js';
import { mockSessionsData } from 'testing/mocks/expressServer/sessionFixtures.js';

// Seed sessions collection with mock data
export async function initializeSessionForTests() {
    const sessionsCollection = getFirestoreCollection('sessions');
    for (const [sessionId, sessionData] of Object.entries(mockSessionsData)) {
        await sessionsCollection.doc(sessionId).set(sessionData);
    }
}

// Clean up sessions collection after tests
export async function cleanupSessionsForTests() {
    const sessionsCollection = getFirestoreCollection('sessions');
    for (const sessionId of Object.keys(mockSessionsData)) {
        await sessionsCollection.doc(sessionId).delete();
    }
}
