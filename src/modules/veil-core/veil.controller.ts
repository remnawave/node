import { Body, Controller, Get, Ip, Logger, Post, UseFilters, UseGuards } from '@nestjs/common';

import { HttpExceptionFilter } from '@common/exception/http-exception.filter';
import { errorHandler } from '@common/helpers/error-handler.helper';
import { JwtDefaultGuard } from '@common/guards/jwt-guards';
import { VEIL_CONTROLLER, VEIL_ROUTES } from '@libs/contracts/api';

import {
    GetNodeHealthCheckVeilResponseDto,
    StartVeilRequestDto,
    StartVeilResponseDto,
    StopVeilResponseDto,
} from './dtos';
import { VeilService } from './veil.service';

@UseFilters(HttpExceptionFilter)
@UseGuards(JwtDefaultGuard)
@Controller(VEIL_CONTROLLER)
export class VeilController {
    private readonly logger = new Logger(VeilController.name);

    constructor(private readonly veilService: VeilService) {}

    @Post(VEIL_ROUTES.START)
    public async startVeil(
        @Body() body: StartVeilRequestDto,
        @Ip() ip: string,
    ): Promise<StartVeilResponseDto> {
        const response = await this.veilService.startVeil(body, ip);
        const data = errorHandler(response);

        return {
            response: data,
        };
    }

    @Get(VEIL_ROUTES.STOP)
    public async stopVeil(): Promise<StopVeilResponseDto> {
        this.logger.log('Remnawave requested to stop Veil.');

        const response = await this.veilService.stopVeil({
            withOnlineCheck: false,
        });
        const data = errorHandler(response);

        return {
            response: data,
        };
    }

    @Get(VEIL_ROUTES.NODE_HEALTH_CHECK)
    public async getNodeHealthCheck(): Promise<GetNodeHealthCheckVeilResponseDto> {
        const response = await this.veilService.getNodeHealthCheck();
        const data = errorHandler(response);

        return {
            response: data,
        };
    }
}
