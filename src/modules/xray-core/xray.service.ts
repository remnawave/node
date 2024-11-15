import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { spawn, ChildProcess } from 'child_process';

import { generateApiConfig } from '@common/utils/generate-api-config';
import { ICommandResponse } from '../../common/types/command-response.type';
import {
    GetXrayStatusAndVersionResponseModel,
    StartXrayResponseModel,
    StopXrayResponseModel,
} from './models';

@Injectable()
export class XrayService {
    private readonly isDev: boolean;
    private readonly xrayPath: string;

    constructor(private readonly configService: ConfigService) {
        this.isDev = this.configService.getOrThrow('NODE_ENV') === 'development';
        this.xrayPath = this.isDev ? '/opt/homebrew/bin/xray' : '/usr/local/bin/xray';
        this.xrayVersion = null;
    }
    private xrayProcess: ChildProcess | null = null;
    private xrayVersion: string | null = null;
    private readonly logger = new Logger(XrayService.name);

    public async startXray(
        config: Record<string, unknown>,
    ): Promise<ICommandResponse<StartXrayResponseModel>> {
        try {
            const promise = new Promise<{ isStarted: boolean; version: string | null }>(
                (resolve, reject) => {
                    try {
                        const fullConfig = generateApiConfig(config);

                        if (this.xrayProcess) {
                            this.logger.warn('Xray process is already running');
                            this.stopXray();
                        }

                        this.xrayProcess = spawn(this.xrayPath, ['-config=stdin:'], {
                            detached: true,
                            stdio: ['pipe', 'pipe', 'pipe'],
                        });

                        this.xrayProcess.stdin!.write(JSON.stringify(fullConfig));
                        this.xrayProcess.stdin!.end();

                        let isStarted = false;

                        this.xrayProcess.stdout!.on('data', (data) => {
                            const output = data.toString();
                            this.logger.log(`Xray Output: ${output}`);

                            const version = this.getXrayVersionFromOutput(output);
                            if (version && !isStarted) {
                                isStarted = true;
                                this.xrayVersion = version;
                                this.logger.log(`Xray core started (version ${this.xrayVersion})`);
                                resolve({
                                    isStarted: true,
                                    version: this.xrayVersion,
                                });
                            }
                        });

                        this.xrayProcess.stderr!.on('data', (data) => {
                            const error = data.toString();
                            this.logger.error(`Xray Error: ${error}`);
                            if (!isStarted) {
                                reject(new Error(error));
                            }
                        });

                        this.xrayProcess.on('error', (err) => {
                            this.logger.error(`Failed to start Xray Process: ${err.message}`);
                            this.xrayProcess = null;
                            if (!isStarted) {
                                reject(err);
                            }
                        });

                        // Добавим таймаут на случай, если процесс не запустится
                        const timeout = setTimeout(() => {
                            if (!isStarted) {
                                reject(new Error('Xray start timeout'));
                            }
                        }, 5000); // 5 секунд на запуск

                        this.xrayProcess.on('close', (code) => {
                            this.logger.warn(`Xray Process exited with code ${code}`);
                            this.xrayProcess = null;
                            clearTimeout(timeout);
                            if (!isStarted) {
                                reject(new Error(`Process exited with code ${code}`));
                            }
                        });
                    } catch (error) {
                        reject(error);
                    }
                },
            );

            const response = await promise;

            return {
                isOk: true,
                response: new StartXrayResponseModel(response.isStarted, response.version, null),
            };
        } catch (error) {
            let errorMessage = null;
            if (error instanceof Error) {
                errorMessage = error.message;
            }
            return {
                isOk: true,
                response: new StartXrayResponseModel(false, null, errorMessage),
            };
        }
    }

    public async stopXray(): Promise<ICommandResponse<StopXrayResponseModel>> {
        try {
            if (!this.xrayProcess) {
                this.logger.warn('Xray process is not running');
                return {
                    isOk: true,
                    response: new StopXrayResponseModel(true),
                };
            }

            this.xrayProcess.kill();
            this.xrayProcess = null;
            return {
                isOk: true,
                response: new StopXrayResponseModel(true),
            };
        } catch (error) {
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

    private getXrayVersionFromOutput(output: string) {
        const versionMatch = output.match(/Xray\s+([\d.]+)\s+started/);
        return versionMatch ? versionMatch[1] : null;
    }
}
