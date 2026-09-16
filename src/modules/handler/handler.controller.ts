import { Body, Controller, Post, UseFilters, UseGuards } from '@nestjs/common';

import { HttpExceptionFilter } from '@common/exception';
import { JwtDefaultGuard } from '@common/guards/jwt-guards';
import { errorHandler } from '@common/helpers';
import { HANDLER_CONTROLLER, HANDLER_ROUTES } from '@libs/contracts/api/controllers/handler';

import {
    AddUsersRequestDto,
    AddUsersResponseDto,
    DropIpsRequestDto,
    DropIpsResponseDto,
    DropUsersConnectionsRequestDto,
    DropUsersConnectionsResponseDto,
    RemoveUserRequestDto,
    RemoveUserResponseDto,
    RemoveUsersRequestDto,
    RemoveUsersResponseDto,
} from './dtos';
import { AddUserRequestDto, AddUserResponseDto } from './dtos/add-user.dto';
import { HandlerService } from './handler.service';

@UseFilters(HttpExceptionFilter)
@UseGuards(JwtDefaultGuard)
@Controller(HANDLER_CONTROLLER)
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

    @Post(HANDLER_ROUTES.REMOVE_USER)
    public async removeUser(@Body() body: RemoveUserRequestDto): Promise<RemoveUserResponseDto> {
        const response = await this.handlerService.removeUser(body);
        const data = errorHandler(response);

        return {
            response: data,
        };
    }

    @Post(HANDLER_ROUTES.ADD_USERS)
    public async addUsers(@Body() body: AddUsersRequestDto): Promise<AddUsersResponseDto> {
        const response = await this.handlerService.addUsers(body);
        const data = errorHandler(response);

        return {
            response: data,
        };
    }

    @Post(HANDLER_ROUTES.REMOVE_USERS)
    public async removeUsers(@Body() body: RemoveUsersRequestDto): Promise<RemoveUsersResponseDto> {
        const response = await this.handlerService.removeUsers(body);
        const data = errorHandler(response);

        return {
            response: data,
        };
    }

    @Post(HANDLER_ROUTES.DROP_USERS_CONNECTIONS)
    public async dropUsersConnections(
        @Body() body: DropUsersConnectionsRequestDto,
    ): Promise<DropUsersConnectionsResponseDto> {
        const response = await this.handlerService.dropUsersConnections(body);
        const data = errorHandler(response);

        return {
            response: data,
        };
    }

    @Post(HANDLER_ROUTES.DROP_IPS)
    public async dropIps(@Body() body: DropIpsRequestDto): Promise<DropIpsResponseDto> {
        const response = await this.handlerService.dropIps(body);
        const data = errorHandler(response);

        return {
            response: data,
        };
    }
}
