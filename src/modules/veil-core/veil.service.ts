import { ProcessInfo } from '@kastov/node-supervisord/dist/interfaces';
import { SupervisordClient } from '@kastov/node-supervisord';
import { readPackageJSON } from 'pkg-types';
import * as crypto from 'node:crypto';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { table } from 'table';
import ems from 'enhanced-ms';
import pRetry from 'p-retry';
import semver from 'semver';

import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { InjectSupervisord } from '@remnawave/supervisord-nestjs';

import { getSystemInfo, getSystemStats } from '@common/utils/get-system-stats';
import { ICommandResponse } from '@common/types/command-response.type';
import { StartVeilCommand } from '@libs/contracts/commands';

import {
    GetNodeHealthCheckVeilResponseModel,
    StartVeilResponseModel,
    StopVeilResponseModel,
} from './models';

const VEIL_PROCESS_NAME = 'veil' as const;
const DEFAULT_ADMIN_ADDR = '127.0.0.1:9090' as const;
const SERVER_CONFIG_PATH = '/etc/veil/server.yaml' as const;

@Injectable()
export class VeilService implements OnApplicationBootstrap {
    private readonly logger = new Logger(VeilService.name);

    private readonly veilPath: string;

    private veilVersion: null | string = null;
    private isVeilOnline: boolean = false;
    private isVeilStartedProccesing: boolean = false;
    private nodeVersion: string = '0.0.0';
    private currentConfigHash: null | string = null;
    private currentAdminAddr: string = DEFAULT_ADMIN_ADDR;

    constructor(
        @InjectSupervisord() private readonly supervisordApi: SupervisordClient,
        private readonly configService: ConfigService,
    ) {
        this.veilPath =
            this.configService.get<string>('VEIL_BINARY_PATH') ?? '/usr/local/bin/veil';
    }

    async onApplicationBootstrap() {
        try {
            const pkg = await readPackageJSON();

            this.veilVersion = await this.detectVeilVersion();
            this.nodeVersion = pkg.version ?? '0.0.0';

            await this.supervisordApi.getState();
        } catch (error: unknown) {
            if (
                error !== null &&
                typeof error === 'object' &&
                'code' in error &&
                error.code === 'ENOENT'
            ) {
                this.logger.error('Supervisord socket file not found, exiting...');
                process.exit(1);
            }

            this.logger.error(`Error in Application Bootstrap: ${error}`);
        }

        this.isVeilOnline = false;
    }

    public async startVeil(
        body: StartVeilCommand.Request,
        ip: string,
    ): Promise<ICommandResponse<StartVeilResponseModel>> {
        const tm = performance.now();
        const system = {
            info: getSystemInfo(),
            stats: getSystemStats(),
            interface: { rxBytes: 0, txBytes: 0 },
        };

        try {
            if (this.isVeilStartedProccesing) {
                this.logger.warn('Request already in progress');
                return {
                    isOk: true,
                    response: new StartVeilResponseModel(
                        false,
                        this.veilVersion,
                        'Request already in progress',
                        { version: this.nodeVersion },
                        system,
                    ),
                };
            }

            this.isVeilStartedProccesing = true;

            // Short-circuit when the running config matches what the
            // panel is asking for. Restarting an active veil-server
            // thrashes every connected user's session, so we only do
            // it when the operator explicitly requested it
            // (forceRestart) or the config payload actually changed.
            if (
                this.isVeilOnline &&
                !body.internals.forceRestart &&
                this.currentConfigHash === body.internals.configHash
            ) {
                return {
                    isOk: true,
                    response: new StartVeilResponseModel(
                        true,
                        this.veilVersion,
                        null,
                        { version: this.nodeVersion },
                        system,
                    ),
                };
            }

            if (body.internals.forceRestart) {
                this.logger.warn('Force restart requested');
            }

            // Persist the requested server.yaml and bump the cached
            // hash BEFORE asking supervisord to (re)start the daemon
            // so an immediate health probe sees the right config.
            await this.writeServerConfig(body.serverConfig);
            this.currentConfigHash = body.internals.configHash;
            this.currentAdminAddr = body.adminAddr ?? DEFAULT_ADMIN_ADDR;

            const veilProcess = await this.restartVeilProcess();

            if (veilProcess.error) {
                this.logger.error(veilProcess.error);

                return {
                    isOk: true,
                    response: new StartVeilResponseModel(
                        false,
                        null,
                        veilProcess.error,
                        { version: this.nodeVersion },
                        system,
                    ),
                };
            }

            let isStarted = await this.getVeilInternalStatus();

            if (!isStarted && veilProcess.processInfo!.state === 20) {
                isStarted = await this.getVeilInternalStatus();
            }

            if (!isStarted) {
                this.isVeilOnline = false;

                this.logger.error(
                    table(
                        [
                            ['Version', this.veilVersion],
                            ['Master IP', ip],
                            ['Internal Status', isStarted],
                            ['Error', veilProcess.error],
                        ],
                        {
                            header: {
                                content: 'Veil failed to start',
                                alignment: 'center',
                            },
                        },
                    ),
                );

                return {
                    isOk: true,
                    response: new StartVeilResponseModel(
                        isStarted,
                        this.veilVersion,
                        veilProcess.error,
                        { version: this.nodeVersion },
                        system,
                    ),
                };
            }

            this.isVeilOnline = true;

            this.logger.log(
                table(
                    [
                        ['Version', this.veilVersion],
                        ['Master IP', ip],
                        ['Admin', this.currentAdminAddr],
                    ],
                    {
                        header: {
                            content: 'Veil started',
                            alignment: 'center',
                        },
                    },
                ),
            );

            return {
                isOk: true,
                response: new StartVeilResponseModel(
                    isStarted,
                    this.veilVersion,
                    null,
                    { version: this.nodeVersion },
                    system,
                ),
            };
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : null;
            this.logger.error(`Failed to start Veil: ${errorMessage}`);

            return {
                isOk: true,
                response: new StartVeilResponseModel(
                    false,
                    null,
                    errorMessage,
                    { version: this.nodeVersion },
                    system,
                ),
            };
        } finally {
            this.logger.log(
                'Attempt to start Veil took: ' +
                    ems(performance.now() - tm, {
                        extends: 'short',
                        includeMs: true,
                    }),
            );

            this.isVeilStartedProccesing = false;
        }
    }

