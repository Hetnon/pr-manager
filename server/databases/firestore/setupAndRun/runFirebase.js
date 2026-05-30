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
// Each project sets a distinct GOOGLE_CLOUD_PROJECT in its dev env file; the
// emulator namespaces collections by project ID inside this one snapshot folder.
// Override the location with FIRESTORE_EMULATOR_DATA_DIR.
const dataDir = process.env.FIRESTORE_EMULATOR_DATA_DIR
    || path.join(os.homedir(), '.firestore-emulator-data');
const importPath = path.resolve(dataDir, 'firebase-data');
// Firebase CLI writes firestore-debug.log into its CWD with no way to relocate.
// Launch from this shared logs folder so the log lands there and stays out of
// any repo. The spawning project owns the log file for that emulator session.
const logsDir = path.resolve(dataDir, 'logs');

// The emulator runs under whichever project the app uses (GOOGLE_CLOUD_PROJECT, set in
// the dev env file), so each repo gets its own namespace in the shared emulator and
// never collides with another. No fallback on purpose: two repos silently defaulting to
// the same name would scribble over each other's data in the shared snapshot, so a
// missing value is a hard error the dev must fix, not a silent default.
function requireEmulatorProjectId() {
    const projectId = process.env.GOOGLE_CLOUD_PROJECT;
    if (!projectId) {
        throw new Error(
            'GOOGLE_CLOUD_PROJECT is not set — the Firestore emulator needs a unique per-project ' +
            'namespace so projects sharing the emulator do not collide. Set it in your dev env file ' +
            '(convention: dev-<gcp-project-id>).'
        );
    }
    return projectId;
}

export async function firestoreEmulatorUp() {
    requireEmulatorProjectId(); // fail fast if the per-project namespace is missing
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
    const cmdLine = `cd /d "${logsDir}" && firebase emulators:start --config "${firebaseConfigPath}" --project=${requireEmulatorProjectId()} --import="${importPath}" --export-on-exit="${importPath}"`;
    // `start ""` opens a new terminal window (empty title) running `cmd /k <cmdLine>`
    // so it stays open. Pass the whole thing as one shell string: an args array with
    // shell:true is deprecated (DEP0190) since the args are only concatenated, not
    // escaped — this builds that same concatenation explicitly.
    const command = `cmd.exe /c start "" cmd /k "${cmdLine}"`;

    spawn(command, {
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
        exec(`firebase emulators:export "${importPath}" --force --project=${requireEmulatorProjectId()}`,
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
