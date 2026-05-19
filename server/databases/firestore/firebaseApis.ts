import admin from 'firebase-admin';
import type { Firestore, CollectionReference, DocumentData } from 'firebase-admin/firestore';
import { firestoreEmulatorUp } from './setupAndRun/runFirebase.js';
import { getFirestore } from 'firebase-admin/firestore';
import { requireParam } from '../../utils/requireParam/requireParam.js';

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
    // Load service account from local file in development
    await firestoreEmulatorUp(); // Ensure Firestore emulator is running
    // ② point every Admin-SDK call at the emulator
    process.env.GOOGLE_CLOUD_PROJECT ||= 'demo-project';
    process.env.FIRESTORE_EMULATOR_HOST ||= 'localhost:8080';
    admin.initializeApp({ projectId: process.env.GOOGLE_CLOUD_PROJECT });
    _db = admin.firestore();
}

async function productionFirestoreInitialization(localProductionKeyPath: string | null): Promise<void> {
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
