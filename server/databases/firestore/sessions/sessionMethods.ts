export { updateUserSessions } from './sessionStore/updateUserSessions/updateUserSessions.js';
export { getSessionStore, _resetSessionStore } from './sessionStore/sessionStore.js';

export { removeSessionFromMap, includeSessionInMap } from './sessionsMap/sessionMapMethods.js';

// Test utilities
import { initializeSessionForTests, cleanupSessionsForTests } from './sessionStore/sessionMethodsForTesting.js';
import { initializeSessionMapForTests, cleanupSessionMapForTests } from './sessionsMap/sessionMapMethodsForTesting.js';

export { initializeSessionForTests, cleanupSessionsForTests, initializeSessionMapForTests, cleanupSessionMapForTests };

export async function initializeSessionsDataForTests(): Promise<void> {
    await initializeSessionForTests();
    await initializeSessionMapForTests();
}

export async function cleanupSessionsDataForTests(): Promise<void> {
    await cleanupSessionsForTests();
    await cleanupSessionMapForTests();
}
