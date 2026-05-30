const path = require('node:path');
const fs = require('node:fs');
const webpack = require('webpack');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const CopyWebpackPlugin = require('copy-webpack-plugin');

const PUBLIC_DIR = path.resolve(__dirname, 'public');
const CERT_DIR = path.resolve(__dirname, '..', 'server', 'keys', 'security_certificate');

function readDevCerts() {
  const keyPath = path.join(CERT_DIR, 'localhost-key.pem');
  const certPath = path.join(CERT_DIR, 'localhost.pem');
  if (!fs.existsSync(keyPath) || !fs.existsSync(certPath)) return null;
  return {
    key: fs.readFileSync(keyPath),
    cert: fs.readFileSync(certPath),
  };
}

module.exports = (_env, argv) => {
  const isProd = argv.mode === 'production';
  const certs = isProd ? null : readDevCerts();

  return {
    mode: argv.mode || 'development',
    entry: './src/app.tsx',
    output: {
      path: path.resolve(__dirname, 'dist'),
      filename: 'app.js',
      publicPath: '/',
      clean: true,
    },
    module: {
      rules: [
        {
          test: /\.[jt]sx?$/,
          exclude: /node_modules/,
          use: {
            loader: 'babel-loader',
            options: {
              presets: [
                ['@babel/preset-env', { targets: 'defaults' }],
                ['@babel/preset-react', { runtime: 'automatic' }],
                '@babel/preset-typescript',
              ],
            },
          },
        },
        {
          test: /\.css$/,
          use: [
            'style-loader',
            {
              loader: 'css-loader',
              options: {
                modules: {
                  // CSS Modules only for *.module.css; plain *.css stays global.
                  auto: true,
                  namedExport: false,
                  exportLocalsConvention: 'camelCaseOnly',
                  localIdentName: '[name]__[local]--[hash:base64:5]',
                },
              },
            },
          ],
        },
      ],
    },
    resolve: {
      extensions: ['.ts', '.tsx', '.js', '.jsx'],
      // Imports use .js extensions (NodeNext-style); resolve .ts/.tsx first.
      extensionAlias: {
        '.js': ['.ts', '.tsx', '.js'],
      },
      alias: {
        // Match the tsconfig path mapping so @shared/* works in source.
        '@shared': path.resolve(__dirname, '..', 'TypesAndInterfaces'),
      },
    },
    plugins: [
      new webpack.DefinePlugin({
        __API_BASE_URL__: JSON.stringify(
          process.env.API_BASE_URL ?? (isProd ? '' : 'https://localhost:3030'),
        ),
      }),
      // isomorphic-git's browser ESM build uses Buffer as a global without importing it.
      // Provide the npm `buffer` polyfill so its 76 uses of Buffer.from / Buffer.isBuffer work.
      new webpack.ProvidePlugin({
        Buffer: ['buffer', 'Buffer'],
      }),
      new HtmlWebpackPlugin({
        template: path.join(PUBLIC_DIR, 'index.html'),
        inject: 'body',
      }),
      new CopyWebpackPlugin({
        patterns: [
          {
            from: PUBLIC_DIR,
            to: path.resolve(__dirname, 'dist'),
            // index.html is handled by HtmlWebpackPlugin; everything else
            // (styles.css, favicon, etc.) is copied verbatim.
            globOptions: { ignore: ['**/index.html'] },
            noErrorOnMissing: true,
          },
        ],
      }),
    ],
    devServer: {
      port: 7654,
      host: 'localhost',
      // Hot-compile but DON'T auto-refresh the browser. webpack-dev-server still
      // rebuilds the in-memory bundle on every save; with hot + liveReload off it
      // never reloads the page, so you refresh manually to pick up changes — and
      // whatever's on screen (used as a working reference) is never lost.
      hot: false,
      liveReload: false,
      historyApiFallback: true,
      // In dev, webpack-dev-server keeps the bundle in memory. We also expose
      // `public/` as a static directory so styles.css and other hand-written
      // assets resolve without needing a Copy step on every change.
      static: { directory: PUBLIC_DIR, watch: true },
      ...(certs && {
        server: { type: 'https', options: certs },
      }),
      client: { overlay: { errors: true, warnings: false } },
    },
  };
};
