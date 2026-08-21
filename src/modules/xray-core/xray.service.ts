import ems from 'enhanced-ms';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import pRetry, { AbortError } from 'p-retry';

import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { CommandBus, QueryBus } from '@nestjs/cqrs';

import { XtlsApi } from '@remnawave/xtls-sdk';
import { InjectXtls } from '@remnawave/xtls-sdk-nestjs';

import { TypedConfigService } from '@common/config/app-config';
import { ok, TResult } from '@common/types';
import { generateApiConfig } from '@common/utils/generate-api-config';
import { getSystemInfo, getSystemStats } from '@common/utils/get-system-stats';
import { StartXrayCommand } from '@libs/contracts/commands';
import { KNOWN_ERRORS } from '@libs/contracts/constants';

import { IntegrationsService } from '@integration-modules/integrations.service';

import { ResetPluginsCommand } from '../_plugin/commands/reset-plugins/reset-plugins.command';
import { RunPreStartCommand } from '../_plugin/commands/run-pre-start/run-pre-start.command';
import { GetTorrentBlockerStateQuery } from '../_plugin/queries/get-torrent-blocker-state';
import { InternalService } from '../internal/internal.service';
import { GetInterfaceStatsQuery } from '../network-stats/queries/get-interface-stats/get-interface-stats.query';
import { CoreLoaderService } from './core-loader.service';
import { GeodataService } from './geodata.service';
import {
    GetNodeHealthCheckResponseModel,
    StartXrayResponseModel,
    StopXrayResponseModel,
} from './models';
import { XrayProcessService } from './xray-process.service';

const XRAY_LOG_FILE = '/var/log/xray/current' as const;
const execFileAsync = promisify(execFile);

