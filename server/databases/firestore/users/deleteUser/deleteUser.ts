import { getFirestoreCollection, getFirebaseDB } from '../../firebase_apis.js';
import { requireParam } from '../../../../utils/requireParam/requireParam.js';

export async function deleteUser(userEmail: string): Promise<{ success: boolean; message: string }> {
    requireParam(userEmail, 'User email is required to delete a user');

    const sessionsCollection = getFirestoreCollection('sessions');
    const sessionsMapCollection = getFirestoreCollection('sessionsMap');
    const usersCollection = getFirestoreCollection('users');

    const dbBatch = getFirebaseDB().batch();

    const sessionsMapRef = sessionsMapCollection.doc(userEmail);
    const sessionsMap = await sessionsMapRef.get();
    if (sessionsMap.exists) {
        const sessionsData = sessionsMap.data() ?? {};
        for (const sessionId of Object.keys(sessionsData)) {
            dbBatch.delete(sessionsCollection.doc(sessionId));
        }
        dbBatch.delete(sessionsMapRef);
    }

    dbBatch.delete(usersCollection.doc(userEmail));

    await dbBatch.commit();
    return { success: true, message: 'User deleted successfully' };
}
