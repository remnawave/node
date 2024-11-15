import { Module } from '@nestjs/common';
import { StatsController } from './stats.controller';
import { StatsService } from './stats.service';
import { JwtModule } from '@nestjs/jwt';
import { JwtStrategy } from '../../common/guards/jwt-guards/strategies/validate-token';
import { getJWTConfig } from '../../common/config/jwt/jwt.config';

@Module({
    imports: [JwtModule.registerAsync(getJWTConfig())],
    providers: [StatsService, JwtStrategy],
    controllers: [StatsController],
})
export class StatsModule {}
