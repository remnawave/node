#!/usr/bin/env node

import { colorize } from 'json-colorizer';
import { killSockets } from 'sockdestroy';
import consola from 'consola';
import http from 'node:http';
import fs from 'fs';

const enum CLI_ACTIONS {
    DUMP_CONFIG = 'dump-config',
    DUMP_CONFIG_RAW = 'dump-config-raw',
    EXIT = 'exit',
    KILL_SOCKETS = 'kill-sockets',
}

const S6_CONTAINER_ENV_DIR = '/run/s6/container_environment';

function readFromS6Env(name: string): string | undefined {
    try {
        return fs.readFileSync(`${S6_CONTAINER_ENV_DIR}/${name}`, 'utf8').replace(/\n$/, '');
    } catch {
        return undefined;
    }
}

function loadInternalEnv(): { socketPath?: string; token?: string } {
    const resolve = (name: string): string | undefined => process.env[name] || readFromS6Env(name);

    return {
        socketPath: resolve('INTERNAL_SOCKET_PATH'),
        token: resolve('INTERNAL_REST_TOKEN'),
    };
}

function requestOverSocket(
    socketPath: string,
    path: string,
    timeoutMs = 5000,
): Promise<{ statusCode: number; body: string }> {
    return new Promise((resolve, reject) => {
        const req = http.request(
            {
                socketPath: `\0${socketPath}`,
                path,
                method: 'GET',
                timeout: timeoutMs,
                headers: { accept: 'application/json' },
            },
            (res) => {
                let data = '';
                res.setEncoding('utf8');
                res.on('data', (chunk) => (data += chunk));
                res.on('end', () => resolve({ statusCode: res.statusCode ?? 0, body: data }));
                res.on('error', reject);
            },
        );

        req.on('timeout', () => req.destroy(new Error(`Request timed out after ${timeoutMs}ms`)));
        req.on('error', reject);
        req.end();
    });
}

async function dumpConfig({ raw = false }: { raw?: boolean } = {}) {
    const fail = (message: string): never => {
        if (raw) {
            process.stderr.write(`${message}\n`);
        } else {
            consola.fail(message);
        }
        process.exit(1);
    };

    const { socketPath, token } = loadInternalEnv();

    if (!socketPath || !token) {
        fail('Missing environment variables.');
    }

    if (!raw) {
        consola.start('Dumping cold XRay configuration...');
    }

    let response: { statusCode: number; body: string };
    try {
        response = await requestOverSocket(
            socketPath!,
            `/internal/get-config?token=${encodeURIComponent(token!)}`,
        );
    } catch (error) {
        fail(error instanceof Error ? error.message : 'Failed to fetch configuration');
        return;
    }

    if (response.statusCode !== 200) {
        fail(`Failed to fetch configuration with status ${response.statusCode}`);
    }

    if (raw) {
        process.stdout.write(response.body);
        if (!response.body.endsWith('\n')) {
            process.stdout.write('\n');
        }
        return;
    }

    const config = JSON.parse(response.body) as Record<string, unknown>;

    if (!config || Object.keys(config).length === 0) {
        consola.warn('Configuration is empty.');
        return;
    }

    consola.success('Configuration retrieved successfully!\n');
    consola.log(colorize(JSON.stringify(config, null, 2)));
    consola.success('Configuration dumped successfully!');
}

async function killSocketsByIP() {
    try {
        const ipAddress = await consola.prompt('Enter IP address to kill sockets for:', {
            type: 'text',
            required: true,
            placeholder: '1.1.1.1',
        });

        consola.start(`Killing sockets for IP: ${ipAddress}...`);

        const result = await killSockets({ src: ipAddress, dst: ipAddress, mode: 'or' });

        consola.success(colorize(JSON.stringify(result, null, 2)));
    } catch (error) {
        consola.fail('Failed to kill sockets');
        if (error instanceof Error) {
            consola.error(error.message);
        }
        process.exit(1);
    }
}

async function main() {
    consola.box('Remnawave Node CLI v0.1');

    const action = await consola.prompt('Select an action', {
        type: 'select',
        required: true,
        options: [
            {
                value: CLI_ACTIONS.DUMP_CONFIG,
                label: 'Dump cold XRay Config',
                hint: '',
            },
            {
                value: CLI_ACTIONS.KILL_SOCKETS,
                label: 'Kill sockets by IP',
                hint: 'Drop connections for specific IP address',
            },
            {
                value: CLI_ACTIONS.EXIT,
                label: 'Exit',
            },
        ],
        initial: CLI_ACTIONS.EXIT,
    });

    switch (action) {
        case CLI_ACTIONS.DUMP_CONFIG:
            await dumpConfig();
            break;

        case CLI_ACTIONS.KILL_SOCKETS:
            await killSocketsByIP();
            break;

        case CLI_ACTIONS.EXIT:
            consola.info('👋 Exiting...');
            process.exit(0);
    }
}
function parseArgs(): CLI_ACTIONS | null {
    const args = process.argv.slice(2);
    if (args.length === 0) return null;

    const arg = args[0];
    switch (arg) {
        case '--dump-config':
        case '-d':
            return CLI_ACTIONS.DUMP_CONFIG;
        case '--dump-config-raw':
        case '-D':
            return CLI_ACTIONS.DUMP_CONFIG_RAW;
        case '--kill-sockets':
        case '-k':
            return CLI_ACTIONS.KILL_SOCKETS;
        case '--help':
        case '-h':
            consola.log(`
Usage: cli [command]

Commands:
  --dump-config, -d         Dump current XRay configuration (pretty, colored)
  --dump-config-raw, -D     Dump raw XRay configuration to stdout (machine-readable, pipeable)
  --kill-sockets, -k        Kill sockets by IP address
  --help, -h                Show this help message
`);
            process.exit(0);
        default:
            consola.error(`Unknown command: ${arg}`);
            process.exit(1);
    }
}

const cliAction = parseArgs();
if (cliAction === CLI_ACTIONS.DUMP_CONFIG) {
    dumpConfig().catch((e) => {
        consola.error('❌ An error occurred:', e);
        process.exit(1);
    });
} else if (cliAction === CLI_ACTIONS.DUMP_CONFIG_RAW) {
    dumpConfig({ raw: true }).catch((e) => {
        process.stderr.write(`${e instanceof Error ? e.message : String(e)}\n`);
        process.exit(1);
    });
} else if (cliAction === CLI_ACTIONS.KILL_SOCKETS) {
    killSocketsByIP().catch((e) => {
        consola.error('❌ An error occurred:', e);
        process.exit(1);
    });
} else {
    main().catch(async (e) => {
        consola.error('❌ An error occurred:', e);
        process.exit(1);
    });
}