    public async stopVeil(args: {
        withOnlineCheck?: boolean;
    }): Promise<ICommandResponse<StopVeilResponseModel>> {
        const { withOnlineCheck = false } = args;
        try {
            if (withOnlineCheck && !this.isVeilOnline) {
                return {
                    isOk: true,
                    response: new StopVeilResponseModel(true),
                };
            }

            await this.killAllVeilProcesses();

            this.isVeilOnline = false;
            this.currentConfigHash = null;

            return {
                isOk: true,
                response: new StopVeilResponseModel(true),
            };
        } catch (error) {
            this.logger.error(`Failed to stop Veil Process: ${error}`);
            return {
                isOk: true,
                response: new StopVeilResponseModel(false),
            };
        }
    }

    public async getNodeHealthCheck(): Promise<
        ICommandResponse<GetNodeHealthCheckVeilResponseModel>
    > {
        try {
            return {
                isOk: true,
                response: new GetNodeHealthCheckVeilResponseModel(
                    true,
                    this.isVeilOnline,
                    this.veilVersion,
                    this.nodeVersion,
                ),
            };
        } catch (error) {
            this.logger.error(`Failed to get node health check: ${error}`);

            return {
                isOk: true,
                response: new GetNodeHealthCheckVeilResponseModel(
                    false,
                    false,
                    null,
                    this.nodeVersion,
                ),
            };
        }
    }

    public async killAllVeilProcesses(): Promise<void> {
        try {
            await this.supervisordApi.stopProcess(VEIL_PROCESS_NAME, true);

            this.logger.log('Supervisord: Veil processes killed.');
        } catch (error) {
            this.logger.log(
                `Supervisord: No existing Veil processes found. Error: ${error}`,
            );
        }
    }

    public getVeilInfo(): {
        version: string | null;
        path: string;
    } {
        return {
            version: this.veilVersion,
            path: this.veilPath,
        };
    }

    /**
     * Polls the veil daemon's admin /api/version endpoint until it
     * answers, capped at ~20s. Mirrors XrayService.getXrayInternalStatus
     * but talks HTTP rather than the XTLS gRPC stats API.
     */
    private async getVeilInternalStatus(): Promise<boolean> {
        try {
            return await pRetry(
                async () => {
                    const ok = await this.probeAdminApi();
                    if (!ok) {
                        throw new Error('admin /api/version did not respond OK');
                    }
                    return true;
                },
                {
                    retries: 10,
                    minTimeout: 2000,
                    maxTimeout: 2000,
                    onFailedAttempt: (error) => {
                        this.logger.debug(
                            `Get Veil internal status attempt ${error.attemptNumber} failed. ${error.retriesLeft} retries left.`,
                        );
                    },
                },
            );
        } catch (error) {
            this.logger.error(`Failed to get Veil internal status: ${error}`);
            return false;
        }
    }

    private async probeAdminApi(): Promise<boolean> {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 1500);
        try {
            const res = await fetch(`http://${this.currentAdminAddr}/api/version`, {
                signal: controller.signal,
            });
            return res.ok;
        } catch {
            return false;
        } finally {
            clearTimeout(timer);
        }
    }

    private async restartVeilProcess(): Promise<{
        processInfo: ProcessInfo | null;
        error: string | null;
    }> {
        try {
            const processState = await this.supervisordApi.getProcessInfo(VEIL_PROCESS_NAME);

            // 20 = RUNNING. Stop first so the next start picks up the
            // freshly-written /etc/veil/server.yaml.
            if (processState.state === 20) {
                await this.supervisordApi.stopProcess(VEIL_PROCESS_NAME, true);
            }

            await this.supervisordApi.startProcess(VEIL_PROCESS_NAME, true);

            return {
                processInfo: await this.supervisordApi.getProcessInfo(VEIL_PROCESS_NAME),
                error: null,
            };
        } catch (error) {
            return {
                processInfo: null,
                error: error instanceof Error ? error.message : 'Unknown error',
            };
        }
    }

    private async writeServerConfig(yaml: string): Promise<void> {
        await fs.mkdir(path.dirname(SERVER_CONFIG_PATH), { recursive: true });
        await fs.writeFile(SERVER_CONFIG_PATH, yaml, { mode: 0o600 });
        const computedHash = crypto.createHash('sha256').update(yaml).digest('hex');
        this.logger.debug(
            `Wrote server.yaml (${yaml.length}B, sha256=${computedHash.slice(0, 12)})`,
        );
    }

    private async detectVeilVersion(): Promise<null | string> {
        const fromEnv = semver.valid(semver.coerce(process.env.VEIL_CORE_VERSION));
        if (fromEnv) {
            return fromEnv;
        }
        try {
            const { execFile } = await import('node:child_process');
            const { promisify } = await import('node:util');
            const exec = promisify(execFile);
            const { stdout } = await exec(this.veilPath, ['--version']);
            return semver.valid(semver.coerce(stdout.trim()));
        } catch {
            return null;
        }
    }
}
