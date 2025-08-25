import { ProcessInfo } from 'node-supervisord/dist/interfaces';
import { SupervisordClient } from 'node-supervisord';
import { readPackageJSON } from 'pkg-types';
import { table } from 'table';
import ems from 'enhanced-ms';
import pRetry from 'p-retry';
import semver from 'semver';

import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { InjectSupervisord } from '@remnawave/supervisord-nestjs';
import { InjectXtls } from '@remnawave/xtls-sdk-nestjs';
import { XtlsApi } from '@remnawave/xtls-sdk';

import { ISystemStats } from '@common/utils/get-system-stats/get-system-stats.interface';
import { ICommandResponse } from '@common/types/command-response.type';
import { generateApiConfig } from '@common/utils/generate-api-config';
import { getSystemStats } from '@common/utils/get-system-stats';
import { IHashPayload, KNOWN_ERRORS, REMNAWAVE_NODE_KNOWN_ERROR } from '@libs/contracts/constants';

import {
    GetNodeHealthCheckResponseModel,
    GetXrayStatusAndVersionResponseModel,
    StartXrayResponseModel,
    StopXrayResponseModel,
} from './models';
import { InternalService } from '../internal/internal.service';

const XRAY_PROCESS_NAME = 'xray' as const;

@Injectable()
export class XrayService implements OnApplicationBootstrap {
    private readonly logger = new Logger(XrayService.name);
    private readonly disableHashedSetCheck: boolean;

    private readonly xrayPath: string;

    private xrayVersion: null | string = null;
    private isXrayOnline: boolean = false;
    private systemStats: ISystemStats | null = null;
    private isXrayStartedProccesing: boolean = false;
    private nodeVersion: string | null = null;
    constructor(
        @InjectXtls() private readonly xtlsSdk: XtlsApi,
        @InjectSupervisord() private readonly supervisordApi: SupervisordClient,
        private readonly internalService: InternalService,
        private readonly configService: ConfigService,
    ) {
        this.xrayPath = '/usr/local/bin/xray';
        this.xrayVersion = null;
        this.systemStats = null;
        this.isXrayStartedProccesing = false;
        this.nodeVersion = null;
        this.disableHashedSetCheck = this.configService.getOrThrow<boolean>(
            'DISABLE_HASHED_SET_CHECK',
        );
    }

    async onApplicationBootstrap() {
        try {
            const pkg = await readPackageJSON();

            this.xrayVersion = this.getXrayVersionFromEnv();
            this.systemStats = await getSystemStats();
            this.nodeVersion = pkg.version || null;

            await this.supervisordApi.getState();
        } catch (error) {
            this.logger.error(`Error in Application Bootstrap: ${error}`);
        }

        this.isXrayOnline = false;
    }

    public async startXray(
        config: Record<string, unknown>,
        ip: string,
        hashPayload: IHashPayload | null,
        forceRestart: boolean,
    ): Promise<ICommandResponse<StartXrayResponseModel>> {
        const tm = performance.now();

        try {
            if (!hashPayload) {
                const errMessage =
                    'Hash payload is null. Update Remnawave to version 2.1.0 or downgrade @remnawave/node to 2.0.0.';
                this.logger.error(errMessage);

                return {
                    isOk: true,
                    response: new StartXrayResponseModel(false, null, errMessage, null, {
                        version: this.nodeVersion,
                    }),
                };
            }

            if (this.isXrayStartedProccesing) {
                this.logger.warn('Request already in progress');
                return {
                    isOk: true,
                    response: new StartXrayResponseModel(
                        false,
                        this.xrayVersion,
                        'Request already in progress',
                        null,
                        {
                            version: this.nodeVersion,
                        },
                    ),
                };
            }

            this.isXrayStartedProccesing = true;

            if (this.isXrayOnline && !this.disableHashedSetCheck && !forceRestart) {
                const { isOk } = await this.xtlsSdk.stats.getSysStats();

                let shouldRestart = false;

                if (isOk) {
                    shouldRestart = this.internalService.isNeedRestartCore(hashPayload);
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
                            this.systemStats,
                            {
                                version: this.nodeVersion,
                            },
                        ),
                    };
                }
            }

            if (forceRestart) {
                this.logger.warn('Force restart requested');
            }

            const fullConfig = generateApiConfig(config);

            this.internalService.extractUsersFromConfig(hashPayload, fullConfig);

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
                    response: new StartXrayResponseModel(false, null, xrayProcess.error, null, {
                        version: this.nodeVersion,
                    }),
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
                        this.systemStats,
                        {
                            version: this.nodeVersion,
                        },
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
                    this.systemStats,
                    {
                        version: this.nodeVersion,
                    },
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
                response: new StartXrayResponseModel(false, null, errorMessage, null, {
                    version: this.nodeVersion,
                }),
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

    public async stopXray(): Promise<ICommandResponse<StopXrayResponseModel>> {
        try {
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

    public async getXrayStatusAndVersion(): Promise<
        ICommandResponse<GetXrayStatusAndVersionResponseModel>
    > {
        try {
            const version = this.xrayVersion;
            const status = await this.getXrayInternalStatus();

            return {
                isOk: true,
                response: new GetXrayStatusAndVersionResponseModel(status, version),
            };
        } catch (error) {
            this.logger.error(`Failed to get Xray status and version ${error}`);

            return {
                isOk: true,
                response: new GetXrayStatusAndVersionResponseModel(false, null),
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
                ),
            };
        } catch (error) {
            this.logger.error(`Failed to get node health check: ${error}`);

            return {
                isOk: true,
                response: new GetNodeHealthCheckResponseModel(false, false, null),
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
        systemInfo: ISystemStats | null;
    } {
        const version = this.getXrayVersionFromEnv();

        if (version) {
            this.xrayVersion = version;
        }

        return {
            version: version,
            path: this.xrayPath,
            systemInfo: this.systemStats,
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
