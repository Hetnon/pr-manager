// @ts-nocheck
import { mockSessionsMapData } from 'testing/mocks/expressServer/sessionsMapFixtures.js';
import { includeSessionInMap, removeSessionFromMap} from './sessionMapMethods.js';

export async function initializeSessionMapForTests() {
    for (const [userEmail, sessions] of Object.entries(mockSessionsMapData)) {
        for (const sessionId of Object.keys(sessions)) {
            await includeSessionInMap(userEmail, sessionId);
        }
    }
}

export async function cleanupSessionMapForTests() {
    for (const [userEmail, sessions] of Object.entries(mockSessionsMapData)) {
        for (const sessionId of Object.keys(sessions)) {
            await removeSessionFromMap(userEmail, sessionId);
        }
    }
}