#!/usr/bin/env node
// Bootstrap a brand-new Google Cloud project end-to-end for the pr-matrix stack.
//
//   node scripts/gcp-bootstrap.js \
//     --project-id=my-app-123 \
//     --billing=01ABCD-EF1234-567890 \
//     --region=us-central \
//     --github-client-id=Iv1.xxxxxxxxxx \
//     --github-client-secret=xxxxxxxxxx \
//     [--github-owner=USER --github-repo=REPO --branch=^main$] \
//     [--cookie-domain=localhost --ui-host=https://localhost:3000 --api-host=https://localhost:3030] \
//     [--secrets=A,B,C]
//
// What it does (idempotent — re-running is safe):
//   1. Pre-flight: gcloud installed and authed
//   2. Create the GCP project, link billing, set active
//   3. Enable required APIs (App Engine, Cloud Build, KMS, Firestore, Secret Manager, ...)
//   4. Initialize App Engine in the chosen region
//   5. Grant Cloud Build's service accounts the roles needed to deploy to App Engine
//   6. Create Firestore database (named "production") in the matching multi-region
//   7. Create KMS key ring + crypto key for envelope encryption; grant App Engine SA
//      the cryptoKeyEncrypterDecrypter role
//   8. Create a Firebase admin service account, generate a JSON key, store it in
//      Secret Manager as FIREBASE_CONFIG (delete the local copy)
//   9. Build env_secrets JSON (SESSION_SECRET, GITHUB_*, KMS_KEY_NAME, ...) and store
//  10. (Optional) Create Cloud Build triggers for cloudbuild-*.yaml against a GitHub repo
//  11. (Optional) Create extra Secret Manager secrets (--secrets=…)
//  12. Write server/.env with dev-mode values (handy for local development)
//
// Zero dependencies — just Node.js + gcloud CLI installed.

'use strict';

const { spawnSync } = require('node:child_process');
const readline = require('node:readline');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');

// ─── output helpers ───────────────────────────────────────────────────────────
const C = {
    reset: '\x1b[0m', bold: '\x1b[1m', dim: '\x1b[2m',
    red: '\x1b[31m', green: '\x1b[32m', yellow: '\x1b[33m', cyan: '\x1b[36m',
};
const step = (t) => console.log(`\n${C.bold}${C.cyan}▶ ${t}${C.reset}`);
const info = (m) => console.log(`  ${C.dim}${m}${C.reset}`);
const ok   = (m) => console.log(`  ${C.green}✓${C.reset} ${m}`);
const skip = (m) => console.log(`  ${C.yellow}↷${C.reset} ${m}`);
const warn = (m) => console.log(`  ${C.yellow}!${C.reset} ${m}`);
const fail = (m) => console.error(`  ${C.red}✗${C.reset} ${m}`);

// ─── gcloud wrapper ───────────────────────────────────────────────────────────
function gcloud(args, opts = {}) {
    const r = spawnSync('gcloud', args, {
        encoding: 'utf8',
        input: opts.input,
        shell: process.platform === 'win32',
    });
    return { code: r.status ?? 1, stdout: r.stdout || '', stderr: r.stderr || '' };
}
function gcloudOrThrow(args, opts) {
    const r = gcloud(args, opts);
    if (r.code !== 0) throw new Error(`gcloud ${args.join(' ')}\n${r.stderr.trim()}`);
    return r.stdout.trim();
}

// ─── CLI args ─────────────────────────────────────────────────────────────────
function parseArgs(argv) {
    const out = {};
    for (const a of argv) {
        const m = a.match(/^--([^=]+)(?:=(.*))?$/);
        if (m) out[m[1]] = m[2] ?? true;
    }
    return out;
}

