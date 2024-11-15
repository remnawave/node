import { Module } from '@nestjs/common';
import { XrayService } from './xray.service';

import { JwtModule } from '@nestjs/jwt';
import { getJWTConfig } from '../../common/config/jwt/jwt.config';
import { JwtStrategy } from '../../common/guards/jwt-guards/strategies/validate-token';
import { XrayController } from './xray.controller';

@Module({
    imports: [JwtModule.registerAsync(getJWTConfig())],
    providers: [XrayService, JwtStrategy],
    controllers: [XrayController],
})
export class XrayModule {}
