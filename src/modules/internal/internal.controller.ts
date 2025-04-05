import { Controller, Get, UseFilters, UseGuards } from '@nestjs/common';

import { PortGuard } from '@common/guards/request-port-guard/request-port.guard';
import { HttpExceptionFilter } from '@common/exception/httpException.filter';
import { OnPort } from '@common/decorators/port/port.decorator';
import {
    XRAY_INTERNAL_API_CONTROLLER,
    XRAY_INTERNAL_API_PATH,
    XRAY_INTERNAL_API_PORT,
} from '@libs/contracts/constants';

import { InternalService } from './internal.service';

@OnPort(XRAY_INTERNAL_API_PORT)
@UseFilters(HttpExceptionFilter)
@UseGuards(PortGuard)
@Controller(XRAY_INTERNAL_API_CONTROLLER)
export class InternalController {
    constructor(private readonly internalService: InternalService) {}

    @Get(XRAY_INTERNAL_API_PATH)
    public async getXrayConfig(): Promise<Record<string, unknown>> {
        try {
            const config = await this.internalService.getXrayConfig();

            return config;
        } catch {
            return {};
        }
    }
}