class XrayProcessDownError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'XrayProcessDownError';
    }
}

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
        private readonly geodataService: GeodataService,
        private readonly coreLoaderService: CoreLoaderService,
        private readonly integrations: IntegrationsService,
        private readonly internalService: InternalService,
        private readonly configService: TypedConfigService,
        private readonly queryBus: QueryBus,
        private readonly commandBus: CommandBus,
    ) {
        this.internal = {
            socketPath: this.configService.getOrThrow('INTERNAL_SOCKET_PATH'),
            token: this.configService.getOrThrow('INTERNAL_REST_TOKEN'),
            xtlsApiSocketPath: this.configService.getOrThrow('XTLS_API_SOCKET_PATH'),
        };

        this.xrayPath = '/usr/local/bin/rw-core';
        this.xrayVersion = null;

        this.isXrayStartedProccesing = false;
        this.disableHashedSetCheck = this.configService.getOrThrow('DISABLE_HASHED_SET_CHECK');
    }

    async onApplicationBootstrap() {
        try {
            await this.refreshXrayVersion();
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
    ): Promise<TResult<StartXrayResponseModel>> {
        const interfaceStats = await this.queryBus.execute(new GetInterfaceStatsQuery());
        const tm = performance.now();
        const system = {
            info: getSystemInfo(),
            stats: getSystemStats(),
            interface: interfaceStats,
        };

        if (this.isXrayStartedProccesing) {
            this.logger.warn('Request already in progress');
            return ok(
                new StartXrayResponseModel(
                    false,
                    this.xrayVersion,
                    'Request already in progress',
                    {
                        version: this.nodeVersion,
                    },
                    system,
                ),
            );
        }

        this.isXrayStartedProccesing = true;

        try {
            const integrations = await this.integrations.sync(
                body.internals.integrations,
                body.internals.metadata,
            );

            if (integrations.error) {
                this.logger.error(`Failed to sync integrations: ${integrations.error}`);
                return ok(
                    new StartXrayResponseModel(
                        false,
                        null,
                        integrations.error,
                        {
                            version: this.nodeVersion,
                        },
                        system,
                    ),
                );
            }

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
                    return ok(
                        new StartXrayResponseModel(
                            true,
                            this.xrayVersion,
                            null,
                            {
                                version: this.nodeVersion,
                            },
                            system,
                        ),
                    );
                }
            }

            if (body.internals.forceRestart) {
                this.logger.warn('Force restart requested');
            }

            const tblockerState = await this.queryBus.execute(new GetTorrentBlockerStateQuery());

            const fullConfig = generateApiConfig({
                config: body.xrayConfig,
                torrentBlockerState: tblockerState,
                internal: this.internal,
            });

            await this.internalService.extractUsersFromConfig(body.internals.hashes, fullConfig);

            await this.coreLoaderService.prepare(fullConfig.geodata);
            await this.geodataService.prepare(fullConfig.geodata);

            const xrayProcess = await this.restartXrayProcess();

            if (xrayProcess.error) {
                this.logger.error(`Failed to (re)start Xray process via s6: ${xrayProcess.error}`);

                return ok(
                    new StartXrayResponseModel(
                        false,
                        null,
                        xrayProcess.error,
                        { version: this.nodeVersion },
                        system,
                    ),
                );
            }

            const { isStarted, error: startError } = await this.getXrayInternalStatus();

            if (!isStarted) {
                this.isXrayOnline = false;

                this.logger.error(`Xray Core v${this.xrayVersion} failed to start.`, {
                    timestamp: new Date().toISOString(),
                    ...KNOWN_ERRORS.XRAY_FAILED_TO_START,
                });

                const tail = await this.dumpTailBlock(XRAY_LOG_FILE, 5);
                const logReason = tail.at(-1)?.trim().slice(0, 500);

                return ok(
                    new StartXrayResponseModel(
                        isStarted,
                        this.xrayVersion,
                        logReason ? `${startError} · ${logReason}` : startError,
                        {
                            version: this.nodeVersion,
                        },
                        system,
                    ),
                );
            }

            this.isXrayOnline = true;

            await this.refreshXrayVersion();

            this.logger.log(`✔ XRay Core v${this.xrayVersion} is up and running.`);

            return ok(
                new StartXrayResponseModel(
                    isStarted,
                    this.xrayVersion,
                    null,
                    {
                        version: this.nodeVersion,
                    },
                    system,
                ),
            );
        } catch (error) {
            let errorMessage = null;
            if (error instanceof Error) {
                errorMessage = error.message;
            }

            this.logger.error(`Failed to start Xray: ${errorMessage}`);

            return ok(
                new StartXrayResponseModel(
                    false,
                    null,
                    errorMessage,
                    {
                        version: this.nodeVersion,
                    },
                    system,
                ),
            );
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
    }): Promise<TResult<StopXrayResponseModel>> {
        const { withPluginCleanup = false, withOnlineCheck = false } = args;
        try {
            if (withPluginCleanup) {
                await this.commandBus.execute(new ResetPluginsCommand());
            }

            if (withOnlineCheck && !this.isXrayOnline) {
                return ok(new StopXrayResponseModel(true));
            }

            await this.killAllXrayProcesses();
            await this.integrations.stop();

            this.isXrayOnline = false;
            this.internalService.cleanup();

            return ok(new StopXrayResponseModel(true));
        } catch (error) {
            this.logger.error(`Failed to stop Xray Process: ${error}`);
            return ok(new StopXrayResponseModel(false));
        }
    }

    public async getNodeHealthCheck(): Promise<TResult<GetNodeHealthCheckResponseModel>> {
        try {
            return ok(
                new GetNodeHealthCheckResponseModel(
                    true,
                    this.isXrayOnline,
                    this.xrayVersion,
                    this.nodeVersion,
                ),
            );
        } catch (error) {
            this.logger.error(`Failed to get node health check: ${error}`);

            return ok(new GetNodeHealthCheckResponseModel(false, false, null, this.nodeVersion));
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

    private async refreshXrayVersion(): Promise<void> {
        const version = await this.xrayProcess.getCoreVersion();

        if (version) {
            this.xrayVersion = version;
        }
    }

    public getXrayInfo(): {
        version: string | null;
        path: string;
    } {
        return {
            version: this.xrayVersion,
            path: this.xrayPath,
        };
    }

    private async getXrayInternalStatus(): Promise<{
        isStarted: boolean;
        error: string | null;
    }> {
        const tm = performance.now();

        const startedPid = (await this.xrayProcess.getStatus()).pid;

        try {
            await pRetry(
                async () => {
                    const { isOk, message } = await this.xtlsSdk.stats.getSysStats();
                    if (isOk) {
                        return;
                    }

                    const status = await this.xrayProcess.getStatus();

                    if (!status.up || (startedPid !== null && status.pid !== startedPid)) {
                        throw new AbortError(
                            new XrayProcessDownError(
                                `Xray Core process is not running anymore (s6: ${await this.xrayProcess.getStatusLine()})`,
                            ),
                        );
                    }

                    throw new Error(message);
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

            return { isStarted: true, error: null };
        } catch (error) {
            this.logger.error(`Failed to get Xray internal status: ${error}`);

            return {
                isStarted: false,
                error:
                    error instanceof XrayProcessDownError
                        ? error.message
                        : 'Xray Core did not become ready in time',
            };
        }
    }

    private async restartXrayProcess(): Promise<{
        error: string | null;
    }> {
        try {
            await this.xrayProcess.stop();

            await this.commandBus.execute(new RunPreStartCommand());

            await this.xrayProcess.start();

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

    private async dumpTailBlock(path: string, lines: number): Promise<string[]> {
        const tail = await this.tailLogLines(path, lines);
        if (tail.length === 0) return tail;

        this.logger.error(
            [
                'Xray Core Log Tail',
                `${'─'.repeat(8)} ${path} (${tail.length} lines) ${'─'.repeat(8)}`,
                ...tail.map((l) => `│ ${l}`),
            ].join('\n'),
        );

        return tail;
    }
}
