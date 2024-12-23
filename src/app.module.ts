import { XtlsSdkNestjsModule } from '@remnawave/xtls-sdk-nestjs';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';

import { JwtStrategy } from '@common/guards/jwt-guards/strategies/validate-token';
import { validateEnvConfig } from '@common/utils/validate-env-config';
import { configSchema, Env } from '@common/config/app-config';
import { getJWTConfig } from '@common/config/jwt/jwt.config';

import { RemnawaveNodeModules } from './modules/remnawave-node.modules';
import { InternalModule } from './modules/internal/internal.module';

@Module({
    imports: [
        ConfigModule.forRoot({
            isGlobal: true,
            envFilePath: '.env',

            validate: (config) => validateEnvConfig<Env>(configSchema, config),
        }),
        XtlsSdkNestjsModule.forRootAsync({
            useFactory: (configService: ConfigService) => ({
                ip: configService.getOrThrow<string>('XTLS_IP'),
                port: configService.getOrThrow<string>('XTLS_PORT'),
            }),
            inject: [ConfigService],
        }),
        RemnawaveNodeModules,
        InternalModule,
        JwtModule.registerAsync(getJWTConfig()),
    ],
    providers: [JwtStrategy],
    exports: [],
})
export class AppModule {}
