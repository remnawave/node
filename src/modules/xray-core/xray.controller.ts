import {
    Body,
    Controller,
    Get,
    Ip,
    Logger,
    Post,
    Req,
    UseFilters,
    UseGuards,
} from '@nestjs/common';

import { HttpExceptionFilter } from '@common/exception/httpException.filter';
import { JwtDefaultGuard } from '@common/guards/jwt-guards/def-jwt-guard';
import { errorHandler } from '@common/helpers/error-handler.helper';
import { XRAY_CONTROLLER, XRAY_ROUTES } from '@libs/contracts/api/controllers/xray';

import {
    GetNodeHealthCheckResponseDto,
    GetXrayStatusAndVersionResponseDto,
    StartXrayRequestDto,
    StartXrayResponseDto,
    StopXrayResponseDto,
} from './dtos/';
import { XrayService } from './xray.service';

@UseGuards(JwtDefaultGuard)
@UseFilters(HttpExceptionFilter)
@Controller(XRAY_CONTROLLER)
export class XrayController {
    private readonly logger = new Logger(XrayController.name);

    constructor(private readonly xrayService: XrayService) {
        this.xrayService = xrayService;
    }

    @Post(XRAY_ROUTES.START)
    public async startXray(
        @Body() body: StartXrayRequestDto,
        @Ip() ip: string,
        @Req() request: Request,
    ): Promise<StartXrayResponseDto> {
        this.logger.log(`Controller: ${JSON.stringify(request.headers)}`);

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

    @Get(XRAY_ROUTES.NODE_HEALTH_CHECK)
    public async getNodeHealthCheck(): Promise<GetNodeHealthCheckResponseDto> {
        const response = await this.xrayService.getNodeHealthCheck();
        const data = errorHandler(response);

        return {
            response: data,
        };
    }
}
