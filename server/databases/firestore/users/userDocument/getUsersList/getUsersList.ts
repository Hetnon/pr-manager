import { getFirestoreCollection } from '../../../firebase_apis.js';
import { requireParam } from '../../../../../utils/requireParam/requireParam.js';

export interface GetUsersListPayload {
    payload: {
        pageNumber: number;
        usersPerPage: number;
    };
}

export interface UsersListResult {
    users: Array<Record<string, unknown>>;
    page: number;
    perPage: number;
}

/**
 * Admin-only paged listing of users in the system.
 * Uses Firestore offset paging — fine at our scale; revisit if user count grows.
 */
export async function getUsersListDB({ payload }: GetUsersListPayload): Promise<UsersListResult> {
    requireParam(payload, 'payload with pageNumber and usersPerPage is required');
    const { pageNumber, usersPerPage } = payload;
    requireParam(pageNumber >= 0, 'pageNumber must be >= 0');
    requireParam(usersPerPage > 0, 'usersPerPage must be > 0');

    const usersCollection = getFirestoreCollection('users');
    const offset = pageNumber * usersPerPage;

    const snapshot = await usersCollection
        .orderBy('creationDate', 'desc')
        .offset(offset)
        .limit(usersPerPage)
        .get();

    // Strip secret fields before returning.
    const users = snapshot.docs.map((doc) => {
        const data = doc.data();
        const { encryptedToken, encryptedDek, kmsKeyName, ...safe } = data;
        return safe;
    });

    return { users, page: pageNumber, perPage: usersPerPage };
}
