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
 * Client sends (from useExtensionFunctionsHook.js extensionCall):
 * - error: object - { message, stack, name, statusCode, nodes, nonThrowing }
 * - origin: string - 'extensionCall'
 * - device: object - Same device object as browserInfo collection
 * - browserInfo: object - Same browserInfo object as browserInfo collection
 * - ...extensionPayload - Spread of extension call payload (task, url, website, etc.)
 *
 * --- Fields added by saveErrorsToDB on ALL documents ---
 * - createdAt: timestamp - Server-side timestamp
 * - status: 'new' - Always set to 'new' on save (overrides any status in payload)
 *
 * --- Filter fields used by getErrorListFromDB ---
 * - userEmail, status, batchSearchId, applicationId, jobListingId
 * - batchSearchId/applicationId/jobListingId may exist on documents if included in the
 *   client error payload, and are used as optional query filters
 *
 * Example (client-reported error):
 * {
 *   "userEmail": "user@example.com",
 *   "IP": "::1",
 *   "url": "/api/log-error",
 *   "method": "POST",
 *   "error": {
 *     "message": "Extension call failed",
 *     "stack": "Error: Extension call failed\n    at ...",
 *     "name": "Error",
 *     "statusCode": null,
 *     "nodes": null,
 *     "nonThrowing": null
 *   },
 *   "origin": "extensionCall",
 *   "task": "apply-for-job",
 *   "website": "linkedin",
 *   "device": { "name": "desktop", "type": "desktop", ... },
 *   "browserInfo": { "name": "Chrome/Brave", "version": "120.0", ... },
 *   "createdAt": Timestamp(2026-02-16T10:00:00Z),
 *   "status": "new"
 * }
 *
 * Example (server error handler):
 * {
 *   "userEmail": "user@example.com",
 *   "error": { "message": "Not found", "statusCode": 404 },
 *   "body": { "jobUrl": "https://..." },
 *   "query": {},
 *   "params": {},
 *   "IP": "::1",
 *   "url": "/api/apply-for-job",
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
        origin: 'string', // 'server-error-handler' | 'extensionCall' | other
        createdAt: 'timestamp', // added by saveErrorsToDB
        status: 'string', // always 'new' on save
    },
    // Fields only present on server error handler documents
    serverErrorFields: {
        body: 'object | undefined',
        query: 'object',
        params: 'object',
    },
    // Fields only present on client-reported (extension) error documents
    clientErrorFields: {
        device: 'object | undefined',
        browserInfo: 'object | undefined',
        task: 'string | undefined', // from extension payload
        website: 'string | undefined', // from extension payload
    },
    // Optional filter fields (may exist if included in error payload)
    filterFields: {
        batchSearchId: 'string | undefined',
        applicationId: 'string | undefined',
        jobListingId: 'string | undefined',
    },
};
