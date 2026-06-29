import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import ems from 'enhanced-ms';
import pRetry from 'p-retry';
import semver from 'semver';

import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { CommandBus, QueryBus } from '@nestjs/cqrs';
import { ConfigService } from '@nestjs/config';

import { InjectXtls } from '@remnawave/xtls-sdk-nestjs';
import { XtlsApi } from '@remnawave/xtls-sdk';

import { getSystemInfo, getSystemStats } from '@common/utils/get-system-stats';
import { ICommandResponse } from '@common/types/command-response.type';
import { generateApiConfig } from '@common/utils/generate-api-config';
import { StartXrayCommand } from '@libs/contracts/commands';
import { KNOWN_ERRORS } from '@libs/contracts/constants';

import {
    GetNodeHealthCheckResponseModel,
    StartXrayResponseModel,
    StopXrayResponseModel,
} from './models';
import { GetInterfaceStatsQuery } from '../network-stats/queries/get-interface-stats/get-interface-stats.query';
import { ResetPluginsCommand } from '../_plugin/commands/reset-plugins/reset-plugins.command';
import { GetTorrentBlockerStateQuery } from '../_plugin/queries/get-torrent-blocker-state';
import { InternalService } from '../internal/internal.service';
import { XrayProcessService } from './xray-process.service';

const XRAY_LOG_FILE = '/var/log/xray/current' as const;
const execFileAsync = promisify(execFile);

@Injectable()
export class XrayService implements OnApplicationBootstrap {
    private readonly logger = new Logger(XrayService.name);
    private readonly disableHashedSetCheck: boolean;
    private readonly internal: {
        socketPath: string;
        token: string;
        xtlsApiSocketPath: string;
    };

    private readonly xrayPath: string;

    private xrayVersion: null | string = null;
    private isXrayOnline: boolean = false;
    private isXrayStartedProccesing: boolean = false;
    private nodeVersion: string = '0.0.0';
    constructor(
        @InjectXtls() private readonly xtlsSdk: XtlsApi,
        private readonly xrayProcess: XrayProcessService,
        private readonly internalService: InternalService,
        private readonly configService: ConfigService,
        private readonly queryBus: QueryBus,
        private readonly commandBus: CommandBus,
    ) {
        this.internal = {
            socketPath: this.configService.getOrThrow<string>('INTERNAL_SOCKET_PATH'),
            token: this.configService.getOrThrow<string>('INTERNAL_REST_TOKEN'),
            xtlsApiSocketPath: this.configService.getOrThrow<string>('XTLS_API_SOCKET_PATH'),
        };

        this.xrayPath = '/usr/local/bin/xray';
        this.xrayVersion = null;

        this.isXrayStartedProccesing = false;
        this.disableHashedSetCheck = this.configService.getOrThrow<boolean>(
            'DISABLE_HASHED_SET_CHECK',
        );
    }

    async onApplicationBootstrap() {
        try {
            this.xrayVersion = this.getXrayVersionFromEnv();
            this.nodeVersion = __RWNODE_VERSION__ ?? '0.0.0';

            if (!this.xrayProcess.isControlAvailable()) {
                this.logger.error('s6 xray control socket not found, exiting...');
                process.exit(1);
            }
        } catch (error: unknown) {
            this.logger.error(`Error in Application Bootstrap: ${error}`);
        }

        this.isXrayOnline = false;
    }

