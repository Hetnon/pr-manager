export { saveBrowserInfoToDB } from './browserInfo/saveBrowserInfoToDB/saveBrowserInfoToDB.js';
export { saveErrorsToDB } from './errorLogs/saveErrorsToDB/saveErrorsToDB.js';
export { getErrorListFromDB } from './errorLogs/getErrorListFromDB/getErrorListFromDB.js';

import { initializeBrowserInfoForTests, cleanupBrowserInfoForTests } from './browserInfo/browserInfoMethodsForTesting.js';
import { initializeErrorLogsForTests, cleanupErrorLogsForTests } from './errorLogs/errorLogsMethodsForTesting.js';

export { initializeBrowserInfoForTests, cleanupBrowserInfoForTests, initializeErrorLogsForTests, cleanupErrorLogsForTests };

export async function initializeObservabilityDataForTests(): Promise<void> {
    await initializeBrowserInfoForTests();
    await initializeErrorLogsForTests();
}

export async function cleanupObservabilityDataForTests(): Promise<void> {
    await cleanupBrowserInfoForTests();
    await cleanupErrorLogsForTests();
}
