import {
    Injectable,
    Logger,
    OnApplicationBootstrap,
    OnApplicationShutdown,
    OnModuleInit,
} from '@nestjs/common';

import { generateApiConfig } from '@common/utils/generate-api-config';
import { ICommandResponse } from '../../common/types/command-response.type';
import {
    GetXrayStatusAndVersionResponseModel,
    StartXrayResponseModel,
    StopXrayResponseModel,
} from './models';
import semver from 'semver';
import { getSystemStats } from '@common/utils/get-system-stats';

import { createHash } from 'crypto';
import { XtlsApi } from '@remnawave/xtls-sdk';
import { InjectXtls } from '@remnawave/xtls-sdk-nestjs';
import { sort } from '@tamtamchik/json-deep-sort';

import { execa } from '@kastov/execa-cjs';
import { writeFile } from 'node:fs';
import { ISystemStats } from '@common/utils/get-system-stats/get-system-stats.interface';

@Injectable()
export class XrayService implements OnModuleInit, OnApplicationShutdown, OnApplicationBootstrap {
    private readonly logger = new Logger(XrayService.name);

    private readonly xrayPath: string;
    private readonly xrayConfigPath: string;

    private xrayVersion: string | null = null;
    private configChecksum: string | null = null;
    private isXrayOnline: boolean = false;
    private systemStats: ISystemStats | null = null;

    constructor(@InjectXtls() private readonly xtlsSdk: XtlsApi) {
        this.xrayPath = '/usr/local/bin/xray';
        this.xrayConfigPath = '/var/lib/rnode/xray/xray-config.json';
        this.xrayVersion = null;
        this.systemStats = null;
    }

    async onModuleInit() {
        this.xrayVersion = await this.getXrayVersionFromExec();
    }

    async onApplicationShutdown() {
        try {
            await execa('bash', ['-c', `echo '{}' > ${this.xrayConfigPath}`]);
        } catch (error) {
            this.logger.error(`Failed to clear config file: ${error}`);
        }

        this.isXrayOnline = false;
    }

    async onApplicationBootstrap() {
        try {
            await execa('bash', ['-c', `echo '{}' > ${this.xrayConfigPath}`]);

            this.systemStats = await getSystemStats();
            this.logger.log(`System stats: ${JSON.stringify(this.systemStats)}`);
        } catch (error) {
            this.logger.error(`Failed to clear config file: ${error}`);
        }

        this.isXrayOnline = false;
    }

    public async startXray(
        config: Record<string, unknown>,
        ip: string,
    ): Promise<ICommandResponse<StartXrayResponseModel>> {
        const tm = performance.now();

        try {
            const fullConfig = generateApiConfig(config);
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
                    this.logger.error('Xray is already online with the same config');

                    return {
                        isOk: true,
                        response: new StartXrayResponseModel(true, this.xrayVersion, null, null),
                    };
                }
            }

            this.configChecksum = newChecksum;

            await new Promise<void>((resolve, reject) => {
                writeFile(this.xrayConfigPath, JSON.stringify(fullConfig, null, 2), (err) => {
                    if (err) {
                        this.logger.error(`Failed to write xray-config.json: ${err}`);
                        reject(err);
                        return;
                    }
                    resolve();
                });
            });

            this.logger.log(`Xray config generated in ${Math.round(performance.now() - tm)}ms`);

            const xrayProcess = await execa('supervisorctl', ['restart', 'xray'], {
                reject: false,
                all: true,
                cleanup: true,
                timeout: 20_000,
                lines: true,
            });

            this.logger.debug(xrayProcess.all);

            let isStarted = await this.getXrayInternalStatus();

            if (!isStarted && xrayProcess.all[1] === 'xray: started') {
                await new Promise((resolve) => setTimeout(resolve, 2000));
                isStarted = await this.getXrayInternalStatus();
            }

            this.logger.debug(`isStarted: ${isStarted}`);

            if (!isStarted) {
                this.isXrayOnline = false;

                this.logger.error(
                    `Xray failed to start:
                    • Version: ${this.xrayVersion}
                    • Checksum: ${this.configChecksum}
                    • Master IP: ${ip}
                    • Internal Status: ${isStarted}
                    • Error: ${xrayProcess.all.join(' | ')}`,
                );

                return {
                    isOk: true,
                    response: new StartXrayResponseModel(
                        isStarted,
                        this.xrayVersion,
                        xrayProcess.all.join('\n'),
                        this.systemStats,
                    ),
                };
            }

            this.isXrayOnline = true;

            this.logger.log(
                `Xray started successfully:
                • Version: ${this.xrayVersion}
                • Checksum: ${this.configChecksum}
                • Master IP: ${ip}`,
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

            this.logger.fatal(`Failed to start Xray: ${errorMessage}`);

            return {
                isOk: true,
                response: new StartXrayResponseModel(false, null, errorMessage, null),
            };
        } finally {
            this.logger.log('Start xray took: ' + (performance.now() - tm) + 'ms');
        }
    }

    public async stopXray(): Promise<ICommandResponse<StopXrayResponseModel>> {
        try {
            await this.killAllXrayProcesses();

            this.isXrayOnline = false;

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
            return {
                isOk: true,
                response: new GetXrayStatusAndVersionResponseModel(false, null),
            };
        }
    }

    private async killAllXrayProcesses(): Promise<void> {
        try {
            await execa('supervisorctl', ['stop', 'xray'], { reject: false });

            await execa('pkill', ['xray'], { reject: false });

            await new Promise((resolve) => setTimeout(resolve, 1000));

            await execa('pkill', ['-9', 'xray'], { reject: false });

            try {
                const { stdout } = await execa('lsof', ['-i', ':61000', '-t']);
                if (stdout) {
                    await execa('kill', ['-9', stdout.trim()], { reject: false });
                }
            } catch (e) {}

            this.logger.log('Killed all Xray processes');
        } catch (error) {
            this.logger.log('No existing Xray processes found. Error: ', error);
        }
    }

    private getConfigChecksum(config: Record<string, unknown>): string {
        const start = performance.now();

        const sortedConfig = sort(config);
        const checksum = createHash('sha256').update(JSON.stringify(sortedConfig)).digest('hex');

        const end = performance.now();
        this.logger.debug(`Checksum calculation took ${end - start}ms`);

        return checksum;
    }

    private async getXrayVersionFromExec(): Promise<string | null> {
        const output = await execa(this.xrayPath, ['version']);
        const version = semver.valid(semver.coerce(output.stdout));

        if (version) {
            this.xrayVersion = version;
        }

        return version;
    }

    // private async getXrayInternalStatus(): Promise<boolean> {
    //     const { isOk } = await this.xtlsSdk.stats.getSysStats();

    //     return isOk;
    // }

    private async getXrayInternalStatus(): Promise<boolean> {
        const maxRetries = 3;
        const delay = 1000;

        for (let attempt = 0; attempt < maxRetries; attempt++) {
            try {
                const { isOk } = await this.xtlsSdk.stats.getSysStats();

                if (isOk) {
                    return true;
                }

                if (attempt < maxRetries - 1) {
                    this.logger.debug(
                        `Xray status check attempt ${attempt + 1} failed, retrying in ${delay}ms...`,
                    );
                    await new Promise((resolve) => setTimeout(resolve, delay));
                }
            } catch (error) {
                this.logger.error(`Unexpected error during Xray status check: ${error}`);
                return false;
            }
        }

        this.logger.error(`Failed to get positive Xray status after ${maxRetries} attempts`);
        return false;
    }
}