function printHelp() {
    console.log(`
Usage:
  node scripts/gcp-bootstrap.js --project-id=ID --billing=BILLING [options]

Required:
  --project-id=ID            GCP project ID
  --billing=ACCOUNT_ID       Billing account (find yours: gcloud billing accounts list)

Recommended:
  --github-client-id=ID      GitHub OAuth App client ID  (or you'll be prompted)
  --github-client-secret=S   GitHub OAuth App client secret  (or you'll be prompted)

Optional:
  --project-name=NAME        Display name (default: project-id)
  --region=REGION            App Engine region (default: australia-southeast1 / Sydney)
  --firestore-location=LOC   Firestore location (default: australia-southeast1 / Sydney)
  --kms-keyring=NAME         KMS keyring name (default: pr-matrix-keys)
  --kms-key=NAME             KMS crypto key name (default: tokens)
  --kms-location=LOC         KMS location (default: global; or any KMS region like us-central1)
  --firebase-sa=NAME         Firebase service-account ID (default: pr-matrix-firebase)
  --cookie-domain=DOMAIN     Production cookie domain (default: auto-detected from gcloud app describe)
  --ui-host=URL              UI origin (default: https://<defaultHostname>)
  --api-host=URL             API origin (default: https://api-dot-<defaultHostname>)
  --github-owner=OWNER       Create Cloud Build triggers against this GitHub owner
  --github-repo=REPO         ... and this repo
  --branch=PATTERN           Trigger branch pattern (default: ^main$)
  --secrets=A,B,C            Extra Secret Manager secrets to create interactively
  --skip-apis                Skip API enablement
  --skip-appengine           Skip App Engine init
  --skip-iam                 Skip IAM grants
  --skip-firestore           Skip Firestore database creation
  --skip-kms                 Skip KMS key creation
  --skip-firebase-sa         Skip Firebase service-account creation
  --skip-env-secrets         Skip env_secrets bundle upload
  --skip-dev-env             Skip writing server/.env
  --help                     Show this help

Notes:
  • Two-pass flow if you don't have GitHub creds yet:
      1. Run without --github-client-id/secret. The script creates the project +
         App Engine + KMS + Firestore + Firebase SA, then prints the exact OAuth
         callback URL it expects (derived from gcloud app describe).
      2. Create your GitHub OAuth App at github.com/settings/developers using both
         that URL and https://localhost:3030/api/auth/github/callback as callback URLs.
      3. Re-run with --github-client-id and --github-client-secret to populate
         env_secrets and write server/.env. Idempotent: skipped steps are skipped.
  • Cloud Build → GitHub: the first connection on a new project still requires one
    manual OAuth step in the Console. The script prints the link if needed.
`);
}

// ─── interactive prompt ───────────────────────────────────────────────────────
function ask(question) {
    return new Promise((resolve) => {
        const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
        rl.question(question, (answer) => { rl.close(); resolve(answer); });
    });
}

// ─── pre-flight ───────────────────────────────────────────────────────────────
function checkPrereqs() {
    step('Pre-flight checks');
    if (gcloud(['version']).code !== 0) {
        fail('gcloud CLI not found. Install: https://cloud.google.com/sdk/docs/install');
        process.exit(1);
    }
    ok('gcloud CLI installed');

    const account = gcloudOrThrow(['auth', 'list', '--filter=status:ACTIVE', '--format=value(account)']);
    if (!account) {
        fail('No active gcloud auth. Run: gcloud auth login');
        process.exit(1);
    }
    ok(`Authenticated as ${account}`);
}

// ─── project / billing / APIs ─────────────────────────────────────────────────
function ensureProject(projectId, projectName) {
    step(`Project: ${projectId}`);
    const exists = gcloud(['projects', 'describe', projectId, '--format=value(projectId)']);
    if (exists.code === 0 && exists.stdout.trim() === projectId) {
        skip('Project already exists');
        return;
    }
    info('Creating project...');
    const r = gcloud(['projects', 'create', projectId, '--name', projectName, '--quiet']);
    if (r.code !== 0) throw new Error(`Failed to create project:\n${r.stderr.trim()}`);
    ok('Project created');
}

function ensureBilling(projectId, billingAccount) {
    step('Billing account');
    const target = `billingAccounts/${billingAccount}`;
    const current = gcloud(['billing', 'projects', 'describe', projectId, '--format=value(billingAccountName)']);
    if (current.code === 0 && current.stdout.trim() === target) {
        skip(`Already linked to ${billingAccount}`);
        return;
    }
    info(`Linking ${billingAccount}...`);
    const r = gcloud(['billing', 'projects', 'link', projectId, '--billing-account', billingAccount]);
    if (r.code !== 0) throw new Error(`Failed to link billing:\n${r.stderr.trim()}`);
    ok('Billing linked');
}

