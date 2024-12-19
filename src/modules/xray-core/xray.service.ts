import { Injectable, Logger, OnApplicationShutdown, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

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

import { ExecaError, execa } from '@kastov/execa-cjs';
import { writeFile } from 'node:fs';
import { resolve } from 'node:path';

@Injectable()
export class XrayService implements OnModuleInit, OnApplicationShutdown {
    private readonly isDev: boolean;
    private readonly xrayPath: string;
    private readonly xrayConfigPath: string;
    constructor(
        private readonly configService: ConfigService,
        @InjectXtls() private readonly xtlsSdk: XtlsApi,
    ) {
        this.isDev = this.configService.getOrThrow('NODE_ENV') === 'development';
        this.xrayPath = this.isDev ? '/usr/local/bin/xray' : '/usr/local/bin/xray';
        this.xrayConfigPath = this.isDev ? resolve(__dirname, '../../../../xray-config.json') : '/etc/xray/xray-config.json';
        this.xrayVersion = null;
    }
    private xrayProcess: NodeJS.Process | null = null;
    private xrayVersion: string | null = null;
    private configChecksum: string | null = null;
    private readonly logger = new Logger(XrayService.name);

    async onModuleInit() {
        this.xrayVersion = await this.getXrayVersionFromExec();
    }

    async onApplicationShutdown() {
        await new Promise<void>((resolve, reject) => {
            writeFile(this.xrayConfigPath, '{}', (err) => {
                if (err) {
                    this.logger.error(`Failed to clear config file: ${err}`);
                    reject(err);
                    return;
                }
                resolve();
            });
        });
    }

    public async startXray(
        config: Record<string, unknown>,
        ip: string,
    ): Promise<ICommandResponse<StartXrayResponseModel>> {
        try {
            this.logger.log(`Xray config path: ${this.xrayConfigPath}`);

            this.logger.log(`Xray config path: ${resolve(__dirname, this.xrayConfigPath)}`);
            this.logger.log(`Connected to: ${ip}`);

            if (this.xrayProcess) {
                this.logger.warn(
                    `Xray process is already running with checksum ${this.configChecksum}`,
                );

                // TODO: Maybe calc checksum?

                await this.stopXray();
            }

            const systemInformation = await getSystemStats();
            const tm = performance.now();
            const fullConfig = generateApiConfig(config);

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
            // this.logger.debug(JSON.stringify(fullConfig, null, 2));

            const currentChecksum = this.getConfigChecksum(fullConfig);
            this.logger.error(currentChecksum);

            this.logger.log(`${JSON.stringify(systemInformation)}`);
            this.logger.log(`Xray config generated in ${Math.round(performance.now() - tm)}ms`);

            // TODO: Remove error logging from file -> to console

            const process = execa(this.xrayPath, ['-config=stdin:'], {
                input: JSON.stringify(fullConfig),
                all: false,
                detached: true,
                cleanup: false,
                reject: false,
                timeout: 10000,
            });

            await process;

            // try {
            // } catch (error) {
            //     if (error instanceof ExecaError) {
            //         this.logger.error(`Failed to start Xray Process: ${error.message}`);
            //     } else {
            //         this.logger.error(`Failed to start Xray Process: ${error}`);
            //     }
            // }

            const exitCode = process.exitCode;
            const pid = process.pid;

            this.logger.log(`Xray exit code: ${exitCode}`);
            this.logger.log(`Xray pid: ${pid}`);

            await new Promise((resolve) => setTimeout(resolve, 1000));

            const isStarted = await this.getXrayInternalStatus();

            this.logger.log(`Xray internal status: ${isStarted}`);

            // await new Promise((resolve, reject) => {
            //     const timeout = setTimeout(() => {
            //         if (process.exitCode === null) {
            //             reject(new Error('Process was killed during startup'));
            //         } else {
            //             this.xrayProcess = process;
            //             resolve(true);
            //         }
            //     }, 2000);

            //     process.stderr.on('data', (data) => {
            //         clearTimeout(timeout);
            //         reject(new Error(`Process exited with code ${data}`));
            //     });
            // });

            // Слушаем поток вывода
            // process.all!.on('data', (data) => {
            //     const output = data.toString();
            //     this.logger.log(`Xray Output: ${output}`);

            //     const version = this.getXrayVersionFromOutput(output);
            //     if (version) {
            //         this.xrayVersion = version;
            //     }
            // });

            // this.xrayProcess = process;

            // const promise = new Promise<{ isStarted: boolean; version: string | null }>(
            //     (resolve, reject) => {
            //         try {
            //             this.xrayProcess = spawn(this.xrayPath, ['-config=stdin:'], {
            //                 detached: true,
            //                 stdio: ['pipe', 'pipe', 'pipe'],
            //             });

            //             const tempConfig = JSON.stringify(fullConfig);

            //             this.xrayProcess.stdin!.write(tempConfig);
            //             this.xrayProcess.stdin!.end();

            //             let isStarted = false;

            //             this.xrayProcess.stdout!.on('data', (data) => {
            //                 const output = data.toString();
            //                 this.logger.log(`Xray Output: ${output}`);

            //                 const version = this.getXrayVersionFromOutput(output);
            //                 if (version && !isStarted) {
            //                     isStarted = true;
            //                     this.xrayVersion = version;
            //                     this.logger.log(`Xray core started (version ${this.xrayVersion})`);
            //                     resolve({
            //                         isStarted: true,
            //                         version: this.xrayVersion,
            //                     });
            //                 }
            //             });

            //             this.xrayProcess.stderr!.on('data', (data) => {
            //                 const error = data.toString();
            //                 this.logger.error(`Xray Error: ${error}`);
            //                 if (!isStarted) {
            //                     reject(new Error(error));
            //                 }
            //             });

            //             this.xrayProcess.on('error', (err) => {
            //                 this.logger.error(`Failed to start Xray Process: ${err.message}`);
            //                 this.xrayProcess = null;
            //                 if (!isStarted) {
            //                     reject(err);
            //                 }
            //             });

            //             const timeout = setTimeout(() => {
            //                 if (!isStarted) {
            //                     reject(new Error('Xray start timeout'));
            //                 }
            //             }, 10000);

            //             this.xrayProcess.on('close', (code) => {
            //                 this.logger.warn(`Xray Process exited with code ${code}`);
            //                 this.xrayProcess = null;
            //                 clearTimeout(timeout);
            //                 if (!isStarted) {
            //                     reject(new Error(`Process exited with code ${code}`));
            //                 }
            //             });
            //         } catch (error) {
            //             reject(error);
            //         }
            //     },
            // );

            // const response = await promise;

            const response = {
                isStarted: true,
                version: '1.0.0',
            };

            return {
                isOk: true,
                response: new StartXrayResponseModel(
                    response.isStarted,
                    response.version,
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

            this.xrayProcess = null;

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
            const status = this.getXrayStatus();

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
    private getXrayStatus(): boolean {
        return this.xrayProcess ? true : false;
    }

    private getXrayVersion(): string | null {
        return this.xrayVersion;
    }

    private async killAllXrayProcesses(): Promise<void> {
        try {
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

    // private getConfigChecksum(config: Record<string, unknown>): string {
    //     return createHash('sha256').update(JSON.stringify(config)).digest('hex');
    // }

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
