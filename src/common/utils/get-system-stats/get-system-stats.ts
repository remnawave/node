import os from 'node:os';

import { TNodeSystemInfo, TNodeSystemStats } from '@libs/contracts/models';

export function getSystemInfo(): TNodeSystemInfo {
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

export function getSystemStats(): TNodeSystemStats {
    return {
        memoryFree: os.freemem(),
        memoryUsed: os.totalmem() - os.freemem(),
        uptime: os.uptime(),
        loadAvg: os.loadavg(),
        interface: null,
    };
}
