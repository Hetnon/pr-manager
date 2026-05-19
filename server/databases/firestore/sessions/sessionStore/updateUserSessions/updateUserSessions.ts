// @ts-nocheck
import { getFirestoreCollection, getFirebaseDB } from '../../../firebaseApis.js';
import { getUserSessionsMap } from '../../sessionsMap/sessionMapMethods.js';
import { throwValidationError } from '../../../../../utils/requireParam/requireParam.js';

export async function updateUserSessions(userEmail, infoToUpdate) {
    if (!userEmail || !infoToUpdate || typeof infoToUpdate !== 'object') throwValidationError('User email and infoToUpdate object are required');
    const sessionsCollection = getFirestoreCollection('sessions');
    const db = getFirebaseDB();
    const batch = db.batch();

    const userSessionsMap = await getUserSessionsMap(userEmail); // no document returns null, document with no sessions returns empty object
    if (!userSessionsMap) {
        return; // No sessions map found for this userEmail - whatever is the infoToUpdate, it will be reflected on next login
    }

    const sessionIds = Object.keys(userSessionsMap);
    if (sessionIds.length === 0) {
        return; // No sessions to update
    }

    const sessionSnapshots = await Promise.all(
        sessionIds.map(sessionId => sessionsCollection.doc(sessionId).get())
    );

    // Note: Firestore batch limit is 500 ops. User sessions are assumed to be well below this.
    const validSessions = sessionSnapshots.filter(snapshot => snapshot.exists);
    
    if (validSessions.length === 0) {
        return; // No valid sessions to update
    }

    validSessions.forEach(snapshot => {
        updateSessionData(snapshot, infoToUpdate, batch);
    });
    
    await batch.commit();
}

function updateSessionData(snapshot, infoToUpdate, batch) {
    const docFields  = snapshot.data();
    let sessionData = {};
    try {
        sessionData = JSON.parse(docFields.data || '{}');
    } catch (error) {
        console.error(`Failed to parse session data for session ${snapshot.id}:`, error);
    }

    const updatedSessionData = {
        ...sessionData,
        ...infoToUpdate
    };
    batch.update(snapshot.ref, {
        data: JSON.stringify(updatedSessionData)
    });
}