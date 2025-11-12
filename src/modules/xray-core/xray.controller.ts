import { Body, Controller, Get, Ip, Logger, Post, UseFilters, UseGuards } from '@nestjs/common';

import { XForceRestart } from '@common/decorators/get-x-force-restart/get-x-force-restart';
import { HashPayload } from '@common/decorators/get-hash-payload/get-hash-payload';
import { HttpExceptionFilter } from '@common/exception/http-exception.filter';
import { errorHandler } from '@common/helpers/error-handler.helper';
import { JwtDefaultGuard } from '@common/guards/jwt-guards';
import { XRAY_CONTROLLER, XRAY_ROUTES } from '@libs/contracts/api';
import { IHashPayload } from '@libs/contracts/constants';

import {
    GetNodeHealthCheckResponseDto,
    GetXrayStatusAndVersionResponseDto,
    StartXrayRequestDto,
    StartXrayResponseDto,
    StopXrayResponseDto,
} from './dtos/';
import { XrayService } from './xray.service';

@UseFilters(HttpExceptionFilter)
@UseGuards(JwtDefaultGuard)
@Controller(XRAY_CONTROLLER)
export class XrayController {
    private readonly logger = new Logger(XrayController.name);

    constructor(private readonly xrayService: XrayService) {}

    @Post(XRAY_ROUTES.START)
    public async startXray(
        @Body() body: StartXrayRequestDto,
        @Ip() ip: string,
        @HashPayload() hashPayload: IHashPayload | null,
        @XForceRestart() forceRestart: boolean,
    ): Promise<StartXrayResponseDto> {
        const response = await this.xrayService.startXray(body, ip, hashPayload, forceRestart);
        const data = errorHandler(response);

        return {
            response: data,
        };
    }

    @Get(XRAY_ROUTES.STOP)
    public async stopXray(): Promise<StopXrayResponseDto> {
        this.logger.log('Remnawave requested to stop Xray.');

        const response = await this.xrayService.stopXray();
        const data = errorHandler(response);

        return {
            response: data,
        };
    }

    @Get(XRAY_ROUTES.STATUS)
    public async getXrayStatusAndVersion(): Promise<GetXrayStatusAndVersionResponseDto> {
        const response = await this.xrayService.getXrayStatusAndVersion();
        const data = errorHandler(response);

        return {
            response: data,
        };
    }

    @Get(XRAY_ROUTES.NODE_HEALTH_CHECK)
    public async getNodeHealthCheck(): Promise<GetNodeHealthCheckResponseDto> {
        const response = await this.xrayService.getNodeHealthCheck();
        const data = errorHandler(response);

        return {
            response: data,
        };
    }
}
