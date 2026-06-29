import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { existsSync } from 'node:fs';

import { Injectable, Logger } from '@nestjs/common';

const execFileAsync = promisify(execFile);

export interface IXrayProcessStatus {
    up: boolean;
    pid: number | null;
    raw: string;
}

@Injectable()
export class XrayProcessService {
    private readonly logger = new Logger(XrayProcessService.name);

    private readonly serviceDir: string;
    private readonly controlFifo: string;

    private static readonly S6_SVC = '/command/s6-svc';
    private static readonly S6_SVSTAT = '/command/s6-svstat';

    private static readonly DOWN_TIMEOUT_MS = 5_000;
    private static readonly UP_TIMEOUT_MS = 10_000;

    constructor() {
        this.serviceDir = process.env.XRAY_S6_SERVICE_DIR ?? '/run/service/xray';
        this.controlFifo = `${this.serviceDir}/supervise/control`;
    }

    public isControlAvailable(): boolean {
        return existsSync(this.controlFifo);
    }

    public async stop(): Promise<void> {
        await execFileAsync(XrayProcessService.S6_SVC, [
            '-wd',
            '-T',
            String(XrayProcessService.DOWN_TIMEOUT_MS),
            '-d',
            this.serviceDir,
        ]);
    }

    public async restart(): Promise<void> {
        await execFileAsync(XrayProcessService.S6_SVC, [
            '-wd',
            '-T',
            String(XrayProcessService.DOWN_TIMEOUT_MS),
            '-d',
            this.serviceDir,
        ]);
        await execFileAsync(XrayProcessService.S6_SVC, [
            '-wu',
            '-T',
            String(XrayProcessService.UP_TIMEOUT_MS),
            '-o',
            this.serviceDir,
        ]);
    }

    public async getStatus(): Promise<IXrayProcessStatus> {
        try {
            const { stdout } = await execFileAsync(XrayProcessService.S6_SVSTAT, [
                '-o',
                'up,pid',
                this.serviceDir,
            ]);

            const raw = stdout.trim();
            const [up, pid] = raw.split(/\s+/);
            const pidNum = Number(pid);

            return {
                up: up === 'true',
                pid: Number.isFinite(pidNum) && pidNum > 0 ? pidNum : null,
                raw,
            };
        } catch (error) {
            this.logger.warn(`Failed to read xray s6 status: ${error}`);
            return { up: false, pid: null, raw: '' };
        }
    }
}
