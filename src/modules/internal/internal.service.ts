import { Injectable, Logger } from '@nestjs/common';

@Injectable()
export class InternalService {
    private readonly logger = new Logger(InternalService.name);
    private xrayConfig: null | Record<string, unknown> = null;

    constructor() {}

    public async getXrayConfig(): Promise<Record<string, unknown>> {
        if (!this.xrayConfig) {
            return {};
        }

        return this.xrayConfig;
    }

    public setXrayConfig(config: Record<string, unknown>): void {
        this.logger.debug('Setting new xray config');
        this.xrayConfig = config;
    }
}
