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
        assert.match(routes, /INSTALL/);
        assert.match(routes, /ENABLE/);
        assert.match(routes, /DISABLE/);
        assert.match(routes, /UNINSTALL/);
        assert.match(commands, /warp/);
        assert.match(nodeSystem, /WarpStatusSchema/);
        assert.match(nodeSystem, /HostConnectivitySchema/);
        assert.match(nodeSystem, /warp: z\.optional/);
        assert.match(nodeSystem, /host: z\.optional/);
    });

    it('declares WARP service without a generic command executor', () => {
        const service = readProjectFile('src/modules/warp/warp.service.ts');
        const controller = readProjectFile('src/modules/warp/warp.controller.ts');
        const module = readProjectFile('src/modules/warp/warp.module.ts');

        assert.match(service, /class WarpService/);
        assert.match(service, /spawn/);
        assert.match(service, /getStatus/);
        assert.match(service, /install/);
        assert.match(service, /enable/);
        assert.match(service, /disable/);
        assert.match(service, /uninstall/);
        assert.doesNotMatch(service, /executeCommand/);
        assert.doesNotMatch(service, /runShell/);
        assert.match(controller, /class WarpController/);
        assert.match(module, /class WarpModule/);
    });

    it('uses WireGuard runtime state for WARP status and safe control', () => {
        const service = readProjectFile('src/modules/warp/warp.service.ts');
        const compose = readProjectFile('docker-compose-prod.yml');
        const dockerfile = readProjectFile('Dockerfile');
        const nodeSystem = readProjectFile('libs/contract/models/node-system.schema.ts');

        assert.match(service, /show', WARP_INTERFACE, 'latest-handshakes'/);
        assert.match(service, /traceIpv4\?\.warp === 'on' && traceIpv6\?\.warp === 'on'/);
        assert.match(service, /if \(await this\.isInterfaceRunning\(\)\) \{/);
        assert.match(service, /link', 'delete', WARP_INTERFACE/);
        assert.match(service, /WARP_IPV6_ROUTE_METRIC = 4242/);
        assert.match(service, /PostUp = ip -6 route replace ::\/0 dev %i metric/);
        assert.match(service, /PreDown = ip -6 route del ::\/0 dev %i metric/);
        assert.match(service, /hasBoundIpv6RouteConfig/);
        assert.match(service, /getHostConnectivity/);
        assert.match(service, /operation/);
        assert.match(service, /appendOperationLog/);
        assert.match(service, /onOutput/);
        assert.match(service, /wgcf register --accept-tos/);
        assert.match(service, /wgcf update/);
        assert.match(service, /wgcf generate/);
        assert.doesNotMatch(service, /s#\^\(Address = \[\^,\]\+\),\.\*#\\1#/);
        assert.match(service, /WGCF_RELEASES_API_URL/);
        assert.match(service, /WARP_ENDPOINT = '162\.159\.192\.1:2408'/);
        assert.match(service, /Endpoint = \$\{WARP_ENDPOINT\}/);
        assert.doesNotMatch(service, /WARP_ENDPOINT = 'engage\.cloudflareclient\.com:2408'/);
        assert.doesNotMatch(service, /WARP_IPV6_ENDPOINT_ROUTE_POST_UP/);
        assert.match(service, /getTrace\('4'\)/);
        assert.match(service, /getTrace\('6'\)/);
        assert.match(service, /`\-\$\{ipVersion\}`/);
        assert.match(service, /'--interface',\s+WARP_INTERFACE/);
        assert.match(service, /hasDualStackConfig/);
        assert.match(service, /hasExpectedEndpointConfig/);
        assert.match(service, /hasDeprecatedIpv6EndpointRouteConfig/);
        assert.match(service, /!this\.hasDeprecatedIpv6EndpointRouteConfig\(\)/);
        assert.match(service, /getHostDefaultInterface/);
        assert.match(service, /`dev \$\{WARP_INTERFACE\}`/);
        assert.match(service, /'--interface', hostInterface/);
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
        assert.match(nodeSystem, /publicIpv4: z\.string\(\)\.nullable\(\)/);
        assert.match(nodeSystem, /publicIpv6: z\.string\(\)\.nullable\(\)/);
        assert.match(nodeSystem, /supportsIpv4: z\.boolean\(\)/);
        assert.match(nodeSystem, /supportsIpv6: z\.boolean\(\)/);
        assert.match(nodeSystem, /WarpOperationSchema/);
        assert.match(nodeSystem, /ipv4: WarpTraceSchema\.nullable\(\)/);
        assert.match(nodeSystem, /ipv6: WarpTraceSchema\.nullable\(\)/);
    });
});
