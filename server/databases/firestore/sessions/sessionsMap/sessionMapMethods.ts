import { getFirestoreCollection, FieldValue } from '../../firebase_apis.js';
import type { DocumentData } from 'firebase-admin/firestore';

export async function removeSessionFromMap(userEmail: string, sessionId: string): Promise<void> {
    const sessionsMapCollection = getFirestoreCollection('sessionsMap');
    const sessionMapDocRef = sessionsMapCollection.doc(userEmail);

    try {
        await sessionMapDocRef.update({ [sessionId]: FieldValue.delete() });
    } catch (error) {
        if ((error as { code?: number }).code === 5) return; // NOT_FOUND — document doesn't exist, nothing to remove
        throw error;
    }
}

export async function includeSessionInMap(userEmail: string, sessionId: string): Promise<void> {
    const sessionsMapCollection = getFirestoreCollection('sessionsMap');
    const sessionMapDocRef = sessionsMapCollection.doc(userEmail);

    await sessionMapDocRef.set({
        [sessionId]: FieldValue.serverTimestamp()
    }, { merge: true });
}

export async function getUserSessionsMap(userEmail: string): Promise<DocumentData | null> {
    const sessionsMapCollection = getFirestoreCollection('sessionsMap');
    const sessionMapDocRef = sessionsMapCollection.doc(userEmail);
    const sessionMapDoc = await sessionMapDocRef.get();
    if (!sessionMapDoc.exists) {
        return null;
    }
    return sessionMapDoc.data() ?? null;
}
