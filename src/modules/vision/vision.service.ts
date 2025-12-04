import { Injectable, Logger } from '@nestjs/common';

import { ICommandResponse } from '@common/types/command-response.type';
import { ERRORS } from '@libs/contracts/constants/errors';

import { BlockIpResponseModel, UnblockIpResponseModel } from './models';
import { BlockIpRequestDto, UnblockIpRequestDto } from './dtos';

/**
 * Vision service for IP blocking functionality.
 *
 * NOTE: This is a stub implementation as sing-box does not have
 * a runtime API for managing route rules dynamically.
 *
 * To block IPs in sing-box, rules must be added to the config
 * and the process must be restarted. This is not implemented
 * as it would require frequent restarts and is not practical.
 *
 * TODO: Consider alternative approaches:
 * 1. Use external firewall (iptables/nftables)
 * 2. Integrate with fail2ban
 * 3. Use sing-box rule-set files that can be reloaded
 */
@Injectable()
export class VisionService {
    private readonly logger = new Logger(VisionService.name);

    constructor() {
        this.logger.warn(
            'VisionService: IP blocking is not supported in sing-box mode. ' +
            'Consider using external firewall or fail2ban for IP blocking.',
        );
    }

    /**
     * Blocks an IP address.
     * Stub: Always returns failure as not supported in sing-box.
     */
    public async blockIp(dto: BlockIpRequestDto): Promise<ICommandResponse<BlockIpResponseModel>> {
        this.logger.warn(`blockIp called for IP: ${dto.ip} - not supported in sing-box mode`);

        return {
            isOk: true,
            response: new BlockIpResponseModel(
                false,
                'IP blocking is not supported in sing-box mode. Use external firewall.',
            ),
        };
    }

    /**
     * Unblocks an IP address.
     * Stub: Always returns failure as not supported in sing-box.
     */
    public async unblockIp(
        dto: UnblockIpRequestDto,
    ): Promise<ICommandResponse<UnblockIpResponseModel>> {
        this.logger.warn(`unblockIp called for IP: ${dto.ip} - not supported in sing-box mode`);

        return {
            isOk: true,
            response: new UnblockIpResponseModel(
                false,
                'IP unblocking is not supported in sing-box mode. Use external firewall.',
            ),
        };
    }
}
