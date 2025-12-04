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

import { ISystemStats } from '@common/utils/get-system-stats/get-system-stats.interface';
import { ICommandResponse } from '@common/types/command-response.type';
import { getSystemStats } from '@common/utils/get-system-stats';
import { IHashPayload, KNOWN_ERRORS, REMNAWAVE_NODE_KNOWN_ERROR } from '@libs/contracts/constants';

import {
    GetNodeHealthCheckResponseModel,
    GetXrayStatusAndVersionResponseModel,
    StartXrayResponseModel,
    StopXrayResponseModel,
} from './models';
import { InternalService } from '../internal/internal.service';

/** Supervisord process name for sing-box */
const SINGBOX_PROCESS_NAME = 'singbox' as const;

/** Supervisord process state: RUNNING */
const PROCESS_STATE_RUNNING = 20;

@Injectable()
export class XrayService implements OnApplicationBootstrap {
    private readonly logger = new Logger(XrayService.name);
    private readonly disableHashedSetCheck: boolean;

    private readonly singBoxPath: string;

    private singBoxVersion: string | null = null;
    private isSingBoxOnline: boolean = false;
    private systemStats: ISystemStats | null = null;
    private isStartProcessing: boolean = false;
    private nodeVersion: string | null = null;

    constructor(
        @InjectSupervisord() private readonly supervisordApi: SupervisordClient,
        private readonly internalService: InternalService,
        private readonly configService: ConfigService,
    ) {
        this.singBoxPath = '/usr/local/bin/sing-box';
        this.singBoxVersion = null;
        this.systemStats = null;
        this.isStartProcessing = false;
        this.nodeVersion = null;
        this.disableHashedSetCheck = this.configService.getOrThrow<boolean>(
            'DISABLE_HASHED_SET_CHECK',
        );
    }

    async onApplicationBootstrap() {
        try {
            const pkg = await readPackageJSON();

            this.singBoxVersion = this.getSingBoxVersionFromEnv();
            this.systemStats = await getSystemStats();
            this.nodeVersion = pkg.version || null;

            await this.supervisordApi.getState();
        } catch (error) {
            this.logger.error(`Error in Application Bootstrap: ${error}`);
        }

        this.isSingBoxOnline = false;
    }

    /**
     * Starts sing-box with the provided configuration.
     * Method name kept as startXray for API compatibility.
     *
     * @param config - Sing-box configuration object
     * @param ip - Master IP address
     * @param hashPayload - Hash payload for config comparison
     * @param forceRestart - Force restart even if config unchanged
     */
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

            if (this.isStartProcessing) {
                this.logger.warn('Request already in progress');
                return {
                    isOk: true,
                    response: new StartXrayResponseModel(
                        false,
                        this.singBoxVersion,
                        'Request already in progress',
                        null,
                        {
                            version: this.nodeVersion,
                        },
                    ),
                };
            }

            this.isStartProcessing = true;

