// Database abstraction. The rest of the server imports methods from here so the
// underlying provider (currently Firestore) is swappable without touching call sites.

const databases = ['firestore'];

let providers: Record<string, Record<string, (...args: unknown[]) => unknown>> = {};
let initialized = false;

export default async function loadDatabaseMethods(): Promise<void> {
    const { initializeAllFirebase } = await import('./firestore/firebase_apis.js');
    await initializeAllFirebase(process.env.NODE_ENV ?? '');
    await loadMethods();
}

async function loadMethods(): Promise<void> {
    for (const db of databases) {
        const module = await import(`./${db}/${db}Methods.js`);
        providers[db] = module.default;
    }
    initialized = true;
}

export async function initializeAllDatabasesForTests(): Promise<void> {
    for (const db of databases) {
        const module = await import(`./${db}/${db}TestSetup.js`);
        const setupFunction = module[`${db}SetupForTests`] as (() => Promise<void>) | undefined;
        if (setupFunction) await setupFunction();
    }
    await loadMethods();
}

export async function tearDownAllDatabasesForTests(): Promise<void> {
    for (const db of databases) {
        const module = await import(`./${db}/${db}TestSetup.js`);
        const teardownFunction = module[`${db}TeardownForTests`] as (() => Promise<void>) | undefined;
        if (teardownFunction) await teardownFunction();
    }
}

// Routing: method name → provider that implements it.
const routing: Record<string, string> = {
    // Sessions
    getSessionStore:        'firestore',
    updateUserSessions:     'firestore',
    includeSessionInMap:    'firestore',
    removeSessionFromMap:   'firestore',

    // Users
    createUserDB:           'firestore',
    deleteUserFirestore:    'firestore',
    updateUserFields:       'firestore',
    getUserByGithubId:      'firestore',
    getUsersListDB:         'firestore',

    // GitHub OAuth tokens (KMS-envelope-encrypted)
    storeUserToken:         'firestore',
    getUserToken:           'firestore',
    clearUserToken:         'firestore',

    // Observability
    saveErrorsToDB:         'firestore',
    getErrorListFromDB:     'firestore',
    saveBrowserInfoToDB:    'firestore',
};

function ensureInit(): void {
    if (!initialized) {
        throw Object.assign(new Error('Database methods not loaded yet. Call loadDatabaseMethods() first.'), { statusCode: 500 });
    }
}

function dispatch(methodName: string, args: unknown[]): unknown {
    ensureInit();
    const dbName = routing[methodName];
    if (!dbName) throw Object.assign(new Error(`No database routing found for method ${methodName}`), { statusCode: 500 });
    const method = providers[dbName][methodName];
    if (!method) throw new Error(`Method ${methodName} not implemented in ${dbName}`);
    return method(...args);
}

// Sessions
export const updateUserSessions     = (...args: unknown[]) => dispatch('updateUserSessions', args);
export const includeSessionInMap    = (...args: unknown[]) => dispatch('includeSessionInMap', args);
export const removeSessionFromMap   = (...args: unknown[]) => dispatch('removeSessionFromMap', args);
export async function getSessionStore() {
    const db = routing.getSessionStore;
    const module = await import(`./${db}/sessions/sessionStore/sessionStore.js`);
    return module.getSessionStore();
}

// Users
export const createUserDB           = (...args: unknown[]) => dispatch('createUserDB', args);
export const deleteUserFirestore    = (...args: unknown[]) => dispatch('deleteUserFirestore', args);
export const updateUserFields       = (...args: unknown[]) => dispatch('updateUserFields', args);
export const getUserByGithubId      = (...args: unknown[]) => dispatch('getUserByGithubId', args);
export const getUsersListDB         = (...args: unknown[]) => dispatch('getUsersListDB', args);

// Tokens
export const storeUserToken         = (...args: unknown[]) => dispatch('storeUserToken', args);
export const getUserToken           = (...args: unknown[]) => dispatch('getUserToken', args);
export const clearUserToken         = (...args: unknown[]) => dispatch('clearUserToken', args);

// Observability
export const saveErrorsToDB         = (...args: unknown[]) => dispatch('saveErrorsToDB', args);
export const getErrorListFromDB     = (...args: unknown[]) => dispatch('getErrorListFromDB', args);
export const saveBrowserInfoToDB    = (...args: unknown[]) => dispatch('saveBrowserInfoToDB', args);
