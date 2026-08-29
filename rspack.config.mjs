// @ts-check
import { defineConfig } from '@rspack/cli';
import { rspack } from '@rspack/core';
import path from 'node:path';
import { RunScriptWebpackPlugin } from 'run-script-webpack-plugin';
import { TsCheckerRspackPlugin } from 'ts-checker-rspack-plugin';
import nodeExternals from 'webpack-node-externals';

import pkg from './package.json' with { type: 'json' };

const isDev = process.env.NODE_ENV !== 'production';

if (isDev) {
    try {
        process.loadEnvFile('.env');
    } catch {}
}

export default defineConfig({
    context: import.meta.dirname,
    target: 'node',
    entry: {
        main: isDev ? ['@rspack/core/hot/poll?100', './src/main.ts'] : './src/main.ts',
        ...(isDev ? {} : { cli: './src/bin/cli/cli.ts' }),
    },
    output: {
        clean: true,
        filename: '[name].js',
    },
    resolve: {
        extensions: ['...', '.ts', '.tsx', '.jsx'],
        tsConfig: path.resolve(import.meta.dirname, './tsconfig.json'),
    },
    module: {
        rules: [
            {
                test: /\.ts$/,
                use: {
                    loader: 'builtin:swc-loader',
                    options: {
                        detectSyntax: 'auto',
                        jsc: {
                            parser: {
                                decorators: true,
                            },
                            transform: {
                                legacyDecorator: true,
                                decoratorMetadata: true,
                            },
                        },
                    },
                },
            },
        ],
    },
    optimization: {
        runtimeChunk: false,
        splitChunks: false,
        minimizer: [
            new rspack.SwcJsMinimizerRspackPlugin({
                minimizerOptions: {
                    compress: {
                        keep_classnames: true,
                        keep_fnames: true,
                    },
                    mangle: {
                        keep_classnames: true,
                        keep_fnames: true,
                    },
                },
            }),
        ],
    },
    externalsType: 'commonjs',
    plugins: [
        ...(isDev
            ? [
                  new RunScriptWebpackPlugin({
                      name: 'main.js',
                      autoRestart: false,
                  }),
                  new rspack.HotModuleReplacementPlugin(),
              ]
            : []),
        new rspack.DefinePlugin({
            __RWNODE_VERSION__: JSON.stringify(pkg.version),
        }),

        ...(isDev
            ? []
            : [
                  new rspack.BannerPlugin({
                      banner: '#!/usr/bin/env node',
                      raw: true,
                      entryOnly: true,
                      include: /cli\.js$/,
                  }),
              ]),
        new TsCheckerRspackPlugin({
            typescript: {
                configFile: path.resolve(import.meta.dirname, './tsconfig.json'),
                mode: 'readonly',
                build: false,
            },
        }),
    ],
    externals: [
        nodeExternals({
            allowlist: [/@rspack\/core\/hot\/poll/],
        }),
    ],
});
