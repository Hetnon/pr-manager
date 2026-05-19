import type { Request, Response } from 'express';
import { getUserToken } from '../../databases/databases.js';

// Smart-HTTP git proxy. Forwards the user's local git client (browser-side
// isomorphic-git) to https://github.com/<owner>/<repo>.git/... with the user's
// OAuth token attached as Authorization. The token never crosses to the browser.
//
// Two endpoints, mounted separately so middleware (raw body parser) can differ:
//   GET  /api/git-proxy/:owner/:repo/info/refs?service=git-receive-pack
//   POST /api/git-proxy/:owner/:repo/git-receive-pack   (raw binary body)

const ALLOWED_SERVICES = new Set(['git-receive-pack', 'git-upload-pack']);

export async function gitProxyInfoRefs(req: Request, res: Response): Promise<void> {
    const { owner, repo } = req.params as { owner: string; repo: string };
    const service = req.query.service;
    if (typeof service !== 'string' || !ALLOWED_SERVICES.has(service)) {
        res.status(400).send('invalid or missing service query param');
        return;
    }
    await forward(req, res, owner, repo, `info/refs?service=${encodeURIComponent(service)}`);
}

export async function gitProxyService(req: Request, res: Response): Promise<void> {
    const { owner, repo, service } = req.params as { owner: string; repo: string; service: string };
    if (!ALLOWED_SERVICES.has(service)) {
        res.status(400).send('invalid service');
        return;
    }
    await forward(req, res, owner, repo, service);
}

async function forward(req: Request, res: Response, owner: string, repo: string, pathSuffix: string): Promise<void> {
    const userEmail = req.session.userEmail!;
    const token = (await getUserToken(userEmail)) as string | null;
    if (!token) {
        res.status(401).send('No GitHub token stored — re-authenticate.');
        return;
    }

    const url = `https://github.com/${owner}/${repo}.git/${pathSuffix}`;

    // Git smart-HTTP wants HTTP Basic Auth, not Bearer. With an OAuth/PAT,
    // the convention is username=x-access-token, password=<token>.
    // Bearer works for api.github.com (REST) but github.com/<repo>.git/ returns
    // 401 "Bad credentials" with anything other than Basic.
    const basicAuth = Buffer.from(`x-access-token:${token}`).toString('base64');
    const headers: Record<string, string> = {
        Authorization: `Basic ${basicAuth}`,
        'User-Agent': 'pr-matrix-server',
    };
    const accept = req.get('Accept');
    if (accept) headers.Accept = accept;
    const contentType = req.get('Content-Type');
    if (contentType) headers['Content-Type'] = contentType;

    // For POST, body was parsed as raw bytes by bodyParser.raw on this route.
    // BodyInit per TS lib doesn't include Buffer/Uint8Array, but undici accepts
    // them at runtime — cast for the call.
    const reqBuf = req.method === 'POST' ? (req.body as Buffer) : undefined;
    const body = reqBuf as unknown as BodyInit | undefined;

    const response = await fetch(url, { method: req.method, headers, body });
    res.status(response.status);
    const respContentType = response.headers.get('content-type');
    if (respContentType) res.setHeader('Content-Type', respContentType);

    const respBuf = Buffer.from(await response.arrayBuffer());
    res.end(respBuf);
}
