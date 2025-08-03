import { Body, Controller, Post, UseFilters, UseGuards } from '@nestjs/common';

import { PortGuard } from '@common/guards/request-port-guard/request-port.guard';
import { HttpExceptionFilter } from '@common/exception/httpException.filter';
import { errorHandler } from '@common/helpers/error-handler.helper';
import { OnPort } from '@common/decorators/port/port.decorator';
import { VISION_CONTROLLER, VISION_ROUTES } from '@libs/contracts/api/controllers/vision';
import { XRAY_INTERNAL_API_PORT } from '@libs/contracts/constants';

import { UnblockIpRequestDto, UnblockIpResponseDto } from './dtos/unblock-ip.dto';
import { BlockIpRequestDto, BlockIpResponseDto } from './dtos/block-ip.dto';
import { VisionService } from './vision.service';

@OnPort(XRAY_INTERNAL_API_PORT)
@UseFilters(HttpExceptionFilter)
@UseGuards(PortGuard)
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
