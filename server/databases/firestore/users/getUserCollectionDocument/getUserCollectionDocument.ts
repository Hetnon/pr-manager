// @ts-nocheck
import { getFirestoreCollection } from '../../firebaseApis.js';
import { requireParam } from '../../../../utils/requireParam/requireParam.js';

export async function getUserCollectionDocument(userEmail, collectionName) {
    requireParam(userEmail && collectionName, 'User email and collection name are required to get user data');

    const collection = getFirestoreCollection(collectionName);
    const doc = await collection.doc(userEmail).get();
    if (!doc.exists) {
        return null;
    }
    return doc.data();
}
