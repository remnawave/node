import { Controller, UseGuards, Post, Body, UseFilters } from '@nestjs/common';
import { HANDLER_CONTROLLER, HANDLER_ROUTES } from '@libs/contracts/api/controllers/handler';
import { HandlerService } from './handler.service';
import { JwtDefaultGuard } from '../../common/guards/jwt-guards/def-jwt-guard';
import { AddUserRequestDto, AddUserResponseDto } from './dtos/add-user.dto';
import { errorHandler } from '../../common/helpers/error-handler.helper';
import {
    GetInboundUsersRequestDto,
    GetInboundUsersResponseDto,
} from './dtos/get-inbound-users.dto';
import { RemoveUserRequestDto, RemoveUserResponseDto } from './dtos';
import { HttpExceptionFilter } from '../../common/exception/httpException.filter';
import {
    GetInboundUsersCountRequestDto,
    GetInboundUsersCountResponseDto,
} from './dtos/get-inbound-users-count.dto';

@Controller(HANDLER_CONTROLLER)
@UseGuards(JwtDefaultGuard)
@UseFilters(HttpExceptionFilter)
export class HandlerController {
    constructor(private readonly handlerService: HandlerService) {}

    @Post(HANDLER_ROUTES.ADD_USER)
    public async addUser(@Body() body: AddUserRequestDto): Promise<AddUserResponseDto> {
        const response = await this.handlerService.addUser(body);
        const data = errorHandler(response);

        return {
            response: data,
        };
    }

    @Post(HANDLER_ROUTES.GET_INBOUND_USERS)
    public async getInboundUsers(
        @Body() body: GetInboundUsersRequestDto,
    ): Promise<GetInboundUsersResponseDto> {
        const response = await this.handlerService.getInboundUsers(body.tag);
        const data = errorHandler(response);

        return {
            response: data,
        };
    }

    @Post(HANDLER_ROUTES.REMOVE_USER)
    public async removeUser(@Body() body: RemoveUserRequestDto): Promise<RemoveUserResponseDto> {
        const response = await this.handlerService.removeUser(body);
        const data = errorHandler(response);

        return {
            response: data,
        };
    }

    @Post(HANDLER_ROUTES.GET_INBOUND_USERS_COUNT)
    public async getInboundUsersCount(
        @Body() body: GetInboundUsersCountRequestDto,
    ): Promise<GetInboundUsersCountResponseDto> {
        const response = await this.handlerService.getInboundUsersCount(body.tag);
        const data = errorHandler(response);

        return {
            response: data,
        };
    }
}
