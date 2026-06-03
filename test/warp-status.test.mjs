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
        assert.match(service, /spawn/);
        assert.match(service, /getStatus/);
        assert.match(service, /enable/);
        assert.match(service, /disable/);
        assert.doesNotMatch(service, /executeCommand/);
        assert.doesNotMatch(service, /runShell/);
        assert.match(controller, /class WarpController/);
        assert.match(module, /class WarpModule/);
    });

    it('uses WireGuard runtime state for WARP status and safe control', () => {
        const service = readProjectFile('src/modules/warp/warp.service.ts');
        const compose = readProjectFile('docker-compose-prod.yml');
        const dockerfile = readProjectFile('Dockerfile');

        assert.match(service, /show', WARP_INTERFACE, 'latest-handshakes'/);
        assert.match(service, /hasWireGuardHandshake \|\| trace\?\.warp === 'on'/);
        assert.match(service, /if \(await this\.isInterfaceRunning\(\)\) \{/);
        assert.match(service, /link', 'delete', WARP_INTERFACE/);
        assert.match(service, /wgcf register --accept-tos/);
        assert.match(service, /wgcf generate/);
        assert.match(service, /WGCF_RELEASES_API_URL/);
        assert.match(service, /WARP_ENDPOINT = '162\.159\.192\.1:2408'/);
        assert.match(service, /Endpoint = \$\{WARP_ENDPOINT\}/);
        assert.match(service, /normalizeWarpConfig/);
        assert.match(service, /stopRunningInterface/);
        assert.match(service, /install -m 600 wgcf-profile\.conf/);
        assert.match(service, /WARP_OUTPUT_TAIL_BYTES/);
        assert.match(service, /detached: true/);
        assert.match(service, /killProcessGroup/);
        assert.match(service, /process\.kill\(-pid, signal\)/);
        assert.doesNotMatch(service, /maxBuffer/);
        assert.doesNotMatch(service, /warp-native/);
        assert.match(compose, /\/etc\/wireguard:\/etc\/wireguard/);
        assert.match(dockerfile, /wireguard-tools/);
        assert.match(dockerfile, /iproute2/);
        assert.match(dockerfile, /openresolv/);
    });
});
