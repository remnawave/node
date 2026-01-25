import { Controller, Get, UseFilters, UseGuards } from '@nestjs/common';

import { getInternalRestPort } from '@common/utils/get-initial-ports';
import { PortGuard } from '@common/guards/request-port-guard';
import { HttpExceptionFilter } from '@common/exception';
import { OnPort } from '@common/decorators/port';
import { XRAY_INTERNAL_API_CONTROLLER, XRAY_INTERNAL_API_PATH } from '@libs/contracts/constants';

import { InternalService } from './internal.service';

@OnPort(getInternalRestPort())
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
