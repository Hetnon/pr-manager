import { getFirestoreCollection, FieldValue } from '../../../firebaseApis.js';

export async function saveErrorsToDB(payload: Record<string, unknown>): Promise<void> {
    const errorCollection = getFirestoreCollection('errorLogs');
    try {
        await errorCollection.add({
            ...payload,
            createdAt: FieldValue.serverTimestamp(),
            status: 'new'
        });
    } catch (err) {
        console.error('Failed to save error to DB:', err);
    }
}