    public async startXray(
        body: StartXrayCommand.Request,
        ip: string,
    ): Promise<ICommandResponse<StartXrayResponseModel>> {
        const interfaceStats = await this.queryBus.execute(new GetInterfaceStatsQuery());
        const tm = performance.now();
        const system = {
            info: getSystemInfo(),
            stats: getSystemStats(),
            interface: interfaceStats,
        };

        if (this.isXrayStartedProccesing) {
            this.logger.warn('Request already in progress');
            return {
                isOk: true,
                response: new StartXrayResponseModel(
                    false,
                    this.xrayVersion,
                    'Request already in progress',
                    {
                        version: this.nodeVersion,
                    },
                    system,
                ),
            };
        }

        this.isXrayStartedProccesing = true;

        try {
            if (this.isXrayOnline && !this.disableHashedSetCheck && !body.internals.forceRestart) {
                const { isOk } = await this.xtlsSdk.stats.getSysStats();

                let shouldRestart = false;

                if (isOk) {
                    shouldRestart = this.internalService.isNeedRestartCore(body.internals.hashes);
                } else {
                    this.isXrayOnline = false;
                    shouldRestart = true;

                    this.logger.warn(`Xray Core health check failed, restarting...`);
                }

                if (!shouldRestart) {
                    return {
                        isOk: true,
                        response: new StartXrayResponseModel(
                            true,
                            this.xrayVersion,
                            null,
                            {
                                version: this.nodeVersion,
                            },
                            system,
                        ),
                    };
                }
            }

            if (body.internals.forceRestart) {
                this.logger.warn('Force restart requested');
            }

            const isTorrentBlockerEnabled = await this.queryBus.execute(
                new GetTorrentBlockerStateQuery(),
            );

            const fullConfig = generateApiConfig({
                config: body.xrayConfig,
                torrentBlockerState: isTorrentBlockerEnabled,
                internal: this.internal,
            });

            await this.internalService.extractUsersFromConfig(body.internals.hashes, fullConfig);

            const xrayProcess = await this.restartXrayProcess();

            if (xrayProcess.error) {
                this.logger.error(`Failed to (re)start Xray process via s6: ${xrayProcess.error}`);

                return {
                    isOk: true,
                    response: new StartXrayResponseModel(
                        false,
                        null,
                        xrayProcess.error,
                        { version: this.nodeVersion },
                        system,
                    ),
                };
            }

            const isStarted = await this.getXrayInternalStatus();

            if (!isStarted) {
                this.isXrayOnline = false;

                this.logger.error(`Xray Core v${this.xrayVersion} failed to start.`, {
                    timestamp: new Date().toISOString(),
                    ...KNOWN_ERRORS.XRAY_FAILED_TO_START,
                });

                await this.dumpTailBlock(XRAY_LOG_FILE, 5);

                return {
                    isOk: true,
                    response: new StartXrayResponseModel(
                        isStarted,
                        this.xrayVersion,
                        'Xray Core did not become ready in time',
                        {
                            version: this.nodeVersion,
                        },
                        system,
                    ),
                };
            }

            this.isXrayOnline = true;

            this.logger.log(`✔ XRay Core v${this.xrayVersion} is up and running.`);

            return {
                isOk: true,
                response: new StartXrayResponseModel(
                    isStarted,
                    this.xrayVersion,
                    null,
                    {
                        version: this.nodeVersion,
                    },
                    system,
                ),
            };
        } catch (error) {
            let errorMessage = null;
            if (error instanceof Error) {
                errorMessage = error.message;
            }

            this.logger.error(`Failed to start Xray: ${errorMessage}`);

            return {
                isOk: true,
                response: new StartXrayResponseModel(
                    false,
                    null,
                    errorMessage,
                    {
                        version: this.nodeVersion,
                    },
                    system,
                ),
            };
        } finally {
            this.logger.log(
                `Attempt to start XTLS took: ${ems(performance.now() - tm, {
                    extends: 'short',
                    includeMs: true,
                })} (IP: ${ip})`,
            );

            this.isXrayStartedProccesing = false;
        }
    }

