const path = require('node:path');
const webpack = require('webpack');

module.exports = (_env, argv) => {
  const isProd = argv.mode === 'production';
  return {
    mode: argv.mode || 'development',
    entry: './src/app.tsx',
    output: {
      path: path.resolve(__dirname, 'public'),
      filename: 'app.js',
      clean: false,
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
    ],
  };
};