function setActiveProject(projectId) {
    step('Active project');
    gcloudOrThrow(['config', 'set', 'project', projectId]);
    ok(`Active project set to ${projectId}`);
}

const APIS = [
    'cloudresourcemanager.googleapis.com',
    'iam.googleapis.com',
    'iamcredentials.googleapis.com',
    'serviceusage.googleapis.com',
    'appengine.googleapis.com',
    'cloudbuild.googleapis.com',
    'secretmanager.googleapis.com',
    'artifactregistry.googleapis.com',
    'storage.googleapis.com',
    'compute.googleapis.com',
    'cloudkms.googleapis.com',
    'firestore.googleapis.com',
];

function enableApis(projectId) {
    step('Enable APIs');
    info(`Enabling ${APIS.length} APIs (this can take a minute)...`);
    const r = gcloud(['services', 'enable', ...APIS, '--project', projectId]);
    if (r.code !== 0) throw new Error(`Failed to enable APIs:\n${r.stderr.trim()}`);
    for (const api of APIS) ok(api);
}

function ensureAppEngine(projectId, region) {
    step(`App Engine: ${region}`);
    const exists = gcloud(['app', 'describe', '--project', projectId, '--format=value(id)']);
    if (exists.code === 0 && exists.stdout.trim()) {
        skip('App Engine app already exists');
        return;
    }
    info(`Creating App Engine app in ${region}...`);
    const r = gcloud(['app', 'create', '--project', projectId, '--region', region]);
    if (r.code !== 0) throw new Error(`Failed to create App Engine app:\n${r.stderr.trim()}`);
    ok('App Engine initialized');
}

function getProjectNumber(projectId) {
    return gcloudOrThrow(['projects', 'describe', projectId, '--format=value(projectNumber)']);
}

// ─── IAM ──────────────────────────────────────────────────────────────────────
const DEPLOY_ROLES = [
    'roles/appengine.deployer',
    'roles/appengine.serviceAdmin',
    'roles/iam.serviceAccountUser',
    'roles/storage.objectAdmin',
    'roles/cloudbuild.builds.builder',
    'roles/logging.logWriter',
];

function grantDeployIam(projectId) {
    step('IAM: Cloud Build → App Engine deploy');
    const projectNumber = getProjectNumber(projectId);
    const serviceAccounts = [
        `${projectNumber}@cloudbuild.gserviceaccount.com`,
        `${projectNumber}-compute@developer.gserviceaccount.com`,
    ];

    for (const sa of serviceAccounts) {
        info(`Granting to ${sa}`);
        for (const role of DEPLOY_ROLES) {
            const r = grantRole(projectId, sa, role);
            if (r.code !== 0) {
                warn(`  ${role} — ${(r.stderr || '').trim().split('\n').pop()}`);
            } else {
                ok(`  ${role}`);
            }
        }
    }
}

function grantRole(projectId, serviceAccount, role) {
    return gcloud([
        'projects', 'add-iam-policy-binding', projectId,
        '--member', `serviceAccount:${serviceAccount}`,
        '--role', role,
        '--condition=None',
        '--quiet',
        '--format=value(etag)',
    ]);
}

// ─── Firestore ────────────────────────────────────────────────────────────────
function defaultFirestoreLocation(region) {
    // Use the App Engine region as the single-region Firestore location.
    // Override with --firestore-location for multi-region (nam5/eur3/etc.).
    return region;
}

function getAppEngineHostname(projectId) {
    const r = gcloud(['app', 'describe', '--project', projectId, '--format=value(defaultHostname)']);
    return r.code === 0 ? r.stdout.trim() : '';
}

function ensureFirestore(projectId, location) {
    step(`Firestore database: production @ ${location}`);
    const exists = gcloud(['firestore', 'databases', 'describe',
        '--database', 'production', '--project', projectId, '--format=value(name)']);
    if (exists.code === 0 && exists.stdout.trim()) {
        skip('Firestore database "production" already exists');
        return;
    }
    info('Creating named Firestore database "production"...');
    const r = gcloud([
        'firestore', 'databases', 'create',
        '--database', 'production',
        '--location', location,
        '--type', 'firestore-native',
        '--project', projectId,
        '--quiet',
    ]);
    if (r.code !== 0) throw new Error(`Failed to create Firestore DB:\n${r.stderr.trim()}`);
    ok('Firestore "production" created');
}

