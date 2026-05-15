import { getFirestoreCollection } from '../../firebase_apis.js';
import { requireParam } from '../../../../utils/requireParam/requireParam.js';
import { decryptEnvelope } from '../../../../infrastructure/kms/kmsEncryption.js';

/**
 * Returns the user's decrypted GitHub OAuth token, or null if not present.
 * Caller is responsible for handling null (e.g. forcing re-login).
 */
export async function getUserToken(userEmail: string): Promise<string | null> {
    requireParam(userEmail, 'userEmail is required to get a token');

    const usersCollection = getFirestoreCollection('users');
    const userDoc = await usersCollection.doc(userEmail).get();
    if (!userDoc.exists) return null;

    const data = userDoc.data() as
        | { encryptedToken?: string; encryptedDek?: string; kmsKeyName?: string }
        | undefined;
    if (!data?.encryptedToken || !data.encryptedDek || !data.kmsKeyName) return null;

    return decryptEnvelope({
        encryptedPayload: data.encryptedToken,
        wrappedDek: data.encryptedDek,
        kmsKeyName: data.kmsKeyName,
    });
}
