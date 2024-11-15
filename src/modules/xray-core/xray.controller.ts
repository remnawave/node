import { XRAY_CONTROLLER, XRAY_ROUTES } from '@libs/contracts/api/controllers/xray';
import { Controller, Post, Body, Get, UseGuards } from '@nestjs/common';
import { XrayService } from './xray.service';
import { JwtDefaultGuard } from '../../common/guards/jwt-guards/def-jwt-guard';
import {
    StartXrayRequestDto,
    StartXrayResponseDto,
    StopXrayResponseDto,
    GetXrayStatusAndVersionResponseDto,
} from './dtos/';
import { errorHandler } from '../../common/helpers/error-handler.helper';

@Controller(XRAY_CONTROLLER)
@UseGuards(JwtDefaultGuard)
export class XrayController {
    constructor(private readonly xrayService: XrayService) {
        this.xrayService = xrayService;
    }

    @Post(XRAY_ROUTES.START)
    public async startXray(@Body() body: StartXrayRequestDto): Promise<StartXrayResponseDto> {
        const response = await this.xrayService.startXray(body);
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