// ─── KMS ──────────────────────────────────────────────────────────────────────
function ensureKms(projectId, keyringName, keyName, region) {
    step(`KMS key: ${keyringName}/${keyName} @ ${region}`);

    // Keyring (idempotent: create swallowing "already exists")
    const ringExists = gcloud(['kms', 'keyrings', 'describe', keyringName,
        '--location', region, '--project', projectId, '--format=value(name)']);
    if (ringExists.code === 0 && ringExists.stdout.trim()) {
        skip(`Keyring ${keyringName} already exists`);
    } else {
        const r = gcloud(['kms', 'keyrings', 'create', keyringName,
            '--location', region, '--project', projectId, '--quiet']);
        if (r.code !== 0 && !/already exists/i.test(r.stderr)) {
            throw new Error(`Failed to create keyring:\n${r.stderr.trim()}`);
        }
        ok(`Keyring ${keyringName} created`);
    }

    // Crypto key
    const keyExists = gcloud(['kms', 'keys', 'describe', keyName,
        '--keyring', keyringName, '--location', region,
        '--project', projectId, '--format=value(name)']);
    let fullKeyName;
    if (keyExists.code === 0 && keyExists.stdout.trim()) {
        skip(`Key ${keyName} already exists`);
        fullKeyName = keyExists.stdout.trim();
    } else {
        const r = gcloud(['kms', 'keys', 'create', keyName,
            '--keyring', keyringName, '--location', region,
            '--purpose', 'encryption',
            '--project', projectId, '--quiet']);
        if (r.code !== 0) throw new Error(`Failed to create key:\n${r.stderr.trim()}`);
        ok(`Key ${keyName} created`);
        fullKeyName = `projects/${projectId}/locations/${region}/keyRings/${keyringName}/cryptoKeys/${keyName}`;
    }

    // Grant App Engine default SA encrypt/decrypt on this key
    const appEngineSa = `${projectId}@appspot.gserviceaccount.com`;
    info(`Granting cryptoKeyEncrypterDecrypter to ${appEngineSa}`);
    const r = gcloud([
        'kms', 'keys', 'add-iam-policy-binding', keyName,
        '--keyring', keyringName,
        '--location', region,
        '--member', `serviceAccount:${appEngineSa}`,
        '--role', 'roles/cloudkms.cryptoKeyEncrypterDecrypter',
        '--project', projectId,
        '--condition=None',
        '--quiet',
        '--format=value(etag)',
    ]);
    if (r.code !== 0) warn(`  ${(r.stderr || '').trim().split('\n').pop()}`);
    else ok('  granted');

    // Also grant the user running gcloud (so local dev can decrypt)
    const localAccount = gcloud(['auth', 'list', '--filter=status:ACTIVE', '--format=value(account)']).stdout.trim();
    if (localAccount) {
        info(`Granting cryptoKeyEncrypterDecrypter to ${localAccount} (for local dev)`);
        const r2 = gcloud([
            'kms', 'keys', 'add-iam-policy-binding', keyName,
            '--keyring', keyringName,
            '--location', region,
            '--member', `user:${localAccount}`,
            '--role', 'roles/cloudkms.cryptoKeyEncrypterDecrypter',
            '--project', projectId,
            '--condition=None',
            '--quiet',
            '--format=value(etag)',
        ]);
        if (r2.code !== 0) warn(`  ${(r2.stderr || '').trim().split('\n').pop()}`);
        else ok('  granted');
    }

    return fullKeyName;
}

