// @ts-nocheck
import { getFirestoreCollection, FieldValue } from '../../../firebaseApis.js';
import { requireParam } from '../../../../../utils/requireParam/requireParam.js';

export async function saveBrowserInfoToDB(payload) {
    requireParam(payload, 'Payload is required to save browser info');
    const browserInfoCollection = getFirestoreCollection('browserInfo');
    await browserInfoCollection.add({
        ...payload,
        timestamp: FieldValue.serverTimestamp()
    });
}
