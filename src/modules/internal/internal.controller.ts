import { Body, Controller, Get, HttpCode, Post, UseFilters } from '@nestjs/common';
import { EventBus } from '@nestjs/cqrs';

import { HttpExceptionFilter } from '@common/exception';
import {
    XRAY_INTERNAL_API_CONTROLLER,
    XRAY_INTERNAL_API_PATH,
    XRAY_INTERNAL_WEBHOOK_PATH,
} from '@libs/contracts/constants';

import { XrayWebhookEvent } from '../_plugin/events/xray-webhook';
import { InternalService } from './internal.service';

@UseFilters(HttpExceptionFilter)
@Controller(XRAY_INTERNAL_API_CONTROLLER)
export class InternalController {
    constructor(
        private readonly internalService: InternalService,
        private readonly eventBus: EventBus,
    ) {}

    @Get(XRAY_INTERNAL_API_PATH)
    public async getXrayConfig(): Promise<Record<string, unknown>> {
        try {
            const config = await this.internalService.getXrayConfig();

            return config;
        } catch {
            return {};
        }
    }

    @HttpCode(200)
    @Post(XRAY_INTERNAL_WEBHOOK_PATH)
    public handleWebhook(@Body() body: unknown): void {
        void this.eventBus.publish(new XrayWebhookEvent(body));
    }
}
