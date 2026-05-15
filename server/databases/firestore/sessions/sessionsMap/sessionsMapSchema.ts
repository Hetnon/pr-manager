// @ts-nocheck
// schemas/sessionsMapSchema.js

/**
 * SessionsMap Document Structure
 * 
 * Collection: sessionsMap
 * Document ID: userEmail (string)
 * 
 * Fields:
 * - [sessionId]: timestamp (when session was created)
 * 
 * Example:
 * {
 *   "session-abc-123": Timestamp(2026-02-16T10:00:00Z),
 *   "session-xyz-789": Timestamp(2026-02-16T11:30:00Z)
 * }
 */

export const sessionsMapSchema = {
    collection: 'sessionsMap',
    documentIdType: 'userEmail', // string
    fields: {
        // Dynamic keys: sessionId -> timestamp
        '[sessionId]': 'timestamp'
    }
};