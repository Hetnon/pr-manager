// @ts-nocheck
import { getFirestoreCollection } from '../../../firebase_apis.js';

function timestampToISO(value) {
    if (value && typeof value.toDate === 'function') return value.toDate().toISOString();
    if (value instanceof Date) return value.toISOString();
    if (typeof value === 'string') return value;
    return null;
}

export async function getErrorListFromDB(payload) {
    const errorCollection = getFirestoreCollection('errorLogs');

    const { userEmail, statuses, pageNumber, errorsPerPage } = payload;

    let query = errorCollection;
    if (userEmail) {
        query = query.where('userEmail', '==', userEmail);
    }
    if (statuses && statuses.length > 0) {
        query = query.where('status', 'in', statuses);
    }

    query = query.orderBy('createdAt', 'desc');

    const page = pageNumber || 1;
    const limit = errorsPerPage || 20;
    const offset = (page - 1) * limit;

    const snapshot = await query.offset(offset).limit(limit).get();
    const errorLogList = [];
    snapshot.forEach(doc => {
        const docData = doc.data();
        errorLogList.push({ ...docData, id: doc.id, createdAt: timestampToISO(docData.createdAt) });
    });
    return errorLogList;
}
