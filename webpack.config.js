const webpack = require('webpack');
const TerserPlugin = require('terser-webpack-plugin');
const pkg = require('./package.json');

module.exports = function (options) {
    return {
        ...options,
        entry: {
            main: options.entry ?? './src/main.ts',
            cli: './src/bin/cli/cli.ts',
        },
        output: {
            ...options.output,
            filename: '[name].js',
        },
        optimization: {
            minimize: true,
            runtimeChunk: false,
            splitChunks: false,
            minimizer: [
                new TerserPlugin({
                    parallel: true,
                    terserOptions: {
                        keep_classnames: true,
                        keep_fnames: true,
                    },
                }),
            ],
        },
        plugins: [
            ...(options.plugins ?? []),
            new webpack.DefinePlugin({
                __RWNODE_VERSION__: JSON.stringify(pkg.version),
            }),
            new webpack.BannerPlugin({
                banner: '#!/usr/bin/env node',
                raw: true,
                entryOnly: true,
                include: /cli\.js$/,
            }),
        ],
    };
};
