/**
 * User Document — pr-matrix
 *
 * Collection: users
 * Document ID: userEmail (string, from GitHub OAuth)
 *
 * Stores the user record + their GitHub OAuth token (envelope-encrypted via KMS).
 * Created by: createUserDB on first GitHub OAuth login.
 * Updated by: updateUserFields (any field) or the dedicated token methods.
 */

export const userSchema = {
    collection: 'users',
    documentIdType: 'userEmail',
    fields: {
        userEmail: 'string',
        githubLogin: 'string',
        githubId: 'number',
        name: 'string',
        avatarUrl: 'string',
        creationDate: 'string',
        lastLogin: 'string',
        userStatus: 'string',
        userType: 'string',
        encryptedToken: 'string',
        encryptedDek: 'string',
        kmsKeyName: 'string',
        tokenScopes: 'array',
    },
};
