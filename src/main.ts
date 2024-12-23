import { utilities as nestWinstonModuleUtilities, WinstonModule } from 'nest-winston';
import { ConfigService } from '@nestjs/config';
import { ZodValidationPipe } from 'nestjs-zod';
import { NestFactory } from '@nestjs/core';
import compression from 'compression';
import * as winston from 'winston';
import express from 'express';
import helmet from 'helmet';
import morgan from 'morgan';

import { XRAY_INTERNAL_API_PORT, XRAY_INTERNAL_FULL_PATH } from '@libs/contracts/constants';
import { NotFoundExceptionFilter } from '@common/exception/not-found-exception.filter';
import { isDevelopment } from '@common/utils/is-development';
import { ROOT } from '@libs/contracts/api';

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
                    processId: true,
                    appName: false,
                }),
            ),
            level: isDevelopment() ? 'debug' : 'info',
        }),
    });

    const config = app.get(ConfigService);

    app.use(helmet());
    app.use(compression());

    if (isDevelopment()) {
        app.use(morgan('short'));
    }

    app.useGlobalFilters(new NotFoundExceptionFilter());

    app.setGlobalPrefix(ROOT, {
        exclude: [XRAY_INTERNAL_FULL_PATH],
    });

    app.useGlobalPipes(new ZodValidationPipe());
    app.enableShutdownHooks();

    await app.listen(Number(config.getOrThrow<string>('APP_PORT')));

    const httpAdapter = app.getHttpAdapter();
    const httpServer = httpAdapter.getInstance();

    const internalApp = express();
    internalApp.use(express.json());
    internalApp.use(compression());

    internalApp.use(XRAY_INTERNAL_FULL_PATH, (req, res, next) => {
        req.url = req.originalUrl;

        httpServer.handle(req, res, next);
    });

    internalApp.listen(XRAY_INTERNAL_API_PORT, '127.0.0.1');
}

void bootstrap();
