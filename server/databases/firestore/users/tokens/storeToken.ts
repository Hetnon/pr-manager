import { getFirestoreCollection } from '../../firebase_apis.js';
import { requireParam } from '../../../../utils/requireParam/requireParam.js';
import { encryptEnvelope } from '../../../../infrastructure/kms/kmsEncryption.js';

export async function storeUserToken(userEmail: string, token: string, scopes: string[] = []): Promise<void> {
    requireParam(userEmail, 'userEmail is required to store a token');
    requireParam(token, 'token is required');

    const { encryptedPayload, wrappedDek, kmsKeyName } = await encryptEnvelope(token);

    const usersCollection = getFirestoreCollection('users');
    await usersCollection.doc(userEmail).update({
        encryptedToken: encryptedPayload,
        encryptedDek: wrappedDek,
        kmsKeyName,
        tokenScopes: scopes,
        lastLogin: new Date().toISOString(),
    });
}
