// @ts-nocheck
import { getFirestoreCollection } from '../../../firebase_apis.js';
import { convertFirestoreTimestampToISO } from '../../../../../utils/convertApplicationTimesToReadableFormat.js'

export async function getErrorListFromDB(payload) {
    const errorCollection = getFirestoreCollection('errorLogs');

    const { userEmail, statuses, batchSearchId, applicationId, jobListingId, pageNumber, errorsPerPage } = payload;

    let query = errorCollection;
    if (userEmail) {
        query = query.where('userEmail', '==', userEmail);
    }
    if (statuses && statuses.length > 0) {
        query = query.where('status', 'in', statuses);
    }
    if (batchSearchId) {
        query = query.where('batchSearchId', '==', batchSearchId);
    }
    if (applicationId) {
        query = query.where('applicationId', '==', applicationId);
    }
    if (jobListingId) {
        query = query.where('jobListingId', '==', jobListingId);
    }

    query = query.orderBy('createdAt', 'desc');

    const page = pageNumber || 1;
    const limit = errorsPerPage || 20;
    const offset = (page - 1) * limit;

    const snapshot = await query.offset(offset).limit(limit).get();
    const errorLogList = [];
    snapshot.forEach(doc => {
        const docData = doc.data();
        errorLogList.push({ ...docData, id: doc.id, createdAt: convertFirestoreTimestampToISO(docData.createdAt) });
    });
    return errorLogList;
}
