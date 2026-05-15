export const mockSessionsMapData = {
    // Document ID: active@example.com
    'active@example.com': {
        'session-123': new Date('2026-02-16T10:00:00Z'),
        'session-456': new Date('2026-02-16T11:00:00Z')
    },

    // Document ID: inactive@example.com  
    'inactive@example.com': {
        'session-abc': new Date('2026-02-15T09:00:00Z')
    },

    // Document ID: admin@example.com
    'admin@example.com': {
        'session-001': new Date('2026-02-14T08:00:00Z'),
        'session-002': new Date('2026-02-15T09:00:00Z'),
        'session-003': new Date('2026-02-16T10:00:00Z')
    },

    // Document ID: nosessions@example.com (empty sessions)
    'nosessions@example.com': {}
};

// Separate constants for easy reference in tests


export const TEST_SESSION_IDS = {
    ACTIVE_USER_SESSION_1: 'session-123',
    ACTIVE_USER_SESSION_2: 'session-456',
    INACTIVE_USER_SESSION: 'session-abc',
    ADMIN_SESSION_1: 'session-001',
    ADMIN_SESSION_2: 'session-002',
    ADMIN_SESSION_3: 'session-003',
    NON_EXISTENT: 'session-fake-000'
};
