import { Controller, Get, UseFilters } from '@nestjs/common';

import { HttpExceptionFilter } from '@common/exception';
import { XRAY_INTERNAL_API_CONTROLLER, XRAY_INTERNAL_API_PATH } from '@libs/contracts/constants';

import { InternalService } from './internal.service';

@UseFilters(HttpExceptionFilter)
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
