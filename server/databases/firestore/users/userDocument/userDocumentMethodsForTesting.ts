// @ts-nocheck
import { getFirestoreCollection } from '../../firebase_apis.js';
import { mockUserDocumentsData } from 'testing/mocks/expressServer/userDocumentFixtures.js';

export async function initializeUserDocumentsForTests(): Promise<void> {
    const usersCollection = getFirestoreCollection('users');
    for (const [userEmail, userData] of Object.entries(mockUserDocumentsData)) {
        await usersCollection.doc(userEmail).set(userData);
    }
}

export async function cleanupUserDocumentsForTests(): Promise<void> {
    const usersCollection = getFirestoreCollection('users');
    for (const userEmail of Object.keys(mockUserDocumentsData)) {
        await usersCollection.doc(userEmail).delete();
    }
}
