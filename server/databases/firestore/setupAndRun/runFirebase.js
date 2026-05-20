import { spawn, exec } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import os from 'node:os';
import path, { dirname }  from 'node:path';
import { fileURLToPath } from 'node:url';
import http from 'node:http';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
let saveInterval = null;

// firebase.json lives in this folder (per-repo, identical across boilerplate-derived repos).
const pathToFirebaseRoot = path.resolve(__dirname, '.');
const firebaseConfigPath = path.resolve(pathToFirebaseRoot, 'firebase.json');

// Shared snapshot dir across all boilerplate-derived repos so multiple projects
// can run against the same emulator on :8080 with isolated, persisted data.
// Each project sets a distinct GOOGLE_CLOUD_PROJECT in its .env.dev; the
// emulator namespaces collections by project ID inside this one snapshot folder.
// Override the location with FIRESTORE_EMULATOR_DATA_DIR.
const dataDir = process.env.FIRESTORE_EMULATOR_DATA_DIR
    || path.join(os.homedir(), '.firestore-emulator-data');
const importPath = path.resolve(dataDir, 'firebase-data');
// Firebase CLI writes firestore-debug.log into its CWD with no way to relocate.
// Launch from this shared logs folder so the log lands there and stays out of
// any repo. The spawning project owns the log file for that emulator session.
const logsDir = path.resolve(dataDir, 'logs');

export async function firestoreEmulatorUp() {
    const isEmulatorRunning = await checkFirestoreReady();
    if (isEmulatorRunning) {
        setTimedSavesForFirestoreEmulator();
        console.log('Firestore emulator already running. Skipping spawn…');
        return;
    }

    console.log('Firestore emulator not running. Spawning…');
    await spawnFirebase();
    setTimedSavesForFirestoreEmulator();
}

async function spawnFirebase() {
    console.log('Firestore emulator data dir:', dataDir);
    mkdirSync(logsDir, { recursive: true });
    mkdirSync(importPath, { recursive: true });
    // --export-on-exit pins any auto-export to the shared snapshot folder.
    // Launch from logsDir so the CLI's hardcoded firestore-debug.log lands there;
    // everything else passed by absolute path so the CWD doesn't matter.
    const cmdLine = `cd /d "${logsDir}" && firebase emulators:start --config "${firebaseConfigPath}" --project=demo-project --import="${importPath}" --export-on-exit="${importPath}"`;
    const args = [
        '/c',
        'start',
        '""', // Empty title is important
        'cmd',
        '/k',
        `"${cmdLine}"`
    ];

    spawn('cmd.exe', args, {
        shell: true,
        detached: true,
        stdio: 'ignore'
    });
    console.log('Spawned Firebase emulator in a new terminal window');
    await waitUntilFirestoreIsReady();
}

function waitUntilFirestoreIsReady(timeout = 25000, interval = 1000) {
    const start = Date.now();
    return new Promise((resolve, reject) => {
        const waitFirestoreReady = async () => {
            if(await checkFirestoreReady()){
                console.log('Firestore emulator is ready');
                return resolve();
            }
            if (Date.now() - start > timeout) {
                console.error('Timeout waiting for Firestore emulator to be ready');
                return reject(new Error('Firestore emulator not ready within timeout'));
            }
            setTimeout(waitFirestoreReady, interval);
        };
        waitFirestoreReady();
    });
}

function checkFirestoreReady() {
    return new Promise((resolve) => {
        const req = http.get('http://127.0.0.1:8080', (res) => {
            resolve(res.statusCode < 500);
        });
        req.on('error', () => resolve(false));
        req.setTimeout(1000, () => {
            req.destroy();
            resolve(false);
        });
    });
}

function setTimedSavesForFirestoreEmulator() {
    if(saveInterval) {
        clearInterval(saveInterval);
    }
    const saveIntervalMs = 1000 * 60 * 5;
    console.log('Setting timed saves for Firestore emulator every', saveIntervalMs / 1000, 'seconds');

    // Export the whole emulator state (all projects' data) into the shared
    // snapshot folder. If multiple projects' intervals fire close together they
    // race, but the destination and source are both shared, so it's a benign
    // last-write-wins.
    saveInterval = setInterval(() => {
        exec(`firebase emulators:export "${importPath}" --force --project=demo-project`,
            {cwd: logsDir, shell: true},
            (err, stdout, stderr) => {
            if (err) {
                console.error('Error saving Firestore emulator data:', err.message);
                if (stdout) console.error('  stdout:', stdout);
                if (stderr) console.error('  stderr:', stderr);
            }
        });
    }, saveIntervalMs);
}

// Export cleanup function
export function clearTimedSaves() {
    if (saveInterval) {
        clearInterval(saveInterval);
        saveInterval = null;
    }
}
