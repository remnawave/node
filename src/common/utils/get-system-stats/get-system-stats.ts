import os from 'node:os';

import { THostInfo, THotHostInfo } from '@libs/contracts/models';

export function getHostInfo(): THostInfo {
    const cpus = os.cpus();
    return {
        arch: os.arch(),
        cpus: cpus.length,
        cpuModel: cpus[0]?.model ?? 'unknown',
        memoryTotal: os.totalmem(),
        hostname: os.hostname(),
        platform: os.platform(),
        release: os.release(),
        type: os.type(),
        version: os.version(),
        networkInterfaces: Object.keys(os.networkInterfaces()),
    };
}

export function getHotHostInfo(): THotHostInfo {
    return {
        memoryFree: os.freemem(),
        uptime: os.uptime(),
    };
}
