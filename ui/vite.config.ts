import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT_DIR = dirname(fileURLToPath(import.meta.url));
const SHARED_TYPES_DIR = resolve(ROOT_DIR, '..', 'TypesAndInterfaces');
const CERT_DIR = resolve(ROOT_DIR, '..', 'server', 'keys', 'security_certificate');

function readDevCerts() {
  const keyPath = join(CERT_DIR, 'localhost-key.pem');
  const certPath = join(CERT_DIR, 'localhost.pem');
  if (!existsSync(keyPath) || !existsSync(certPath)) return undefined;
  return { key: readFileSync(keyPath), cert: readFileSync(certPath) };
}

// Source imports use NodeNext-style .js extensions even for .ts/.tsx files (same
// convention as the server). Vite has no resolve.extensionAlias, so strip the .js
// and let the default resolver re-add .ts/.tsx — keeping the import style identical.
//
// Critically, this must only touch OUR source. esbuild's dep optimizer emits
// shared chunks that optimized deps import internally as `./chunk-XXXX.js` — those
// also start with `.` and end in `.js`. If we rewrite those, the optimized deps
// resolve to phantom files and the dev server thrashes with "chunk … does not
// exist" / "optimized info should be defined". The node_modules guard skips them.
function resolveNodeNextJsImports(): Plugin {
  return {
    name: 'resolve-nodenext-js-imports',
    enforce: 'pre',
    async resolveId(source, importer, options) {
      if (!importer || !source.endsWith('.js')) return null;
      if (importer.includes('node_modules')) return null;
      if (!source.startsWith('.') && !source.startsWith('@shared/')) return null;
      const resolved = await this.resolve(source.slice(0, -3), importer, {
        ...options,
        skipSelf: true,
      });
      return resolved ?? null;
    },
  };
}

export default defineConfig(({ mode }) => {
  const isProd = mode === 'production';
  const certs = isProd ? undefined : readDevCerts();

  return {
    plugins: [resolveNodeNextJsImports(), react()],
    resolve: {
      // Match the tsconfig path mapping so @shared/* works in source.
      alias: { '@shared': SHARED_TYPES_DIR },
    },
    css: {
      // CSS Modules only for *.module.css; plain *.css stays global. Mirror the
      // old webpack css-loader options so class access (`styles.someName`) and
      // `composes` behave identically after the migration.
      modules: {
        localsConvention: 'camelCaseOnly',
        generateScopedName: '[name]__[local]--[hash:base64:5]',
      },
    },
    // Pre-bundle the heavy deps up front so no dependency is discovered at
    // runtime. With HMR off (below), Vite can't signal the browser to reload
    // after a re-optimize, so a late-discovered dep would leave the page on a
    // stale bundle until a manual refresh. Listing the known deps here optimizes
    // them in the first pass and keeps the dep graph fixed.
    optimizeDeps: {
      include: [
        'react',
        'react-dom',
        'react-dom/client',
        '@mui/material',
        '@emotion/react',
        '@emotion/styled',
        'isomorphic-git',
        'diff',
        'node-diff3',
        'buffer',
      ],
    },
    define: {
      __API_BASE_URL__: JSON.stringify(
        process.env.API_BASE_URL ?? (isProd ? '' : 'https://localhost:3030'),
      ),
    },
    server: {
      port: 7654,
      host: 'localhost',
      // Rebuild modules on save but never auto-refresh: with HMR off the page only
      // updates on a manual reload, so whatever's on screen (a working reference) is
      // never lost. Vite still serves the latest module on the next request.
      hmr: false,
      ...(certs && { https: certs }),
    },
  };
});
