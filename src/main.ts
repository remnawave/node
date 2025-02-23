import { utilities as nestWinstonModuleUtilities, WinstonModule } from 'nest-winston';
import { ConfigService } from '@nestjs/config';
import { ZodValidationPipe } from 'nestjs-zod';
import { NestFactory } from '@nestjs/core';
import express, { json } from 'express';
import * as winston from 'winston';
import helmet from 'helmet';
import morgan from 'morgan';

import { XRAY_INTERNAL_API_PORT, XRAY_INTERNAL_FULL_PATH } from '@libs/contracts/constants';
import { NotFoundExceptionFilter } from '@common/exception/not-found-exception.filter';
import { isDevelopment } from '@common/utils/is-development';
import { REST_API, ROOT } from '@libs/contracts/api';

import { AppModule } from './app.module';
async function bootstrap(): Promise<void> {
    const app = await NestFactory.create(AppModule, {
        logger: WinstonModule.createLogger({
            transports: [new winston.transports.Console()],
            format: winston.format.combine(
                winston.format.timestamp(),
                // winston.format.ms(),
                nestWinstonModuleUtilities.format.nestLike('', {
                    colors: true,
                    prettyPrint: true,
                    processId: false,
                    appName: false,
                }),
            ),
            level: isDevelopment() ? 'debug' : 'info',
        }),
    });

    app.use(json({ limit: '1000mb' }));

    const config = app.get(ConfigService);

    app.use(helmet());

    if (isDevelopment()) {
        app.use(morgan('short'));
    }

    app.useGlobalFilters(new NotFoundExceptionFilter());

    app.setGlobalPrefix(ROOT, {
        exclude: [XRAY_INTERNAL_FULL_PATH, REST_API.VISION.BLOCK_IP, REST_API.VISION.UNBLOCK_IP],
    });

    app.useGlobalPipes(new ZodValidationPipe());
    app.enableShutdownHooks();

    await app.listen(Number(config.getOrThrow<string>('APP_PORT')));

    const httpAdapter = app.getHttpAdapter();
    const httpServer = httpAdapter.getInstance();

    const internalApp = express();
    internalApp.use(json({ limit: '1000mb' }));

    internalApp.use(
        [XRAY_INTERNAL_FULL_PATH, REST_API.VISION.BLOCK_IP, REST_API.VISION.UNBLOCK_IP],
        (req, res, next) => {
            req.url = req.originalUrl;

            httpServer.handle(req, res, next);
        },
    );

    internalApp.listen(XRAY_INTERNAL_API_PORT, '127.0.0.1');
}

void bootstrap();
