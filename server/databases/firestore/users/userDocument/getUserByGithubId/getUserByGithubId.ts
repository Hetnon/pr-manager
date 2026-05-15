import { getFirestoreCollection } from '../../../firebase_apis.js';
import { requireParam } from '../../../../../utils/requireParam/requireParam.js';

export interface UserRecord {
    userEmail: string;
    githubLogin: string;
    githubId: number;
    [key: string]: unknown;
}

/**
 * Look up a user by their stable GitHub numeric ID.
 * Used during OAuth callback to detect returning users when their email has changed.
 * Returns null if no user with that githubId exists.
 */
export async function getUserByGithubId(githubId: number): Promise<UserRecord | null> {
    requireParam(githubId, 'githubId is required to look up a user', 'number');

    const usersCollection = getFirestoreCollection('users');
    const snapshot = await usersCollection.where('githubId', '==', githubId).limit(1).get();

    if (snapshot.empty) return null;
    return snapshot.docs[0].data() as UserRecord;
}
