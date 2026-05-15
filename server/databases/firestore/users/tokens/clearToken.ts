import { getFirestoreCollection } from '../../firebase_apis.js';
import { requireParam } from '../../../../utils/requireParam/requireParam.js';

export async function clearUserToken(userEmail: string): Promise<void> {
    requireParam(userEmail, 'userEmail is required to clear a token');
    const usersCollection = getFirestoreCollection('users');
    await usersCollection.doc(userEmail).update({
        encryptedToken: '',
        encryptedDek: '',
        kmsKeyName: '',
        tokenScopes: [],
    });
}
