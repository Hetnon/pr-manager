// External Dependencies
// Express 5 forwards async errors to the error handler natively — no polyfill needed.
import express, { type Request, type Response } from 'express';
import cors from 'cors';
import session, { type SessionOptions } from 'express-session';
import bodyParser from 'body-parser';
import https from 'node:https';
import fs from 'node:fs';
import path, { dirname } from 'node:path';
import cookieParser from 'cookie-parser';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Internal Dependencies
import { isProduction } from './config.js';
import { loadSecrets } from './infrastructure/secretManager/secretManager.js';
import { checkKmsAccess } from './infrastructure/kms/kmsEncryption.js';
import loadDatabaseMethods from './databases/databases.js';
import { createSessionConfig } from './expressSession/expressSession.js';
import {
    syncCSRFProtection,
    initializeCSRF,
    validateUser,
    validateAdmin,
} from './validationMiddleware/validationMiddleware.js';

const app = express();
app.disable('x-powered-by');
app.use(cookieParser());

app.get('/', (_req: Request, res: Response) => {
    res.status(200).send('pr-matrix server OK');
});

let isAppReady = false;

app.get('/readiness_check', (_req: Request, res: Response) => {
    if (isAppReady) res.status(200).send('readiness check ok');
    else res.status(503).send('still initializing');
});

app.get('/liveness_check', (_req: Request, res: Response) => {
    res.status(200).send('liveness check ok');
});

let server: https.Server | ReturnType<typeof app.listen> | undefined;

await initializeServer();

async function initializeServer(): Promise<void> {
    try {
        if (isProduction) {
            await startProductionConfigurations();
        } else {
            await startDevelopmentConfigurations();
        }
        await preflightKmsCheck();
        setupCORS();
        app.use(bodyParser.json({ limit: '5mb' }));

        await loadDatabaseMethods();

        const { getSessionStore } = await import('./databases/databases.js');
        const store = await getSessionStore();
        console.log('Session store initialized');

        const expressSessionConfig = createSessionConfig(store) as SessionOptions;
        app.use(session(expressSessionConfig));
        console.log('Session middleware initialized');

        initializeCSRF();

        // Observability — public so the UI can report client-side errors pre-auth
        const { errorHandler } = await import('./routes/Observability/errorHandler/errorHandler.js');
        const { logError } = await import('./routes/Observability/logError/logError.js');
        const { logBrowserInfo } = await import('./routes/Observability/logBrowserInfo/logBrowserInfo.js');
        const { getErrorLogList } = await import('./routes/Observability/getErrorLogList/getErrorLogList.js');
        app.post('/api/log-browser-info', logBrowserInfo);
        app.post('/api/log-error', logError);

        // Auth — public: the OAuth round-trip can't have a session yet
        const { githubLogin } = await import('./auth/github/login.js');
        const { githubCallback } = await import('./auth/github/callback.js');
        app.post('/api/auth/github/login', githubLogin);
        app.get('/api/auth/github/callback', githubCallback);

        // Session state endpoints — public (the UI asks before logging in)
        const { checkUserSession, terminateSession } = await import('./expressSession/expressSession.js');
        app.get('/api/check-user-session', checkUserSession);
        app.post('/api/terminate-session', terminateSession);

        // From here, every /api route is CSRF-protected
        app.use('/api', syncCSRFProtection);
        console.log('CSRF protection mounted for /api');

        // Admin-only routes
        app.get('/api/get-error-log-list', validateUser, validateAdmin, getErrorLogList);

        const { getUsersList } = await import('./routes/UserManagement/getUsersList/getUsersList.js');
        const { deleteUser } = await import('./routes/UserManagement/deleteUser/deleteUser.js');
        const { changeUserStatus } = await import('./routes/UserManagement/changeUserStatus/changeUserStatus.js');
        app.get('/api/get-users-list/:pageNumber/:usersPerPage', validateUser, validateAdmin, getUsersList);
        app.delete('/api/delete-user/:userEmail', validateUser, validateAdmin, deleteUser);
        app.patch('/api/change-user-status', validateUser, validateAdmin, changeUserStatus);

        // PR matrix — logged-in users only
        const { listPrs } = await import('./routes/prs/listPrs/listPrs.js');
        const { mergePr } = await import('./routes/prs/mergePr/mergePr.js');
        const { checkMasterConflicts } = await import('./routes/prs/checkMasterConflicts/checkMasterConflicts.js');
        const { createPr } = await import('./routes/prs/createPr/createPr.js');
        const { closePr } = await import('./routes/prs/closePr/closePr.js');
        const { deleteBranch } = await import('./routes/prs/deleteBranch/deleteBranch.js');
        app.get('/api/prs', validateUser, listPrs);
        app.post('/api/merge-pr', validateUser, mergePr);
        app.post('/api/master-conflicts', validateUser, checkMasterConflicts);
        app.post('/api/create-pr', validateUser, createPr);
        app.post('/api/close-pr', validateUser, closePr);
        app.post('/api/delete-branch', validateUser, deleteBranch);

        // Git smart-HTTP proxy — forwards browser-side isomorphic-git pushes to
        // github.com with the user's OAuth token attached server-side. POST body is
        // binary pack data; mount bodyParser.raw on the POST route only so the
        // global JSON parser doesn't touch it.
        const { gitProxyInfoRefs, gitProxyService } = await import('./routes/gitProxy/gitProxy.js');
        app.get('/api/git-proxy/:owner/:repo/info/refs', validateUser, gitProxyInfoRefs);
        app.post(
            '/api/git-proxy/:owner/:repo/:service',
            validateUser,
            bodyParser.raw({ type: '*/*', limit: '50mb' }),
            gitProxyService,
        );

        console.log('All routes mounted');

        app.use(errorHandler);
        startServer();
        isAppReady = true;
    } catch (error) {
        console.error('CRITICAL ERROR during server initialization:');
        console.error(error);
        process.exit(1);
    }
}