    public async stopXray(args: {
        withPluginCleanup?: boolean;
        withOnlineCheck?: boolean;
    }): Promise<ICommandResponse<StopXrayResponseModel>> {
        const { withPluginCleanup = false, withOnlineCheck = false } = args;
        try {
            if (withPluginCleanup) {
                await this.commandBus.execute(new ResetPluginsCommand());
            }

            if (withOnlineCheck && !this.isXrayOnline) {
                return {
                    isOk: true,
                    response: new StopXrayResponseModel(true),
                };
            }

            await this.killAllXrayProcesses();

            this.isXrayOnline = false;
            this.internalService.cleanup();

            return {
                isOk: true,
                response: new StopXrayResponseModel(true),
            };
        } catch (error) {
            this.logger.error(`Failed to stop Xray Process: ${error}`);
            return {
                isOk: true,
                response: new StopXrayResponseModel(false),
            };
        }
    }

    public async getNodeHealthCheck(): Promise<ICommandResponse<GetNodeHealthCheckResponseModel>> {
        try {
            return {
                isOk: true,
                response: new GetNodeHealthCheckResponseModel(
                    true,
                    this.isXrayOnline,
                    this.xrayVersion,
                    this.nodeVersion,
                ),
            };
        } catch (error) {
            this.logger.error(`Failed to get node health check: ${error}`);

            return {
                isOk: true,
                response: new GetNodeHealthCheckResponseModel(false, false, null, this.nodeVersion),
            };
        }
    }

    public async killAllXrayProcesses(): Promise<void> {
        try {
            await this.xrayProcess.stop();

            this.logger.log('s6: Xray process stopped.');
        } catch (error) {
            this.logger.log(`s6: Failed to stop Xray process. Error: ${error}`);
        }
    }

    private getXrayVersionFromEnv(): null | string {
        const version = semver.valid(semver.coerce(process.env.XRAY_CORE_VERSION));

        if (version) {
            this.xrayVersion = version;
        }

        return version;
    }

    public getXrayInfo(): {
        version: string | null;
        path: string;
    } {
        const version = this.getXrayVersionFromEnv();

        if (version) {
            this.xrayVersion = version;
        }

        return {
            version: version,
            path: this.xrayPath,
        };
    }

    private async getXrayInternalStatus(): Promise<boolean> {
        const tm = performance.now();
        try {
            return await pRetry(
                async () => {
                    const { isOk, message } = await this.xtlsSdk.stats.getSysStats();
                    if (!isOk) {
                        throw new Error(message);
                    }
                    return true;
                },
                {
                    retries: 30,
                    minTimeout: 100,
                    maxTimeout: 2000,
                    factor: 1.5,
                    onFailedAttempt: (context) => {
                        this.logger.warn(
                            `▸ XRay Core status check, ${context.attemptNumber}/${context.attemptNumber + context.retriesLeft} · elapsed ${ems(
                                performance.now() - tm,
                                {
                                    extends: 'short',
                                    includeMs: true,
                                },
                            )} · retrying in ${context.retryDelay}ms`,
                        );
                    },
                },
            );
        } catch (error) {
            this.logger.error(`Failed to get Xray internal status: ${error}`);
            return false;
        }
    }

    private async restartXrayProcess(): Promise<{
        error: string | null;
    }> {
        try {
            await this.xrayProcess.restart();

            return { error: null };
        } catch (error) {
            return {
                error: error instanceof Error ? error.message : 'Unknown error',
            };
        }
    }

    public async tailLogLines(path: string, n = 10): Promise<string[]> {
        try {
            const { stdout } = await execFileAsync('tail', ['-n', String(n), path]);
            return stdout.split('\n').filter(Boolean);
        } catch {
            return [];
        }
    }

    private async dumpTailBlock(path: string, lines: number): Promise<void> {
        const tail = await this.tailLogLines(path, lines);
        if (tail.length === 0) return;

        this.logger.error(
            [
                'Xray Core Log Tail',
                `${'─'.repeat(8)} ${path} (${tail.length} lines) ${'─'.repeat(8)}`,
                ...tail.map((l) => `│ ${l}`),
            ].join('\n'),
        );
    }
}
