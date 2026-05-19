import { FirestoreStore } from '@google-cloud/connect-firestore';
import { getFirebaseDB } from '../../firebaseApis.js';

let _sessionStore: FirestoreStore | null = null;
let _storePromise: Promise<FirestoreStore> | null = null;
// the use of the store allows accessing the session data with req.session and does automatic saving of the session data at the end of the request

export async function getSessionStore(): Promise<FirestoreStore> {
    if (_sessionStore) {
        return _sessionStore;
    }

    if (_storePromise) {
        return _storePromise;
    }

    _storePromise = (async () => {
        try {
            const db = getFirebaseDB();
            _sessionStore = new FirestoreStore({
                dataset: db,
                kind: 'sessions'
            });
            return _sessionStore;
        } catch (error) {
            console.error('Error initializing FirestoreStore:', error);
            throw error;
        }
    })();

    return _storePromise;
}

export function _resetSessionStore(): void {
    _sessionStore = null;
    _storePromise = null;
}
