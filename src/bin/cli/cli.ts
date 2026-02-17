#!/usr/bin/env node

import { colorize } from 'json-colorizer';
import { killSockets } from 'sockdestroy';
import { Agent, request } from 'undici';
import consola from 'consola';
import fs from 'fs';

const enum CLI_ACTIONS {
    DUMP_CONFIG = 'dump-config',
    EXIT = 'exit',
    KILL_SOCKETS = 'kill-sockets',
}

function loadEnvFromMainProcess(): { socketPath?: string; token?: string } {
    try {
        const environ = fs.readFileSync('/proc/1/environ', 'utf8');
        const envVars = environ.split('\0').reduce(
            (acc, pair) => {
                const [key, value] = pair.split('=');
                if (key && value) acc[key] = value;
                return acc;
            },
            {} as Record<string, string>,
        );

        return {
            socketPath: envVars.INTERNAL_SOCKET_PATH,
            token: envVars.INTERNAL_REST_TOKEN,
        };
    } catch {
        return {};
    }
}

async function dumpConfig() {
    try {
        const mainProcessEnv = loadEnvFromMainProcess();
        const socketPath = mainProcessEnv.socketPath;
        const token = mainProcessEnv.token;

        if (!socketPath || !token) {
            consola.error('Missing environment variables.');
            process.exit(1);
        }

        consola.start('Dumping cold XRay configuration...');

        const agent = new Agent({
            connect: {
                socketPath: socketPath,
            },
        });

        const { body, statusCode } = await request(
            `http://localhost/internal/get-config?token=${token}`,
            { dispatcher: agent },
        );

        if (statusCode !== 200) {
            consola.fail(`Failed to fetch configuration with status ${statusCode}`);
            process.exit(1);
        }

        const config = (await body.json()) as Record<string, unknown>;

        if (!config || Object.keys(config).length === 0) {
            consola.warn('Configuration is empty.');
            return;
        }

        consola.success('Configuration retrieved successfully!\n');
        consola.log(colorize(JSON.stringify(config, null, 2)));
        consola.success('Configuration dumped successfully!');
    } catch (error) {
        consola.fail('Failed to fetch configuration');
        if (error instanceof Error) {
            consola.error(error.message);
        }
        process.exit(1);
    }
}

async function killSocketsByIP() {
    try {
        const ipAddress = await consola.prompt('Enter IP address to kill sockets for:', {
            type: 'text',
            required: true,
            placeholder: '1.1.1.1',
        });

        const targetIP = `::ffff:${ipAddress}`;

        consola.start(`Killing sockets for IP: ${ipAddress} (${targetIP})...`);

        const result = await killSockets({ src: targetIP, dst: targetIP });

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
        case '--kill-sockets':
        case '-k':
            return CLI_ACTIONS.KILL_SOCKETS;
        case '--help':
        case '-h':
            consola.log(`
Usage: cli [command]

Commands:
  --dump-config, -d    Dump current XRay configuration
  --kill-sockets, -k   Kill sockets by IP address
  --help, -h           Show this help message
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