// ─── Firebase service account ─────────────────────────────────────────────────
function ensureFirebaseServiceAccount(projectId, saName) {
    step(`Firebase service account: ${saName}`);

    const saEmail = `${saName}@${projectId}.iam.gserviceaccount.com`;

    const exists = gcloud(['iam', 'service-accounts', 'describe', saEmail,
        '--project', projectId, '--format=value(email)']);
    if (exists.code === 0 && exists.stdout.trim()) {
        skip(`Service account ${saEmail} already exists`);
    } else {
        const r = gcloud(['iam', 'service-accounts', 'create', saName,
            '--display-name', 'pr-matrix Firebase Admin',
            '--project', projectId, '--quiet']);
        if (r.code !== 0) throw new Error(`Failed to create SA:\n${r.stderr.trim()}`);
        ok(`Created ${saEmail}`);
    }

    info(`Granting roles/datastore.user to ${saEmail}`);
    const roleResult = grantRole(projectId, saEmail, 'roles/datastore.user');
    if (roleResult.code !== 0) warn(`  ${(roleResult.stderr || '').trim().split('\n').pop()}`);
    else ok('  granted');

    // Generate key JSON
    info('Generating service account key...');
    const tmpKeyPath = path.join(os.tmpdir(), `pr-matrix-fb-key-${Date.now()}.json`);
    const keyResult = gcloud(['iam', 'service-accounts', 'keys', 'create', tmpKeyPath,
        '--iam-account', saEmail, '--project', projectId, '--quiet']);
    if (keyResult.code !== 0) throw new Error(`Failed to create SA key:\n${keyResult.stderr.trim()}`);
    const keyContent = fs.readFileSync(tmpKeyPath, 'utf8');
    fs.unlinkSync(tmpKeyPath);
    ok('Key generated (held in memory only)');
    return keyContent;
}

// ─── Secrets ──────────────────────────────────────────────────────────────────
function upsertSecret(projectId, name, value) {
    const exists = gcloud(['secrets', 'describe', name, '--project', projectId, '--format=value(name)']);
    if (exists.code !== 0 || !exists.stdout.trim()) {
        const create = gcloud(['secrets', 'create', name,
            '--replication-policy', 'automatic',
            '--project', projectId, '--quiet']);
        if (create.code !== 0) throw new Error(`Failed to create ${name}:\n${create.stderr.trim()}`);
    }
    const addVer = gcloud(['secrets', 'versions', 'add', name,
        '--data-file=-', '--project', projectId, '--quiet'], { input: value });
    if (addVer.code !== 0) throw new Error(`Failed to add ${name} version:\n${addVer.stderr.trim()}`);
}

function storeFirebaseConfig(projectId, firebaseSaJson) {
    step('Secret Manager: FIREBASE_CONFIG');
    upsertSecret(projectId, 'FIREBASE_CONFIG', firebaseSaJson);
    ok('FIREBASE_CONFIG stored');
}

function storeEnvSecrets(projectId, envSecretsObject) {
    step('Secret Manager: env_secrets');
    upsertSecret(projectId, 'env_secrets', JSON.stringify(envSecretsObject, null, 2));
    ok(`env_secrets stored (${Object.keys(envSecretsObject).length} keys)`);
}

async function createExtraSecrets(projectId, names) {
    step('Secret Manager: extras');
    for (const name of names) {
        const exists = gcloud(['secrets', 'describe', name, '--project', projectId, '--format=value(name)']);
        if (exists.code === 0 && exists.stdout.trim()) {
            skip(`${name} already exists`);
            continue;
        }
        const value = await ask(`    Value for ${name} (input is visible): `);
        if (!value) {
            warn(`No value entered for ${name} — skipping`);
            continue;
        }
        upsertSecret(projectId, name, value);
        ok(`${name} set`);
    }
}

// ─── Cloud Build triggers ─────────────────────────────────────────────────────
const TRIGGERS = [
    { name: 'deploy-server', config: 'cloudbuild-expressServer.yaml', desc: 'Deploy server (api service)' },
    { name: 'deploy-ui',     config: 'cloudbuild-webClient.yaml',     desc: 'Deploy UI (default service)' },
];

function createBuildTriggers(projectId, owner, repo, branchPattern) {
    step('Cloud Build triggers');
    warn('Pre-req: connect GitHub to Cloud Build once via the Console:');
    warn(`  https://console.cloud.google.com/cloud-build/triggers/connect?project=${projectId}`);
    warn('If creation fails with "no repo connected", do that step and re-run.');

    for (const t of TRIGGERS) {
        info(`Trigger "${t.name}" → ${t.config}  (${branchPattern})`);
        const r = gcloud([
            'builds', 'triggers', 'create', 'github',
            '--name', t.name,
            '--description', t.desc,
            '--repo-owner', owner,
            '--repo-name', repo,
            '--branch-pattern', branchPattern,
            '--build-config', t.config,
            '--project', projectId,
            '--quiet',
        ]);
        if (r.code !== 0) {
            const stderr = (r.stderr || '').trim();
            if (/already exists|already in use/i.test(stderr)) {
                skip(`${t.name} already exists`);
            } else {
                warn(`${t.name} — ${stderr.split('\n').pop()}`);
            }
        } else {
            ok(`${t.name} created`);
        }
    }
}

