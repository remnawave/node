import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { describe, it } from 'node:test';

const root = fileURLToPath(new URL('../', import.meta.url));

const readProjectFile = (path) => readFileSync(join(root, path), 'utf8');

describe('WARP contract shape', () => {
    it('declares WARP routes and system stats field', () => {
        const routes = readProjectFile('libs/contract/api/routes.ts');
        const controllers = readProjectFile('libs/contract/api/controllers/index.ts');
        const commands = readProjectFile('libs/contract/commands/index.ts');
        const nodeSystem = readProjectFile('libs/contract/models/node-system.schema.ts');

        assert.match(controllers, /warp/);
        assert.match(routes, /WARP/);
        assert.match(routes, /STATUS/);
        assert.match(routes, /ENABLE/);
        assert.match(routes, /DISABLE/);
        assert.match(commands, /warp/);
        assert.match(nodeSystem, /WarpStatusSchema/);
        assert.match(nodeSystem, /warp: z\.optional/);
    });

    it('declares WARP service without a generic command executor', () => {
        const service = readProjectFile('src/modules/warp/warp.service.ts');
        const controller = readProjectFile('src/modules/warp/warp.controller.ts');
        const module = readProjectFile('src/modules/warp/warp.module.ts');

        assert.match(service, /class WarpService/);
        assert.match(service, /execFile/);
        assert.match(service, /getStatus/);
        assert.match(service, /enable/);
        assert.match(service, /disable/);
        assert.doesNotMatch(service, /executeCommand/);
        assert.doesNotMatch(service, /runShell/);
        assert.match(controller, /class WarpController/);
        assert.match(module, /class WarpModule/);
    });
});
