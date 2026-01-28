import { Body, Controller, Post, UseFilters } from '@nestjs/common';

import { HttpExceptionFilter } from '@common/exception';
import { errorHandler } from '@common/helpers';
import { VISION_CONTROLLER, VISION_ROUTES } from '@libs/contracts/api/controllers/vision';

import { UnblockIpRequestDto, UnblockIpResponseDto } from './dtos/unblock-ip.dto';
import { BlockIpRequestDto, BlockIpResponseDto } from './dtos/block-ip.dto';
import { VisionService } from './vision.service';

@UseFilters(HttpExceptionFilter)
@Controller(VISION_CONTROLLER)
export class VisionController {
    constructor(private readonly visionService: VisionService) {}

    @Post(VISION_ROUTES.BLOCK_IP)
    public async blockIp(@Body() body: BlockIpRequestDto): Promise<BlockIpResponseDto> {
        const response = await this.visionService.blockIp(body);
        const data = errorHandler(response);

        return {
            response: data,
        };
    }

    @Post(VISION_ROUTES.UNBLOCK_IP)
    public async unblockIp(@Body() body: UnblockIpRequestDto): Promise<UnblockIpResponseDto> {
        const response = await this.visionService.unblockIp(body);
        const data = errorHandler(response);

        return {
            response: data,
        };
    }
}
