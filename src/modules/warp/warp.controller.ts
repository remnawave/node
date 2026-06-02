import { Controller, Get, Post, UseFilters, UseGuards } from '@nestjs/common';

import { JwtDefaultGuard } from '@common/guards/jwt-guards';
import { HttpExceptionFilter } from '@common/exception';
import { WARP_CONTROLLER, WARP_ROUTES } from '@libs/contracts/api';
import {
    DisableWarpCommand,
    EnableWarpCommand,
    GetWarpStatusCommand,
} from '@libs/contracts/commands';

import { WarpService } from './warp.service';

@UseFilters(HttpExceptionFilter)
@UseGuards(JwtDefaultGuard)
@Controller(WARP_CONTROLLER)
export class WarpController {
    constructor(private readonly warpService: WarpService) {}

    @Get(WARP_ROUTES.STATUS)
    public async status(): Promise<GetWarpStatusCommand.Response> {
        return {
            response: await this.warpService.getStatus(),
        };
    }

    @Post(WARP_ROUTES.ENABLE)
    public async enable(): Promise<EnableWarpCommand.Response> {
        return {
            response: await this.warpService.enable(),
        };
    }

    @Post(WARP_ROUTES.DISABLE)
    public async disable(): Promise<DisableWarpCommand.Response> {
        return {
            response: await this.warpService.disable(),
        };
    }
}