async function startProductionConfigurations(): Promise<void> {
    console.log('production environment');
    app.set('trust proxy', 1);
    await loadSecrets();
    console.log('secrets loaded');
}

async function preflightKmsCheck(): Promise<void> {
    const result = await checkKmsAccess();
    if (result.ok) {
        console.log(`KMS key reachable: ${result.keyName}`);
        return;
    }

    const banner = '='.repeat(70);
    if (result.reason === 'missing-credentials') {
        console.error(`\n${banner}`);
        console.error('✗ KMS access check failed: Application Default Credentials missing.');
        console.error('');
        console.error('The server needs Google Cloud KMS to envelope-encrypt GitHub OAuth tokens.');
        console.error('In dev, this uses your local ADC. Set them up once with:');
        console.error('');
        console.error('   gcloud auth application-default login');
        console.error('');
        console.error('Then restart the server.');
        console.error('');
        console.error(`KMS key: ${result.keyName}`);
        console.error(`${banner}\n`);
    } else if (result.reason === 'permission') {
        console.error(`\n${banner}`);
        console.error('✗ KMS access check failed: PERMISSION_DENIED.');
        console.error('');
        console.error('The current identity can reach KMS but is not authorised on the key.');
        console.error('Grant roles/cloudkms.cryptoKeyEncrypterDecrypter on:');
        console.error(`   ${result.keyName}`);
        console.error(`${banner}\n`);
    } else if (result.reason === 'not-found') {
        console.error(`\n${banner}`);
        console.error('✗ KMS access check failed: key not found.');
        console.error(`   KMS_KEY_NAME=${result.keyName}`);
        console.error('Re-run scripts/gcp-bootstrap.js to (re)create the keyring + key, or fix the env var.');
        console.error(`${banner}\n`);
    } else {
        console.error(`\n${banner}`);
        console.error(`✗ KMS access check failed: ${result.message}`);
        console.error(`   KMS_KEY_NAME=${result.keyName}`);
        console.error(`${banner}\n`);
    }

    // Refuse to keep booting — any auth flow would just crash later, hard to diagnose.
    process.exit(1);
}

async function startDevelopmentConfigurations(): Promise<void> {
    console.log('development environment');
    const dotenv = await import('dotenv');
    // .env.dev wins on key collisions (dotenv keeps the first value it sees).
    dotenv.config({ path: [path.join(__dirname, '.env.dev'), path.join(__dirname, '.env.shared')] });

    // Make the dev branch work even before .env.dev exists. The Firestore init,
    // session config, and CSRF setup all expect NODE_ENV to be a non-empty string.
    if (!process.env.NODE_ENV) process.env.NODE_ENV = 'development';

    const keyPath = path.join(__dirname, 'keys', 'security_certificate', 'localhost-key.pem');
    const certPath = path.join(__dirname, 'keys', 'security_certificate', 'localhost.pem');
    if (fs.existsSync(keyPath) && fs.existsSync(certPath)) {
        const key = fs.readFileSync(keyPath);
        const cert = fs.readFileSync(certPath);
        server = https.createServer({ key, cert }, app);
    } else {
        console.warn('No dev HTTPS certs found at keys/security_certificate/. Generate with mkcert. Falling back to HTTP — sessions will not work because cookies are secure-only.');
    }
}

function startServer(): void {
    if (isProduction) {
        const port = Number(process.env.PORT_TO_USE ?? process.env.PORT ?? 8080);
        server = app.listen(port, '0.0.0.0', () => {
            console.log(`Production server listening on port ${port}`);
        });
    } else {
        const port = Number(process.env.PORT ?? 3030);
        if (server) {
            (server as https.Server).listen(port, () => {
                console.log(`Dev HTTPS server listening on port ${port}`);
            });
        } else {
            server = app.listen(port, () => {
                console.log(`Dev HTTP server listening on port ${port} (no certs found)`);
            });
        }
    }
}

function setupCORS(): void {
    console.log('setting up CORS');
    const allowedOrigins = (process.env.ALLOWED_ORIGINS ?? '').split(',').map((s) => s.trim()).filter(Boolean);

    app.use(
        cors({
            origin: (origin, callback) => {
                // Dev convenience: allow any localhost origin (any port). The UI's
                // `npm run watch` server (port 7654) lives at a different port from
                // this API (3030), and we don't want to maintain a parallel list.
                const isLocalhostDev = !isProduction && !!origin
                    && /^https?:\/\/localhost(:\d+)?$/i.test(origin);

                if (!origin || isLocalhostDev || allowedOrigins.includes(origin)) {
                    callback(null, true);
                } else {
                    console.error('Incoming http request from not allowed origin:', origin);
                    callback(new Error(`${origin} not allowed by CORS`));
                }
            },
            methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
            allowedHeaders: ['Content-Type', 'Authorization', 'CSRF-Token'],
            optionsSuccessStatus: 204,
            credentials: true,
        }),
    );
}
