import { Body, Controller, Logger, Post, UseFilters, UseGuards } from '@nestjs/common';

import { HttpExceptionFilter } from '@common/exception/http-exception.filter';
import { errorHandler } from '@common/helpers/error-handler.helper';
import { JwtDefaultGuard } from '@common/guards/jwt-guards';
import { FEDARISHA_CONTROLLER, FEDARISHA_ROUTES } from '@libs/contracts/api';

import {
    ProbeFedarishaUserRequestDto,
    ProbeFedarishaUserResponseDto,
    ProvisionFedarishaUserRequestDto,
    ProvisionFedarishaUserResponseDto,
    RevokeFedarishaUserRequestDto,
    RevokeFedarishaUserResponseDto,
} from './dtos';
import { FedarishaPakService } from './fedarisha-pak.service';

@UseFilters(HttpExceptionFilter)
@UseGuards(JwtDefaultGuard)
@Controller(FEDARISHA_CONTROLLER)
export class FedarishaPakController {
    private readonly logger = new Logger(FedarishaPakController.name);

    constructor(private readonly fedarishaPakService: FedarishaPakService) {}

    @Post(FEDARISHA_ROUTES.PROVISION_USER)
    public async provisionUser(
        @Body() body: ProvisionFedarishaUserRequestDto,
    ): Promise<ProvisionFedarishaUserResponseDto> {
        const response = await this.fedarishaPakService.provisionUser(body);
        const data = errorHandler(response);

        return { response: data };
    }

    @Post(FEDARISHA_ROUTES.REVOKE_USER)
    public async revokeUser(
        @Body() body: RevokeFedarishaUserRequestDto,
    ): Promise<RevokeFedarishaUserResponseDto> {
        const response = await this.fedarishaPakService.revokeUser(body);
        const data = errorHandler(response);

        return { response: data };
    }

    @Post(FEDARISHA_ROUTES.PROBE_USER)
    public async probeUser(
        @Body() body: ProbeFedarishaUserRequestDto,
    ): Promise<ProbeFedarishaUserResponseDto> {
        const response = await this.fedarishaPakService.probeUser(body);
        const data = errorHandler(response);

        return { response: data };
    }
}