// ─── dev .env ─────────────────────────────────────────────────────────────────
function writeDevEnvFile(envVars) {
    step('Writing server/.env (dev defaults)');
    const lines = Object.entries(envVars).map(([k, v]) => `${k}=${v}`);
    const dest = path.resolve(__dirname, '..', 'server', '.env');
    fs.writeFileSync(dest, lines.join('\n') + '\n', { mode: 0o600 });
    ok(`Wrote ${dest}`);
    info('This file is .gitignored. It mirrors the env_secrets bundle for local dev.');
}

// ─── summary ──────────────────────────────────────────────────────────────────
function printSummary(s) {
    step('Done');
    console.log(`
  ${C.bold}Project:${C.reset}   ${s.projectId}
  ${C.bold}Console:${C.reset}   https://console.cloud.google.com/home/dashboard?project=${s.projectId}
  ${C.bold}Region:${C.reset}    ${s.region}
  ${C.bold}UI URL:${C.reset}    ${s.uiHost || '(unknown — App Engine app not yet created)'}
  ${C.bold}API URL:${C.reset}   ${s.apiHost || '(unknown)'}
  ${C.bold}KMS key:${C.reset}   ${s.kmsKeyName || '(skipped)'}
`);

    if (!s.hasGithubCreds) {
        console.log(`  ${C.bold}${C.yellow}Next step — register these callback URLs with your GitHub OAuth App:${C.reset}
    Dev:   ${s.devCallbackUrl}
    Prod:  ${s.prodCallbackUrl || '(unknown — re-run after App Engine is created)'}

  Create the OAuth App at: https://github.com/settings/developers
  Then re-run this script with:
    --github-client-id=<from OAuth App>
    --github-client-secret=<from OAuth App>
`);
    } else {
        console.log(`  ${C.bold}Deploy:${C.reset}
    gcloud builds submit --config=cloudbuild-expressServer.yaml --project=${s.projectId}
    gcloud builds submit --config=cloudbuild-webClient.yaml     --project=${s.projectId}
`);
    }
}

