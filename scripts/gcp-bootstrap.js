#!/usr/bin/env node
// Bootstrap a brand-new Google Cloud project end-to-end.
//
//   node scripts/gcp-bootstrap.js \
//     --project-id=my-app-123 \
//     --billing=01ABCD-EF1234-567890 \
//     --region=us-central \
//     [--github-owner=USER --github-repo=REPO --branch=^main$] \
//     [--secrets=API_KEY,DB_PASSWORD]
//
// What it does (idempotent — re-running is safe):
//   1. Pre-flight: gcloud installed and authed
//   2. Create the GCP project
//   3. Link a billing account
//   4. Set it as the active gcloud project
//   5. Enable required APIs (App Engine, Cloud Build, Secret Manager, IAM, ...)
//   6. Initialize App Engine in the chosen region
//   7. Grant Cloud Build's service accounts the roles needed to deploy to App Engine
//   8. (Optional) Create Cloud Build triggers for cloudbuild-*.yaml against a GitHub repo
//   9. (Optional) Create Secret Manager secrets (values prompted interactively)
//
// Zero dependencies — just Node.js + gcloud CLI installed.

'use strict';

const { spawnSync } = require('node:child_process');
const readline = require('node:readline');

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
    shell: process.platform === 'win32',  // resolve gcloud.cmd on Windows
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
  node scripts/gcp-bootstrap.js --project-id=ID --billing=BILLING_ID [options]

Required:
  --project-id=ID         GCP project ID (lowercase, 6-30 chars, globally unique)
  --billing=ACCOUNT_ID    Billing account (find yours: gcloud billing accounts list)

Optional:
  --project-name=NAME     Display name (default: project-id)
  --region=REGION         App Engine region (default: us-central)
  --github-owner=OWNER    Create Cloud Build triggers against this GitHub owner/org
  --github-repo=REPO      ... and this repo (both required to enable triggers)
  --branch=PATTERN        Trigger branch pattern (default: ^main$)
  --secrets=A,B,C         Comma-separated secret names to create (prompts for values)
  --skip-apis             Skip API enablement
  --skip-appengine        Skip App Engine init
  --skip-iam              Skip IAM grants
  --help                  Show this help

Notes:
  • Cloud Build → GitHub: the first time you connect Cloud Build to GitHub on a
    new project requires one manual OAuth step in the Console. The script will
    print the link if trigger creation fails for that reason.
  • App Engine regions differ from Compute regions (us-central, not us-central1).
`);
}

// ─── interactive prompt ───────────────────────────────────────────────────────
function ask(question) {
  return new Promise((resolve) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    rl.question(question, (answer) => { rl.close(); resolve(answer); });
  });
}

// ─── steps ────────────────────────────────────────────────────────────────────
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

  // Cover both Cloud Build SA flavors:
  //   - legacy: PROJECT_NUMBER@cloudbuild.gserviceaccount.com
  //   - 2024+ default: PROJECT_NUMBER-compute@developer.gserviceaccount.com
  const serviceAccounts = [
    `${projectNumber}@cloudbuild.gserviceaccount.com`,
    `${projectNumber}-compute@developer.gserviceaccount.com`,
  ];

  for (const sa of serviceAccounts) {
    info(`Granting to ${sa}`);
    for (const role of DEPLOY_ROLES) {
      const r = gcloud([
        'projects', 'add-iam-policy-binding', projectId,
        '--member', `serviceAccount:${sa}`,
        '--role', role,
        '--condition=None',
        '--quiet',
        '--format=value(etag)',
      ]);
      if (r.code !== 0) {
        const msg = (r.stderr || '').trim().split('\n').pop();
        warn(`  ${role} — ${msg}`);
      } else {
        ok(`  ${role}`);
      }
    }
  }
}

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

async function createSecrets(projectId, names) {
  step('Secret Manager');
  for (const name of names) {
    const exists = gcloud(['secrets', 'describe', name, '--project', projectId, '--format=value(name)']);
    if (exists.code === 0 && exists.stdout.trim()) {
      skip(`${name} already exists (leaving versions untouched)`);
      continue;
    }
    info(`Creating ${name}`);
    const create = gcloud([
      'secrets', 'create', name,
      '--replication-policy', 'automatic',
      '--project', projectId,
      '--quiet',
    ]);
    if (create.code !== 0) {
      warn(`Create failed: ${create.stderr.trim()}`);
      continue;
    }
    const value = await ask(`    Value for ${name} (input is visible): `);
    if (!value) {
      warn(`No value entered — ${name} exists but has no version`);
      continue;
    }
    const addVer = gcloud(
      ['secrets', 'versions', 'add', name, '--data-file=-', '--project', projectId, '--quiet'],
      { input: value },
    );
    if (addVer.code !== 0) warn(`Version add failed: ${addVer.stderr.trim()}`);
    else ok(`${name} set`);
  }
}

function printSummary(projectId, region) {
  step('Done');
  const appHost = region === 'us-central' ? 'uc.r.appspot.com' : `${region}.r.appspot.com`;
  console.log(`
  ${C.bold}Project:${C.reset}  ${projectId}
  ${C.bold}Console:${C.reset}  https://console.cloud.google.com/home/dashboard?project=${projectId}
  ${C.bold}App URLs:${C.reset} https://${projectId}.${appHost}  (default service)
            https://api-dot-${projectId}.${appHost}  (api service)

  Manual deploy:
    gcloud builds submit --config=cloudbuild-expressServer.yaml --project=${projectId}
    gcloud builds submit --config=cloudbuild-webClient.yaml     --project=${projectId}
`);
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

  const projectId   = args['project-id'];
  const projectName = args['project-name'] || projectId;
  const billing     = args.billing;
  const region      = args.region || 'us-central';
  const branch      = args.branch || '^main$';
  const ghOwner     = args['github-owner'];
  const ghRepo      = args['github-repo'];
  const secretsArg  = args.secrets;

  checkPrereqs();
  ensureProject(projectId, projectName);
  ensureBilling(projectId, billing);
  setActiveProject(projectId);

  if (!args['skip-apis'])      enableApis(projectId);
  if (!args['skip-appengine']) ensureAppEngine(projectId, region);
  if (!args['skip-iam'])       grantDeployIam(projectId);

  if (ghOwner && ghRepo) createBuildTriggers(projectId, ghOwner, ghRepo, branch);
  else if (ghOwner || ghRepo) warn('Need both --github-owner and --github-repo to create triggers — skipping.');

  if (secretsArg) {
    const names = secretsArg.split(',').map((s) => s.trim()).filter(Boolean);
    if (names.length) await createSecrets(projectId, names);
  }

  printSummary(projectId, region);
}

main().catch((e) => {
  console.error(`\n${C.red}${C.bold}✗ Bootstrap failed:${C.reset} ${e.message}`);
  process.exit(1);
});
