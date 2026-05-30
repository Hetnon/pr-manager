import admin from 'firebase-admin';
import type { Firestore, CollectionReference, DocumentData } from 'firebase-admin/firestore';
import { firestoreEmulatorUp } from './setupAndRun/runFirebase.js';
import { getFirestore } from 'firebase-admin/firestore';
import { requireParam } from '../../utils/requireParam/requireParam.js';
import { isProduction } from '../../config.js';

const firebaseEnvironments: Record<string, { initializationFunction: (key?: string | null) => Promise<void> }> = {
    'production': { initializationFunction: async (localProductionKeyPath) => await productionFirestoreInitialization(localProductionKeyPath ?? null) },
    'development': { initializationFunction: async () => await developerFirestoreInitialization() },
    'test': { initializationFunction: async () => await developerFirestoreInitialization() }
};

let _db: Firestore | undefined;

export const FieldValue = admin.firestore.FieldValue;
export const FieldPath = admin.firestore.FieldPath;
export const Timestamp = admin.firestore.Timestamp;

export function getFirebaseDB(): Firestore {
    if (!_db) {
        throw Object.assign(new Error('Firestore has not been initialized. Call initializeAllFirebase first.'), { statusCode: 500 });
    }
    return _db;
}

export const allCollections: Record<string, CollectionReference<DocumentData> | null> = {
    users: null,

    // Sessions
    sessions: null,
    sessionsMap: null,

    // Observability
    errorLogs: null,
    browserInfo: null,
};

export function getFirestoreCollection(collectionName: string): CollectionReference<DocumentData> {
    // get collection reference by name - only for collections that are not initialized as global variables
    const collection = allCollections[collectionName];
    if (!collection) {
        throw Object.assign(
            new Error(`Collection ${collectionName} has not been initialized or does not exist. Call initializeAllFirebase first and make sure the collection name is correct.`),
            { statusCode: 500 }
        );
    }
    return collection;
}

export async function initializeAllFirebase(environment: string, localProductionKeyPath: string | null = null): Promise<void> {
    console.log('Initializing Firestore');

    requireParam(environment, 'Environment not defined when initializing Firestore');
    if (!firebaseEnvironments[environment]) {
        throw Object.assign(new Error(`Invalid environment: ${environment}`), { statusCode: 500 });
    }

    await initializeFirebase(environment, localProductionKeyPath);

    _db!.settings({
        ignoreUndefinedProperties: true
    });

    // initialize collection references
    for (const collectionName of Object.keys(allCollections)) {
        allCollections[collectionName] = _db!.collection(collectionName);
    }

    console.log('Firestore initialized');
}

async function initializeFirebase(environment: string, localProductionKeyPath: string | null = null): Promise<void> {
    if (admin.apps.length) {
        console.warn('Firebase already initialized. Skipping re-initialization.');
        return; // Firebase already initialized, skip
    }

    const initializationFunction = firebaseEnvironments[environment].initializationFunction;
    await initializationFunction(localProductionKeyPath);
}

async function developerFirestoreInitialization(): Promise<void> {
    await firestoreEmulatorUp(); // Ensure Firestore emulator is running

    // Dev/test ALWAYS talk to the local emulator — real Firestore must be unreachable
    // here. firebase-admin only routes to the emulator when FIRESTORE_EMULATOR_HOST is
    // set, so this assignment is the single thing keeping real Firestore out of dev.
    process.env.FIRESTORE_EMULATOR_HOST ||= 'localhost:8080';
    assertEmulatorHostIsLocal(process.env.FIRESTORE_EMULATOR_HOST);

    // Each boilerplate-derived project uses a distinct GOOGLE_CLOUD_PROJECT so the
    // shared emulator namespaces their data apart (convention: dev-<gcp-project-id>).
    // Require it explicitly: a silent default ('demo-project') would merge every
    // project's data into one partition, and the mismatch between that default and the
    // .env value is exactly what makes emulator data look like it came from a real,
    // foreign project. No default → misconfiguration fails loud instead of silently.
    const projectId = process.env.GOOGLE_CLOUD_PROJECT;
    if (!projectId) {
        throw Object.assign(new Error(
            'GOOGLE_CLOUD_PROJECT is not set. Dev/test needs a per-project emulator namespace ' +
            '(convention: dev-<gcp-project-id>). Set it in server/.env.dev.'
        ), { statusCode: 500 });
    }

    admin.initializeApp({ projectId });
    _db = admin.firestore();
}

// Guard against dev/test ever pointing at a remote Firestore. Only a loopback host is
// the local emulator; anything else means FIRESTORE_EMULATOR_HOST was set to a real
// endpoint, which would route writes to live data. Refuse rather than connect.
function assertEmulatorHostIsLocal(emulatorHost: string): void {
    const isLocal = /^(localhost|127\.0\.0\.1|0\.0\.0\.0|\[::1\]|::1)(:\d+)?$/i.test(emulatorHost);
    if (!isLocal) {
        throw Object.assign(new Error(
            `Refusing to start dev/test against a non-local Firestore host "${emulatorHost}". ` +
            'Dev must use the local emulator — point FIRESTORE_EMULATOR_HOST at localhost or unset it.'
        ), { statusCode: 500 });
    }
}

async function productionFirestoreInitialization(localProductionKeyPath: string | null): Promise<void> {
    // Safety net: never connect to real Firestore unless the process actually booted in
    // production. isProduction is frozen from NODE_ENV at module load, before any .env
    // file can change it — so a dev server that later read NODE_ENV=production from an
    // env file lands here by mistake. Refuse rather than touch live data.
    if (!isProduction) {
        throw Object.assign(new Error(
            'Refusing to connect to real Firestore: the server did not boot in production ' +
            '(isProduction=false) but the Firestore environment resolved to "production". ' +
            'Check NODE_ENV in server/.env.dev / .env.shared — dev must stay on the emulator.'
        ), { statusCode: 500 });
    }

    let serviceAccount: unknown;

    if (localProductionKeyPath) {
        // Load service account from local file if path is provided
        const { createRequire } = await import('node:module');
        const require = createRequire(import.meta.url);
        serviceAccount = require(localProductionKeyPath);
    } else {
        // Load service account from Secret Manager in production
        const { firebaseKey } = await import('../../infrastructure/secretManager/secretManager.js');
        serviceAccount = await firebaseKey();
    }
    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount as admin.ServiceAccount),
    });
    _db = getFirestore(admin.app(), 'production');
}

export function _resetFirestoreDB(): void {
    _db = undefined;
}
