import { TEST_USERS } from './testUsers.js';

/**
 * Mock Error Logs Data
 *
 * Collection: errorLogs
 * Mirrors real payloads from two callers:
 *
 * 1. errorHandler (server-side): { userEmail, error, body, query, params, IP, url, method, origin: 'server-error-handler' }
 * 2. logError (client-reported):  { userEmail, IP, url, method, error: {message, stack, name, statusCode}, origin: 'client', device, browserInfo }
 *
 * saveErrorsToDB always adds: createdAt (server timestamp), status: 'new'
 *
 * getErrorListFromDB filters by: userEmail, status.
 */
export const mockErrorLogsData = [
    // Client-reported error from the UI
    {
        userEmail: TEST_USERS.ACTIVE,
        status: 'new',
        IP: '127.0.0.1',
        url: '/api/log-error',
        method: 'POST',
        error: {
            message: 'Network request failed: timeout',
            stack: 'Error: Network request failed\n    at fetch',
            name: 'Error',
            statusCode: null,
        },
        origin: 'client',
        device: { name: 'desktop', type: 'desktop' },
        browserInfo: { name: 'Chrome/Brave', version: '120.0', engine: 'Chromium', fullVersion: '120.0.6099.109' },
        createdAt: new Date('2026-02-16T10:00:00Z'),
    },
    // Client-reported error, resolved
    {
        userEmail: TEST_USERS.ACTIVE,
        status: 'resolved',
        IP: '127.0.0.1',
        url: '/api/log-error',
        method: 'POST',
        error: {
            message: 'Unhandled rejection in PR list refresh',
            stack: 'Error: Unhandled rejection\n    at refresh',
            name: 'Error',
            statusCode: null,
        },
        origin: 'client',
        device: { name: 'desktop', type: 'desktop' },
        browserInfo: { name: 'Chrome/Brave', version: '120.0', engine: 'Chromium', fullVersion: '120.0.6099.109' },
        createdAt: new Date('2026-02-15T10:00:00Z'),
    },
    // Server error handler: GitHub returned 404 trying to read a PR
    {
        userEmail: TEST_USERS.INACTIVE,
        status: 'new',
        IP: '192.168.1.5',
        url: '/api/prs',
        method: 'GET',
        error: {
            message: 'PR not found on GitHub',
            statusCode: 404,
        },
        body: undefined,
        query: { repo: 'pr-matrix', owner: 'example', prNumber: '999' },
        params: {},
        origin: 'server-error-handler',
        createdAt: new Date('2026-02-14T10:00:00Z'),
    },
    // Client-reported error in progress
    {
        userEmail: TEST_USERS.ACTIVE,
        status: 'in-progress',
        IP: '127.0.0.1',
        url: '/api/log-error',
        method: 'POST',
        error: {
            message: 'Merge button clicked while PR was already merged',
            name: 'Error',
        },
        origin: 'client',
        device: { name: 'desktop', type: 'desktop' },
        browserInfo: { name: 'Firefox', version: '121.0', engine: 'Gecko', fullVersion: '121.0' },
        createdAt: new Date('2026-02-13T10:00:00Z'),
    },
    // Server error handler from an admin route
    {
        userEmail: TEST_USERS.ADMIN,
        status: 'new',
        IP: '10.0.0.1',
        url: '/api/change-user-status',
        method: 'PATCH',
        error: {
            message: 'Firestore write operation failed',
            statusCode: 500,
        },
        body: { userEmail: 'target@example.com', fields: { userType: 'admin' } },
        query: {},
        params: {},
        origin: 'server-error-handler',
        createdAt: new Date('2026-02-12T10:00:00Z'),
    },
];
