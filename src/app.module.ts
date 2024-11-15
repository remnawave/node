import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { validateEnvConfig } from '@common/utils/validate-env-config';
import { configSchema, Env } from '@common/config/app-config';
import { XtlsSdkNestjsModule } from '@remnawave/xtls-sdk-nestjs';
import { RemnawaveNodeModules } from './modules/remnawave-node.modules';
import { JwtModule } from '@nestjs/jwt';
import { getJWTConfig } from './common/config/jwt/jwt.config';
import { JwtStrategy } from './common/guards/jwt-guards/strategies/validate-token';

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
        JwtModule.registerAsync(getJWTConfig()),
    ],
    providers: [JwtStrategy],
})
export class AppModule {}
