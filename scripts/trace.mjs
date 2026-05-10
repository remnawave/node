import { traceNodeModules } from 'nf3';

await traceNodeModules(['./dist/main.js', './dist/cli.js'], { outDir: 'dist' });
