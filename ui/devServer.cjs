// Dev-time UI server.
//
// Runs `webpack --watch` and serves the resulting bundle from ui/public/ over
// HTTPS on port 7654. The server-side API runs separately at https://localhost:3030.
// CORS in server.ts has a dev-only exception for any localhost origin.
//
// The HTTPS certs are reused from the API server's keys/security_certificate/
// directory so the browser only needs to trust one set.

'use strict';

const fs = require('node:fs');
const path = require('node:path');
const https = require('node:https');
const webpack = require('webpack');

const PORT = 7654;
const PUBLIC_DIR = path.resolve(__dirname, 'public');
const CERT_DIR = path.resolve(__dirname, '..', 'server', 'keys', 'security_certificate');

const MIME = {
    '.html': 'text/html; charset=utf-8',
    '.js':   'application/javascript; charset=utf-8',
    '.css':  'text/css; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.svg':  'image/svg+xml',
    '.png':  'image/png',
    '.ico':  'image/x-icon',
    '.map':  'application/json; charset=utf-8',
};

function startWebpackWatch() {
    const configFactory = require('./webpack.config.cjs');
    const config = configFactory({}, { mode: 'development' });
    const compiler = webpack(config);
    compiler.watch({}, (err, stats) => {
        if (err) {
            console.error('[webpack]', err);
            return;
        }
        process.stdout.write(stats.toString({ colors: true, chunks: false, modules: false, assets: false }) + '\n');
    });
}

function startStaticServer() {
    const key = fs.readFileSync(path.join(CERT_DIR, 'localhost-key.pem'));
    const cert = fs.readFileSync(path.join(CERT_DIR, 'localhost.pem'));

    const server = https.createServer({ key, cert }, (req, res) => {
        const urlPath = decodeURIComponent((req.url || '/').split('?')[0]);
        const requested = urlPath === '/' ? '/index.html' : urlPath;
        const filePath = path.normalize(path.join(PUBLIC_DIR, requested));

        if (!filePath.startsWith(PUBLIC_DIR)) {
            res.writeHead(403);
            res.end('forbidden');
            return;
        }

        fs.readFile(filePath, (err, data) => {
            if (err) {
                // SPA fallback — unknown paths get index.html.
                fs.readFile(path.join(PUBLIC_DIR, 'index.html'), (e, idx) => {
                    if (e) { res.writeHead(404); res.end('not found'); return; }
                    res.writeHead(200, { 'Content-Type': MIME['.html'], 'Cache-Control': 'no-store' });
                    res.end(idx);
                });
                return;
            }
            const ext = path.extname(filePath).toLowerCase();
            res.writeHead(200, {
                'Content-Type': MIME[ext] || 'application/octet-stream',
                'Cache-Control': 'no-store',
            });
            res.end(data);
        });
    });

    server.listen(PORT, () => {
        console.log(`UI dev server listening on https://localhost:${PORT}`);
    });
}

startWebpackWatch();
startStaticServer();
