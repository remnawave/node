import { ProcessInfo } from '@kastov/node-supervisord/dist/interfaces';
import { SupervisordClient } from '@kastov/node-supervisord';
import { readPackageJSON } from 'pkg-types';
import { table } from 'table';
import ems from 'enhanced-ms';
import pRetry from 'p-retry';
import semver from 'semver';

import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { CommandBus, QueryBus } from '@nestjs/cqrs';
import { ConfigService } from '@nestjs/config';

import { InjectSupervisord } from '@remnawave/supervisord-nestjs';
import { InjectXtls } from '@remnawave/xtls-sdk-nestjs';
import { XtlsApi } from '@remnawave/xtls-sdk';

import { getSystemInfo, getSystemStats } from '@common/utils/get-system-stats';
import { ICommandResponse } from '@common/types/command-response.type';
import { generateApiConfig } from '@common/utils/generate-api-config';
import { KNOWN_ERRORS, REMNAWAVE_NODE_KNOWN_ERROR } from '@libs/contracts/constants';
import { StartXrayCommand } from '@libs/contracts/commands';

import {
    GetNodeHealthCheckResponseModel,
    StartXrayResponseModel,
    StopXrayResponseModel,
} from './models';
import { GetInterfaceStatsQuery } from '../network-stats/queries/get-interface-stats/get-interface-stats.query';
import { ResetPluginsCommand } from '../_plugin/commands/reset-plugins/reset-plugins.command';
import { GetTorrentBlockerStateQuery } from '../_plugin/queries/get-torrent-blocker-state';
import { InternalService } from '../internal/internal.service';

const XRAY_PROCESS_NAME = 'xray' as const;

@Injectable()
export class XrayService implements OnApplicationBootstrap {
    private readonly logger = new Logger(XrayService.name);
    private readonly disableHashedSetCheck: boolean;
    private readonly internal: {
        socketPath: string;
        token: string;
    };

    private readonly xrayPath: string;

    private xrayVersion: null | string = null;
    private isXrayOnline: boolean = false;
    private isXrayStartedProccesing: boolean = false;
    private nodeVersion: string = '0.0.0';
    constructor(
        @InjectXtls() private readonly xtlsSdk: XtlsApi,
        @InjectSupervisord() private readonly supervisordApi: SupervisordClient,
        private readonly internalService: InternalService,
        private readonly configService: ConfigService,
        private readonly queryBus: QueryBus,
        private readonly commandBus: CommandBus,
    ) {
        this.internal = {
            socketPath: this.configService.getOrThrow<string>('INTERNAL_SOCKET_PATH'),
            token: this.configService.getOrThrow<string>('INTERNAL_REST_TOKEN'),
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
            const pkg = await readPackageJSON();

            this.xrayVersion = this.getXrayVersionFromEnv();
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

        try {
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
                if (xrayProcess.error.includes('XML-RPC fault: SPAWN_ERROR: xray')) {
                    this.logger.error(REMNAWAVE_NODE_KNOWN_ERROR, {
                        timestamp: new Date().toISOString(),
                        rawError: xrayProcess.error,
                        ...KNOWN_ERRORS.XRAY_FAILED_TO_START,
                    });
                } else {
                    this.logger.error(xrayProcess.error);
                }

                return {
                    isOk: true,
                    response: new StartXrayResponseModel(
                        false,
                        null,
                        xrayProcess.error,
                        {
                            version: this.nodeVersion,
                        },
                        system,
                    ),
                };
            }

            let isStarted = await this.getXrayInternalStatus();

            if (!isStarted && xrayProcess.processInfo!.state === 20) {
                isStarted = await this.getXrayInternalStatus();
            }

            if (!isStarted) {
                this.isXrayOnline = false;

                this.logger.error(
                    '\n' +
                        table(
                            [
                                ['Version', this.xrayVersion],
                                ['Master IP', ip],
                                ['Internal Status', isStarted],
                                ['Error', xrayProcess.error],
                            ],
                            {
                                header: {
                                    content: 'Xray failed to start',
                                    alignment: 'center',
                                },
                            },
                        ),
                );

                return {
                    isOk: true,
                    response: new StartXrayResponseModel(
                        isStarted,
                        this.xrayVersion,
                        xrayProcess.error,
                        {
                            version: this.nodeVersion,
                        },
                        system,
                    ),
                };
            }

            this.isXrayOnline = true;

            this.logger.log(
                '\n' +
                    table(
                        [
                            ['Version', this.xrayVersion],
                            ['Master IP', ip],
                        ],
                        {
                            header: {
                                content: 'Xray started',
                                alignment: 'center',
                            },
                        },
                    ),
            );

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
                'Attempt to start XTLS took: ' +
                    ems(performance.now() - tm, {
                        extends: 'short',
                        includeMs: true,
                    }),
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
            await this.supervisordApi.stopProcess(XRAY_PROCESS_NAME, true);

            this.logger.log('Supervisord: Xray processes killed.');
        } catch (error) {
            this.logger.log(`Supervisord: No existing Xray processes found. Error: ${error}`);
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
                    retries: 10,
                    minTimeout: 2000,
                    maxTimeout: 2000,
                    onFailedAttempt: (error) => {
                        this.logger.debug(
                            `Get Xray internal status attempt ${error.attemptNumber} failed. ${error.retriesLeft} retries left.`,
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
        processInfo: ProcessInfo | null;
        error: string | null;
    }> {
        try {
            const processState = await this.supervisordApi.getProcessInfo(XRAY_PROCESS_NAME);

            // Reference: https://supervisord.org/subprocess.html#process-states
            if (processState.state === 20) {
                await this.supervisordApi.stopProcess(XRAY_PROCESS_NAME, true);
            }

            await this.supervisordApi.startProcess(XRAY_PROCESS_NAME, true);

            return {
                processInfo: await this.supervisordApi.getProcessInfo(XRAY_PROCESS_NAME),
                error: null,
            };
        } catch (error) {
            return {
                processInfo: null,
                error: error instanceof Error ? error.message : 'Unknown error',
            };
        }
    }
}