// ─── main ─────────────────────────────────────────────────────────────────────
async function main() {
    const args = parseArgs(process.argv.slice(2));

    if (args.help) { printHelp(); process.exit(0); }
    if (!args['project-id'] || !args.billing) {
        printHelp();
        fail('Missing required --project-id and/or --billing');
        process.exit(1);
    }

    const projectId          = args['project-id'];
    const projectName        = args['project-name'] || projectId;
    const billing            = args.billing;
    const region             = args.region || 'australia-southeast1';
    const firestoreLocation  = args['firestore-location'] || defaultFirestoreLocation(region);
    const kmsKeyring         = args['kms-keyring'] || 'pr-matrix-keys';
    const kmsKey             = args['kms-key'] || 'tokens';
    const kmsLocation        = args['kms-location'] || 'global';
    const firebaseSaName     = args['firebase-sa'] || 'pr-matrix-firebase';
    const branch             = args.branch || '^main$';
    const ghOwner            = args['github-owner'];
    const ghRepo             = args['github-repo'];
    const extraSecretsArg    = args.secrets;

    // Allow two-pass: skip env_secrets write if no GitHub creds yet.
    const ghClientId     = args['github-client-id'];
    const ghClientSecret = args['github-client-secret'];
    const hasGithubCreds = Boolean(ghClientId && ghClientSecret);

    // ─── execute ────────────────────────────────────────────────────────────────
    checkPrereqs();
    ensureProject(projectId, projectName);
    ensureBilling(projectId, billing);
    setActiveProject(projectId);

    if (!args['skip-apis'])      enableApis(projectId);
    if (!args['skip-appengine']) ensureAppEngine(projectId, region);
    if (!args['skip-iam'])       grantDeployIam(projectId);
    if (!args['skip-firestore']) ensureFirestore(projectId, firestoreLocation);

    // Now that App Engine exists, ask gcloud for the real hostname (region-specific code prefix like .ts.r.appspot.com).
    const defaultHostname = getAppEngineHostname(projectId);
    const uiHost       = args['ui-host']     || (defaultHostname ? `https://${defaultHostname}` : '');
    const apiHost      = args['api-host']    || (defaultHostname ? `https://api-dot-${defaultHostname}` : '');
    const cookieDomain = args['cookie-domain'] || defaultHostname || '';

    let kmsKeyName = '';
    if (!args['skip-kms']) {
        kmsKeyName = ensureKms(projectId, kmsKeyring, kmsKey, kmsLocation);
    }

    let firebaseSaJson = '';
    if (!args['skip-firebase-sa']) {
        firebaseSaJson = ensureFirebaseServiceAccount(projectId, firebaseSaName);
        storeFirebaseConfig(projectId, firebaseSaJson);
    }

    const prodCallbackUrl = apiHost ? `${apiHost}/api/auth/github/callback` : '';
    const devCallbackUrl  = 'https://localhost:3030/api/auth/github/callback';

    const sessionSecret = crypto.randomBytes(48).toString('base64url');

    if (hasGithubCreds && !args['skip-env-secrets']) {
        const prodEnvSecrets = {
            SESSION_SECRET: sessionSecret,
            GITHUB_CLIENT_ID: ghClientId,
            GITHUB_CLIENT_SECRET: ghClientSecret,
            GITHUB_REDIRECT_URI: prodCallbackUrl,
            GITHUB_OAUTH_SCOPES: 'repo read:user user:email',
            POST_LOGIN_REDIRECT: `${uiHost}/`,
            KMS_KEY_NAME: kmsKeyName,
            GOOGLE_PROJECT_ID: projectId,
            COOKIE_DOMAIN: cookieDomain,
            ALLOWED_ORIGINS: [uiHost, apiHost].filter(Boolean).join(','),
        };
        storeEnvSecrets(projectId, prodEnvSecrets);
    } else if (!hasGithubCreds) {
        step('Secret Manager: env_secrets');
        skip('Skipped — re-run with --github-client-id and --github-client-secret to populate.');
    }

    if (ghOwner && ghRepo) createBuildTriggers(projectId, ghOwner, ghRepo, branch);
    else if (ghOwner || ghRepo) warn('Need both --github-owner and --github-repo to create triggers — skipping.');

    if (extraSecretsArg) {
        const names = extraSecretsArg.split(',').map((s) => s.trim()).filter(Boolean);
        if (names.length) await createExtraSecrets(projectId, names);
    }

    if (hasGithubCreds && !args['skip-dev-env']) {
        const devEnv = {
            NODE_ENV: 'development',
            SESSION_SECRET: sessionSecret,
            GITHUB_CLIENT_ID: ghClientId,
            GITHUB_CLIENT_SECRET: ghClientSecret,
            GITHUB_REDIRECT_URI: devCallbackUrl,
            GITHUB_OAUTH_SCOPES: 'repo read:user user:email',
            POST_LOGIN_REDIRECT: 'https://localhost:3000/',
            KMS_KEY_NAME: kmsKeyName,
            GOOGLE_PROJECT_ID: projectId,
            GOOGLE_CLOUD_PROJECT: 'demo-project',
            FIRESTORE_EMULATOR_HOST: 'localhost:8080',
            COOKIE_DOMAIN: 'localhost',
            ALLOWED_ORIGINS: 'https://localhost:3000',
            PORT: '3030',
        };
        writeDevEnvFile(devEnv);
    } else if (!hasGithubCreds) {
        step('Writing server/.env (dev defaults)');
        skip('Skipped — needs GitHub creds.');
    }

    printSummary({
        projectId,
        region,
        kmsKeyName,
        defaultHostname,
        uiHost,
        apiHost,
        prodCallbackUrl,
        devCallbackUrl,
        hasGithubCreds,
    });
}

main().catch((e) => {
    console.error(`\n${C.red}${C.bold}✗ Bootstrap failed:${C.reset} ${e.message}`);
    process.exit(1);
});
