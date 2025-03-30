import { ProcessInfo } from 'node-supervisord/dist/interfaces';
import { SupervisordClient } from 'node-supervisord';
import { execa } from '@cjs-exporter/execa';
import { hasher } from 'node-object-hash';
import { table } from 'table';
import ems from 'enhanced-ms';
import pRetry from 'p-retry';
import semver from 'semver';

import { Injectable, Logger, OnApplicationBootstrap, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { InjectSupervisord } from '@remnawave/supervisord-nestjs';
import { InjectXtls } from '@remnawave/xtls-sdk-nestjs';
import { XtlsApi } from '@remnawave/xtls-sdk';

import { ISystemStats } from '@common/utils/get-system-stats/get-system-stats.interface';
import { ICommandResponse } from '@common/types/command-response.type';
import { generateApiConfig } from '@common/utils/generate-api-config';
import { getSystemStats } from '@common/utils/get-system-stats';

import {
    GetNodeHealthCheckResponseModel,
    GetXrayStatusAndVersionResponseModel,
    StartXrayResponseModel,
    StopXrayResponseModel,
} from './models';
import { InternalService } from '../internal/internal.service';

const XRAY_PROCESS_NAME = 'xray' as const;

@Injectable()
export class XrayService implements OnApplicationBootstrap, OnModuleInit {
    private readonly logger = new Logger(XrayService.name);
    private readonly configEqualChecking: boolean;

    private readonly xrayPath: string;

    private xrayVersion: null | string = null;
    private configChecksum: null | string = null;
    private isXrayOnline: boolean = false;
    private systemStats: ISystemStats | null = null;
    private isXrayStartedProccesing: boolean = false;

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
        this.configEqualChecking = this.configService.getOrThrow<boolean>('CONFIG_EQUAL_CHECKING');
    }

    async onModuleInit() {
        this.xrayVersion = await this.getXrayVersionFromExec();
    }

    async onApplicationBootstrap() {
        try {
            this.systemStats = await getSystemStats();

            await this.supervisordApi.clearAllProcessLogs();
        } catch (error) {
            this.logger.error(`Failed to get node hardware info: ${error}`);
        }

        this.isXrayOnline = false;
    }

    public async startXray(
        config: Record<string, unknown>,
        ip: string,
    ): Promise<ICommandResponse<StartXrayResponseModel>> {
        const tm = performance.now();

        try {
            if (this.isXrayStartedProccesing) {
                this.logger.error('Request already in progress');
                return {
                    isOk: true,
                    response: new StartXrayResponseModel(
                        false,
                        this.xrayVersion,
                        'Request already in progress',
                        null,
                    ),
                };
            }

            this.isXrayStartedProccesing = true;

            const fullConfig = generateApiConfig(config);

            if (this.configEqualChecking) {
                this.logger.log('Getting config checksum...');
                const newChecksum = this.getConfigChecksum(fullConfig);

                if (this.isXrayOnline) {
                    this.logger.warn(
                        `Xray process is already running with checksum ${this.configChecksum}`,
                    );

                    const oldChecksum = this.configChecksum;
                    const isXrayOnline = await this.getXrayInternalStatus();

                    this.logger.debug(`
                    oldChecksum: ${oldChecksum}
                    newChecksum: ${newChecksum}
                    isXrayOnline: ${isXrayOnline}
                `);

                    if (oldChecksum === newChecksum && isXrayOnline) {
                        this.logger.warn(
                            'Xray is already online with the same config. Skipping...',
                        );

                        return {
                            isOk: true,
                            response: new StartXrayResponseModel(
                                true,
                                this.xrayVersion,
                                null,
                                null,
                            ),
                        };
                    }
                }

                this.configChecksum = newChecksum;
            }

            this.internalService.setXrayConfig(fullConfig);

            this.logger.log(
                'XTLS config generated in: ' +
                    ems(performance.now() - tm, {
                        extends: 'short',
                        includeMs: true,
                    }),
            );

            const xrayProcess = await this.restartXrayProcess();

            if (xrayProcess.error) {
                this.logger.error(xrayProcess.error);
                return {
                    isOk: false,
                    response: new StartXrayResponseModel(false, null, xrayProcess.error, null),
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
                                ['Checksum', this.configChecksum],
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
                    ),
                };
            }

            this.isXrayOnline = true;

            this.logger.log(
                '\n' +
                    table(
                        [
                            ['Version', this.xrayVersion],
                            ['Checksum', this.configChecksum],
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
                response: new StartXrayResponseModel(false, null, errorMessage, null),
            };
        } finally {
            this.logger.log(
                'Start XTLS took: ' +
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
            this.configChecksum = null;
            this.internalService.setXrayConfig({});

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
            try {
                await this.supervisordApi.stopProcess(XRAY_PROCESS_NAME, true);
            } catch (error) {
                this.logger.error(`Response from supervisorctl stop: ${error}`);
            }

            await execa('pkill', ['xray'], { reject: false });

            await new Promise((resolve) => setTimeout(resolve, 1000));

            await execa('pkill', ['-9', 'xray'], { reject: false });

            try {
                const { stdout } = await execa('lsof', ['-i', ':61000', '-t']);
                if (stdout) {
                    await execa('kill', ['-9', stdout.trim()], { reject: false });
                }
            } catch (e) {
                this.logger.error(`Failed to kill Xray process: ${e}`);
            }

            this.logger.log('Killed all Xray processes');
        } catch (error) {
            this.logger.log(`No existing Xray processes found. Error: ${error}`);
        }
    }

    public async supervisorctlStop(): Promise<void> {
        try {
            await this.supervisordApi.stopProcess(XRAY_PROCESS_NAME, true);

            this.logger.log('Supervisorctl: XTLS stopped.');
        } catch (error) {
            this.logger.log('Supervisorctl: XTLS stop failed. Error: ', error);
        }
    }

    private getConfigChecksum(config: Record<string, unknown>): string {
        const hash = hasher({
            trim: true,
        }).hash;

        return hash(config);
    }

    private async getXrayVersionFromExec(): Promise<null | string> {
        const output = await execa(this.xrayPath, ['version']);

        const version = semver.valid(semver.coerce(output.stdout));

        if (version) {
            this.xrayVersion = version;
        }

        return version;
    }

    public async getXrayInfo(): Promise<{
        version: string | null;
        path: string;
        systemInfo: ISystemStats | null;
    }> {
        const output = await execa(this.xrayPath, ['version']);
        const version = semver.valid(semver.coerce(output.stdout));

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
