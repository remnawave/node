import { ChannelCredentials } from 'nice-grpc';
import { experimental } from '@grpc/grpc-js';

import { ConfigModule, ConfigService } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';

import { XtlsSdkNestjsModule } from '@remnawave/xtls-sdk-nestjs';

import { JwtStrategy } from '@common/guards/jwt-guards/strategies/validate-token';
import { AbstractUdsResolver } from '@common/utils/unix-abstract.resolver';
import { validateEnvConfig } from '@common/utils/validate-env-config';
import { configSchema, Env } from '@common/config/app-config';
import { getJWTConfig } from '@common/config/jwt/jwt.config';

import { RemnawaveNodeModules } from './modules/remnawave-node.modules';
import { InternalModule } from './modules/internal/internal.module';

experimental.registerResolver('unix-abstract', AbstractUdsResolver);

@Module({
    imports: [
        ConfigModule.forRoot({
            isGlobal: true,
            envFilePath: '.env',
            validate: (config) => validateEnvConfig<Env>(configSchema, config),
        }),
        ScheduleModule.forRoot(),
        XtlsSdkNestjsModule.forRootAsync({
            imports: [],
            inject: [ConfigService],
            useFactory: (configService: ConfigService) => {
                return {
                    connectionUrl: `unix-abstract:///${configService.getOrThrow<string>('XTLS_API_SOCKET_PATH')}`,
                    credentials: ChannelCredentials.createInsecure(),
                    options: {
                        'grpc.max_receive_message_length': 100_000_000, // 100MB
                    },
                };
            },
        }),
        RemnawaveNodeModules,
        InternalModule,
        JwtModule.registerAsync(getJWTConfig()),
    ],
    providers: [JwtStrategy],
    exports: [],
})
export class AppModule {}
