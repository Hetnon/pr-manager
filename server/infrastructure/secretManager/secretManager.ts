import { SecretManagerServiceClient } from '@google-cloud/secret-manager';

const client = new SecretManagerServiceClient();
const projectName = process.env.GOOGLE_PROJECT_ID || process.env.GOOGLE_CLOUD_PROJECT;

let _firebaseKey: unknown;

export async function loadSecrets(): Promise<void> {
    const [version] = await client.accessSecretVersion({
        name: `projects/${projectName}/secrets/env_secrets/versions/latest`,
    });
    const payload = (version.payload!.data as Buffer).toString('utf8');
    const envSecrets = JSON.parse(payload) as Record<string, string>;
    for (const [key, value] of Object.entries(envSecrets)) {
        process.env[key] = value;
    }

    const [firebaseVersion] = await client.accessSecretVersion({
        name: `projects/${projectName}/secrets/FIREBASE_CONFIG/versions/latest`,
    });
    const firebasePayload = (firebaseVersion.payload!.data as Buffer).toString('utf8');
    _firebaseKey = JSON.parse(firebasePayload);

    console.log('Secrets loaded successfully');
}

export function firebaseKey(): unknown {
    if (!_firebaseKey) {
        throw new Error('Firebase key has not been loaded. Call loadSecrets first.');
    }
    return _firebaseKey;
}

export function _resetSecretStateForTests(): void {
    _firebaseKey = undefined;
}