            // Check if restart is needed based on config hash
            if (this.isSingBoxOnline && !this.disableHashedSetCheck && !forceRestart) {
                const isOnline = await this.checkSingBoxHealth();

                let shouldRestart = false;

                if (isOnline) {
                    shouldRestart = this.internalService.isNeedRestartCore(hashPayload);
                } else {
                    this.isSingBoxOnline = false;
                    shouldRestart = true;

                    this.logger.warn(`Sing-box health check failed, restarting...`);
                }

                if (!shouldRestart) {
                    return {
                        isOk: true,
                        response: new StartXrayResponseModel(
                            true,
                            this.singBoxVersion,
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

            // Store config and extract users - sing-box config is used as-is
            await this.internalService.extractUsersFromConfig(hashPayload, config);

            const singBoxProcess = await this.restartSingBoxProcess();

            if (singBoxProcess.error) {
                if (singBoxProcess.error.includes('XML-RPC fault: SPAWN_ERROR: singbox')) {
                    this.logger.error(REMNAWAVE_NODE_KNOWN_ERROR, {
                        timestamp: new Date().toISOString(),
                        rawError: singBoxProcess.error,
                        ...KNOWN_ERRORS.XRAY_FAILED_TO_START,
                    });
                } else {
                    this.logger.error(singBoxProcess.error);
                }

                return {
                    isOk: true,
                    response: new StartXrayResponseModel(false, null, singBoxProcess.error, null, {
                        version: this.nodeVersion,
                    }),
                };
            }

            let isStarted = await this.getSingBoxInternalStatus();

            if (!isStarted && singBoxProcess.processInfo?.state === PROCESS_STATE_RUNNING) {
                isStarted = await this.getSingBoxInternalStatus();
            }

            if (!isStarted) {
                this.isSingBoxOnline = false;

                this.logger.error(
                    '\n' +
                    table(
                        [
                            ['Version', this.singBoxVersion],
                            ['Master IP', ip],
                            ['Internal Status', isStarted],
                            ['Error', singBoxProcess.error],
                        ],
                        {
                            header: {
                                content: 'Sing-box failed to start',
                                alignment: 'center',
                            },
                        },
                    ),
                );

                return {
                    isOk: true,
                    response: new StartXrayResponseModel(
                        isStarted,
                        this.singBoxVersion,
                        singBoxProcess.error,
                        this.systemStats,
                        {
                            version: this.nodeVersion,
                        },
                    ),
                };
            }

            this.isSingBoxOnline = true;

            this.logger.log(
                '\n' +
                table(
                    [
                        ['Version', this.singBoxVersion],
                        ['Master IP', ip],
                    ],
                    {
                        header: {
                            content: 'Sing-box started',
                            alignment: 'center',
                        },
                    },
                ),
            );

            return {
                isOk: true,
                response: new StartXrayResponseModel(
                    isStarted,
                    this.singBoxVersion,
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

            this.logger.error(`Failed to start Sing-box: ${errorMessage}`);

            return {
                isOk: true,
                response: new StartXrayResponseModel(false, null, errorMessage, null, {
                    version: this.nodeVersion,
                }),
            };
        } finally {
            this.logger.log(
                'Attempt to start Sing-box took: ' +
                ems(performance.now() - tm, {
                    extends: 'short',
                    includeMs: true,
                }),
            );

            this.isStartProcessing = false;
        }
    }

    /**
     * Stops sing-box process.
     * Method name kept as stopXray for API compatibility.
     */
    public async stopXray(): Promise<ICommandResponse<StopXrayResponseModel>> {
        try {
            await this.killAllSingBoxProcesses();

            this.isSingBoxOnline = false;
            this.internalService.cleanup();

            return {
                isOk: true,
                response: new StopXrayResponseModel(true),
            };
        } catch (error) {
            this.logger.error(`Failed to stop Sing-box Process: ${error}`);
            return {
                isOk: true,
                response: new StopXrayResponseModel(false),
            };
        }
    }

    /**
     * Gets sing-box status and version.
     * Method name kept as getXrayStatusAndVersion for API compatibility.
     */
    public async getXrayStatusAndVersion(): Promise<
        ICommandResponse<GetXrayStatusAndVersionResponseModel>
    > {
        try {
            const version = this.singBoxVersion;
            const status = await this.getSingBoxInternalStatus();

            return {
                isOk: true,
                response: new GetXrayStatusAndVersionResponseModel(status, version),
            };
        } catch (error) {
            this.logger.error(`Failed to get Sing-box status and version ${error}`);

            return {
                isOk: true,
                response: new GetXrayStatusAndVersionResponseModel(false, null),
            };
        }
    }

    /**
     * Gets node health check status.
     */
    public async getNodeHealthCheck(): Promise<ICommandResponse<GetNodeHealthCheckResponseModel>> {
        try {
            return {
                isOk: true,
                response: new GetNodeHealthCheckResponseModel(
                    true,
                    this.isSingBoxOnline,
                    this.singBoxVersion,
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

    /**
     * Restarts the sing-box process via supervisord.
     * Public method for use by HandlerService.
     */
    public async restartProcess(): Promise<{ success: boolean; error: string | null }> {
        const result = await this.restartSingBoxProcess();
        return {
            success: result.error === null,
            error: result.error,
        };
    }

    /**
     * Kills all sing-box processes.
     * Method name kept for internal compatibility.
     */
    public async killAllXrayProcesses(): Promise<void> {
        await this.killAllSingBoxProcesses();
    }

    /**
     * Kills all sing-box processes via supervisord.
     */
    private async killAllSingBoxProcesses(): Promise<void> {
        try {
            await this.supervisordApi.stopProcess(SINGBOX_PROCESS_NAME, true);

            this.logger.log('Supervisord: Sing-box processes killed.');
        } catch (error) {
            this.logger.log(`Supervisord: No existing Sing-box processes found. Error: ${error}`);
        }
    }

    /**
     * Gets sing-box version from environment variable.
     */
    private getSingBoxVersionFromEnv(): string | null {
        const version = semver.valid(semver.coerce(process.env.SINGBOX_VERSION));

        if (version) {
            this.singBoxVersion = version;
        }

        return version;
    }

    /**
     * Gets sing-box information.
     * Method name kept as getXrayInfo for API compatibility.
     */
    public getXrayInfo(): {
        version: string | null;
        path: string;
        systemInfo: ISystemStats | null;
    } {
        const version = this.getSingBoxVersionFromEnv();

        if (version) {
            this.singBoxVersion = version;
        }

        return {
            version: version,
            path: this.singBoxPath,
            systemInfo: this.systemStats,
        };
    }

    /**
     * Checks if sing-box is healthy by verifying process state.
     */
    private async checkSingBoxHealth(): Promise<boolean> {
        try {
            const processInfo = await this.supervisordApi.getProcessInfo(SINGBOX_PROCESS_NAME);
            return processInfo.state === PROCESS_STATE_RUNNING;
        } catch (error) {
            this.logger.debug(`Sing-box health check error: ${error}`);
            return false;
        }
    }

    /**
     * Gets sing-box internal status by checking supervisord process state.
     * Uses retry logic to handle startup delay.
     */
    private async getSingBoxInternalStatus(): Promise<boolean> {
        try {
            return await pRetry(
                async () => {
                    const processInfo = await this.supervisordApi.getProcessInfo(
                        SINGBOX_PROCESS_NAME,
                    );

                    if (processInfo.state !== PROCESS_STATE_RUNNING) {
                        throw new Error(`Process state is ${processInfo.state}, not running`);
                    }

                    return true;
                },
                {
                    retries: 10,
                    minTimeout: 2000,
                    maxTimeout: 2000,
                    onFailedAttempt: (error) => {
                        this.logger.debug(
                            `Get Sing-box internal status attempt ${error.attemptNumber} failed. ${error.retriesLeft} retries left.`,
                        );
                    },
                },
            );
        } catch (error) {
            this.logger.error(`Failed to get Sing-box internal status: ${error}`);
            return false;
        }
    }

    /**
     * Restarts sing-box process via supervisord.
     */
    private async restartSingBoxProcess(): Promise<{
        processInfo: ProcessInfo | null;
        error: string | null;
    }> {
        try {
            const processState = await this.supervisordApi.getProcessInfo(SINGBOX_PROCESS_NAME);

            // Reference: https://supervisord.org/subprocess.html#process-states
            if (processState.state === PROCESS_STATE_RUNNING) {
                await this.supervisordApi.stopProcess(SINGBOX_PROCESS_NAME, true);
            }

            await this.supervisordApi.startProcess(SINGBOX_PROCESS_NAME, true);

            return {
                processInfo: await this.supervisordApi.getProcessInfo(SINGBOX_PROCESS_NAME),
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
