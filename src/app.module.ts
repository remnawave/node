import { ChannelCredentials } from 'nice-grpc';

import { ConfigModule, ConfigService } from '@nestjs/config';
import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';

import { SupervisordNestjsModule } from '@remnawave/supervisord-nestjs';
import { XtlsSdkNestjsModule } from '@remnawave/xtls-sdk-nestjs';

import { JwtStrategy } from '@common/guards/jwt-guards/strategies/validate-token';
import { validateEnvConfig } from '@common/utils/validate-env-config';
import { getClientCerts } from '@common/utils/generate-mtls-certs';
import { getXtlsApiPort } from '@common/utils/get-initial-ports';
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
            imports: [],
            inject: [],
            useFactory: () => {
                const certs = getClientCerts();
                return {
                    connectionUrl: `127.0.0.1:${getXtlsApiPort()}`,
                    credentials: ChannelCredentials.createSsl(
                        Buffer.from(certs.caCertPem),
                        Buffer.from(certs.clientKeyPem),
                        Buffer.from(certs.clientCertPem),
                        {
                            rejectUnauthorized: true,
                        },
                    ),
                    options: {
                        'grpc.max_receive_message_length': 100_000_000, // 100MB
                        'grpc.ssl_target_name_override': 'internal.remnawave.local',
                    },
                };
            },
        }),
        SupervisordNestjsModule.forRootAsync({
            imports: [ConfigModule],
            inject: [ConfigService],
            useFactory: (configService: ConfigService) => ({
                connectionUrl: `http://unix:/tmp/supervisord.sock:/RPC2`,
                options: {
                    username: configService.getOrThrow<string>('SUPERVISORD_USER'),
                    password: configService.getOrThrow<string>('SUPERVISORD_PASSWORD'),
                },
            }),
        }),
        RemnawaveNodeModules,
        InternalModule,
        JwtModule.registerAsync(getJWTConfig()),
    ],
    providers: [JwtStrategy],
    exports: [],
})
export class AppModule {}
