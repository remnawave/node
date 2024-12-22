import { Body, Controller, Get, Ip, Post, UseFilters, UseGuards } from '@nestjs/common';

import { XRAY_CONTROLLER, XRAY_ROUTES } from '@libs/contracts/api/controllers/xray';
import { HttpExceptionFilter } from '@common/exception/httpException.filter';
import { JwtDefaultGuard } from '@common/guards/jwt-guards/def-jwt-guard';
import { errorHandler } from '@common/helpers/error-handler.helper';

import {
    GetXrayStatusAndVersionResponseDto,
    StartXrayRequestDto,
    StartXrayResponseDto,
    StopXrayResponseDto,
} from './dtos/';
import { XrayService } from './xray.service';

@Controller(XRAY_CONTROLLER)
@UseFilters(HttpExceptionFilter)
@UseGuards(JwtDefaultGuard)
export class XrayController {
    constructor(private readonly xrayService: XrayService) {
        this.xrayService = xrayService;
    }

    @Post(XRAY_ROUTES.START)
    public async startXray(
        @Body() body: StartXrayRequestDto,
        @Ip() ip: string,
    ): Promise<StartXrayResponseDto> {
        const response = await this.xrayService.startXray(body, ip);
        const data = errorHandler(response);

        return {
            response: data,
        };
    }

    @Get(XRAY_ROUTES.STOP)
    public async stopXray(): Promise<StopXrayResponseDto> {
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
}
