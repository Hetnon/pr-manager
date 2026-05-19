// A user document as it lives in Firestore.
// userEmail is the document id. The index signature reflects that Firestore
// docs may carry fields beyond the typed subset (encrypted tokens, KMS
// metadata, timestamps) that callers can read opportunistically.
export interface UserRecord {
    userEmail: string;
    githubLogin: string;
    githubId: number;
    [key: string]: unknown;
}

// Payload accepted by createUserDB. The optional fields default server-side.
export interface CreateUserData {
    userEmail: string;
    githubLogin: string;
    githubId: number;
    name?: string;
    avatarUrl?: string;
    userType?: string;
    userStatus?: string;
}

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
