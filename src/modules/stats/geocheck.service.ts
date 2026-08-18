import ems from 'enhanced-ms';
import { execFile } from 'node:child_process';
import { isIP } from 'node:net';
import { promisify } from 'node:util';

import { Injectable, Logger } from '@nestjs/common';

import { ICommandResponse } from '@common/types/command-response.type';
import { GetGeocheckCommand } from '@libs/contracts/commands';
import { ERRORS } from '@libs/contracts/constants';

import { IGetGeocheckRequest } from './interfaces';
import { GetGeocheckResponseModel } from './models';

const execFileAsync = promisify(execFile);

const GEOCHECK_BIN = '/usr/local/bin/geocheck' as const;
const GEOCHECK_TIMEOUT_MS = 45_000;
const GEOCHECK_MAX_OUTPUT = 32 * 1024 * 1024;

@Injectable()
export class GeocheckService {
    private readonly logger = new Logger(GeocheckService.name);

    private isRunning = false;

    public async getGeocheck(
        body: IGetGeocheckRequest,
    ): Promise<ICommandResponse<GetGeocheckResponseModel>> {
        const ip = body.ip?.trim();
        const iface = body.interface?.trim();

        let bindTo: null | string = null;

        if (ip) {
            if (!isIP(ip)) {
                return {
                    isOk: false,
                    ...ERRORS.FAILED_TO_GET_GEOCHECK,
                    message: `Geocheck: "${ip}" is not a valid IP address.`,
                };
            }

            bindTo = ip;
        } else if (iface) {
            bindTo = iface;
        }

        if (this.isRunning) {
            return {
                isOk: false,
                ...ERRORS.FAILED_TO_GET_GEOCHECK,
                message: 'Geocheck: a run is already in progress.',
            };
        }

        const target = bindTo ?? 'default route';

        this.isRunning = true;
        const tm = performance.now();

        try {
            const { stdout } = await execFileAsync(
                GEOCHECK_BIN,
                [...(bindTo ? ['--interface', bindTo] : []), '--json', '--svg-base64', '--quiet'],
                { timeout: GEOCHECK_TIMEOUT_MS, maxBuffer: GEOCHECK_MAX_OUTPUT },
            );

            const report = JSON.parse(stdout) as GetGeocheckCommand.Response['response'];

            if (!report?.image?.data) {
                throw new Error('geocheck report carries no image');
            }

            this.logger.log(
                `Geocheck via ${target} took ${ems(performance.now() - tm, {
                    extends: 'short',
                    includeMs: true,
                })}`,
            );

            return {
                isOk: true,
                response: new GetGeocheckResponseModel(report),
            };
        } catch (error) {
            const killed = (error as { killed?: boolean }).killed === true;

            const errorMessage = error instanceof Error ? error.message : String(error);
            const killedMessage = killed
                ? `Geocheck via ${target} exceeded ${GEOCHECK_TIMEOUT_MS}ms and was killed.`
                : `Geocheck via ${target} failed: ${errorMessage}`;

            this.logger.error(killedMessage);

            return {
                isOk: false,
                ...ERRORS.FAILED_TO_GET_GEOCHECK,
                message: killedMessage,
            };
        } finally {
            this.isRunning = false;
        }
    }
}
