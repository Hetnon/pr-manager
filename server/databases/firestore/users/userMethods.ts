import { getUserCollectionDocument } from './getUserCollectionDocument/getUserCollectionDocument.js';

// Testing helpers
import { initializeUserDocumentsForTests, cleanupUserDocumentsForTests } from './userDocument/userDocumentMethodsForTesting.js';

// Named wrappers using the generic get
export const getUser = (userEmail: string) => getUserCollectionDocument(userEmail, 'users');

// Write/action functions
export { createUserDB } from './createUser/createUser.js';
export { deleteUser as deleteUserFirestore } from './deleteUser/deleteUser.js';
export { updateUserFields } from './userDocument/updateUserFields/updateUserFields.js';
export { getUserByGithubId } from './userDocument/getUserByGithubId/getUserByGithubId.js';
export { getUsersListDB } from './userDocument/getUsersList/getUsersList.js';

// Token storage (KMS-envelope-encrypted)
export { storeUserToken } from './tokens/storeToken.js';
export { getUserToken } from './tokens/getToken.js';
export { clearUserToken } from './tokens/clearToken.js';

// Test utilities
export async function initializeUserDataForTests(): Promise<void> {
    await initializeUserDocumentsForTests();
}

export async function cleanupUserDataForTests(): Promise<void> {
    await cleanupUserDocumentsForTests();
}
