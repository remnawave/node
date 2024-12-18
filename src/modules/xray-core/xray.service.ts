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

@Injectable()
export class XrayService implements OnModuleInit, OnApplicationShutdown, OnApplicationBootstrap {
    private readonly logger = new Logger(XrayService.name);

    private readonly xrayPath: string;
    private readonly xrayConfigPath: string;

    private xrayVersion: string | null = null;
    private configChecksum: string | null = null;
    private isXrayOnline: boolean = false;

    constructor(@InjectXtls() private readonly xtlsSdk: XtlsApi) {
        this.xrayPath = '/usr/local/bin/xray';
        this.xrayConfigPath = '/var/lib/rnode/xray/xray-config.json';
        this.xrayVersion = null;
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
        } catch (error) {
            this.logger.error(`Failed to clear config file: ${error}`);
        }

        this.isXrayOnline = false;
    }

    public async startXray(
        config: Record<string, unknown>,
        ip: string,
    ): Promise<ICommandResponse<StartXrayResponseModel>> {
        try {
            this.logger.log(`Connected to: ${ip}`);

            const tm = performance.now();
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

            const systemInformation = await getSystemStats();

            this.logger.log(`${JSON.stringify(systemInformation)}`);
            this.logger.log(`Xray config generated in ${Math.round(performance.now() - tm)}ms`);

            const xrayProcess = await execa('supervisorctl', ['restart', 'xray'], {
                reject: false,
                all: true,
                cleanup: true,
                detached: true,
                timeout: 8000,
                lines: true,
            });

            this.logger.debug(xrayProcess.all);

            const isStarted = await this.getXrayInternalStatus();

            this.logger.debug(`isStarted: ${isStarted}`);

            if (!isStarted) {
                return {
                    isOk: true,
                    response: new StartXrayResponseModel(
                        isStarted,
                        this.xrayVersion,
                        xrayProcess.all.join('\n'),
                        systemInformation,
                    ),
                };
            }

            this.isXrayOnline = true;

            return {
                isOk: true,
                response: new StartXrayResponseModel(
                    isStarted,
                    this.xrayVersion,
                    null,
                    systemInformation,
                ),
            };
        } catch (error) {
            let errorMessage = null;
            if (error instanceof Error) {
                errorMessage = error.message;
            }
            return {
                isOk: true,
                response: new StartXrayResponseModel(false, null, errorMessage, null),
            };
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
            const version = this.getXrayVersion();
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

    private getXrayVersion(): string | null {
        return this.xrayVersion;
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

    private async getXrayInternalStatus(): Promise<boolean> {
        const { isOk } = await this.xtlsSdk.stats.getSysStats();

        return isOk;
    }
}
