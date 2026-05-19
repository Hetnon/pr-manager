import { spawn, exec } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import path, { dirname }  from 'node:path';
import { fileURLToPath } from 'node:url';
import http from 'node:http';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
let saveInterval = null;

const pathToFirebaseRoot = path.resolve(__dirname, '.');  // ✅ Now works!
// Firebase CLI writes firestore-debug.log (and friends) into its CWD with no
// way to relocate. Launch the emulator from this dedicated logs folder so the
// debug logs land here and stay out of the repo root.
const logsDir = path.resolve(pathToFirebaseRoot, 'logs');
const firebaseConfigPath = path.resolve(pathToFirebaseRoot, 'firebase.json');
const importPath = path.resolve(pathToFirebaseRoot, 'firebase-runtime', 'firebase-data');

export async function firestoreEmulatorUp() {
    // check if childProcess is not an error
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
    console.log('pathToFirebaseRoot:', pathToFirebaseRoot);
    mkdirSync(logsDir, { recursive: true });
    // --export-on-exit pins any auto-export to the same runtime subfolder so
    // we don't end up with a sea of firebase-export-<timestamp><hash>/ siblings.
    // Launch from logsDir so the CLI's hardcoded firestore-debug.log lands there;
    // pass everything else by absolute path so the relocated CWD doesn't matter.
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
    
    saveInterval = setInterval(() => {
        exec('firebase emulators:export ./firebase-runtime/firebase-data --force --project=demo-project',
            {cwd: pathToFirebaseRoot, shell: true},
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