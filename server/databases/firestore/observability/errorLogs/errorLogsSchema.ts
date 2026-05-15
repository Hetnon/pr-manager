// @ts-nocheck
/**
 * Error Logs Document Structure
 *
 * Collection: errorLogs
 * Document ID: auto-generated
 *
 * Saved by: saveErrorsToDB (always adds createdAt and status: 'new')
 *
 * TWO distinct callers produce different payload shapes:
 *
 * --- Caller 1: errorHandler (server-side Express error middleware) ---
 * Fields:
 * - userEmail: string - From req.session.userEmail || 'unknown-user'
 * - error: Error - The JS Error object (message, stack, name, statusCode, etc.)
 * - body: object|undefined - req.body at time of error
 * - query: object - req.query at time of error
 * - params: object - req.params at time of error
 * - IP: string - req.ip
 * - url: string - req.originalUrl (the route that caused the error)
 * - method: string - HTTP method ('GET', 'POST', etc.)
 * - origin: 'server-error-handler'
 *
 * --- Caller 2: logError (client-reported errors via POST /api/log-error) ---
 * Server handler adds: userEmail, IP, url, method
 * Client sends:
 * - error: object - { message, stack, name, statusCode }
 * - origin: string - 'client'
 * - device: object - Same device object as browserInfo collection
 * - browserInfo: object - Same browserInfo object as browserInfo collection
 *
 * --- Fields added by saveErrorsToDB on ALL documents ---
 * - createdAt: timestamp - Server-side timestamp
 * - status: 'string' - Always set to 'new' on save (overrides any status in payload)
 *
 * --- Filter fields used by getErrorListFromDB ---
 * - userEmail, status
 *
 * Example (client-reported error):
 * {
 *   "userEmail": "user@example.com",
 *   "IP": "::1",
 *   "url": "/api/log-error",
 *   "method": "POST",
 *   "error": {
 *     "message": "Network request failed",
 *     "stack": "Error: Network request failed\n    at ...",
 *     "name": "Error",
 *     "statusCode": null
 *   },
 *   "origin": "client",
 *   "device": { "name": "desktop", "type": "desktop", ... },
 *   "browserInfo": { "name": "Chrome/Brave", "version": "120.0", ... },
 *   "createdAt": Timestamp(2026-02-16T10:00:00Z),
 *   "status": "new"
 * }
 *
 * Example (server error handler):
 * {
 *   "userEmail": "user@example.com",
 *   "error": { "message": "PR not found", "statusCode": 404 },
 *   "body": { "prNumber": 42 },
 *   "query": {},
 *   "params": {},
 *   "IP": "::1",
 *   "url": "/api/merge-pr",
 *   "method": "POST",
 *   "origin": "server-error-handler",
 *   "createdAt": Timestamp(2026-02-16T10:00:00Z),
 *   "status": "new"
 * }
 */

export const errorLogsSchema = {
    collection: 'errorLogs',
    documentIdType: 'auto',
    // Common fields present on all documents
    commonFields: {
        userEmail: 'string',
        IP: 'string',
        url: 'string',
        method: 'string', // HTTP method
        error: 'object', // Error object or JS Error
        origin: 'string', // 'server-error-handler' | 'client' | other
        createdAt: 'timestamp', // added by saveErrorsToDB
        status: 'string', // always 'new' on save
    },
    // Fields only present on server error handler documents
    serverErrorFields: {
        body: 'object | undefined',
        query: 'object',
        params: 'object',
    },
    // Fields only present on client-reported error documents
    clientErrorFields: {
        device: 'object | undefined',
        browserInfo: 'object | undefined',
    },
};
