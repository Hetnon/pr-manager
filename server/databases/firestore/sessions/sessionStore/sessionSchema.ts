// @ts-nocheck
/**
 * Sessions Document Structure
 * 
 * Collection: sessions
 * Document ID: session id defined by express-session (string)
 * 
 * Fields:
 * - [data]: object (session data stored as JSON string)
 * 
 * Example session data structure (stored as JSON string in Firestore):
    {
        "cookie":{
            "originalMaxAge":2591717910,
            "expires":"2026-03-16T02:25:12.378Z",
            "secure":true,
            "httpOnly":true,
            "domain":"localhost",
            "path":"/",
            "sameSite":"strict"
        },
        "userEmail":"hetnon.freitas@gmail.com",
        "userType":"master-admin",
        "userStatus":"active",
        "csrfToken":"randomlyGeneratedCsrfTokenValue"
    }

 */

export const sessionsSchema = { // defined by the firestore store for express-session
    collection: 'sessions',
    documentIdType: 'sessionId', // string
    fields: {
        // Dynamic key: data (session data stored as JSON string)
        'data':  'string' // JSON stringified session data
        
    }
};