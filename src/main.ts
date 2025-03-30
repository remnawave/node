import { utilities as nestWinstonModuleUtilities, WinstonModule } from 'nest-winston';
import { ZodValidationPipe } from 'nestjs-zod';
import express, { json } from 'express';
import { createLogger } from 'winston';
import * as winston from 'winston';
import helmet from 'helmet';
import morgan from 'morgan';

import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';

import { NotFoundExceptionFilter } from '@common/exception/not-found-exception.filter';
import { customLogFilter } from '@common/utils/filter-logs/filter-logs';
import { parseNodePayload } from '@common/utils/decode-node-payload';
import { getStartMessage } from '@common/utils/get-start-message';
import { isDevelopment } from '@common/utils/is-development';
import { XRAY_INTERNAL_API_PORT, XRAY_INTERNAL_FULL_PATH } from '@libs/contracts/constants';
import { REST_API, ROOT } from '@libs/contracts/api';

import { AppModule } from './app.module';

const logger = createLogger({
    transports: [new winston.transports.Console()],
    format: winston.format.combine(
        customLogFilter(),
        winston.format.timestamp({
            format: 'YYYY-MM-DD HH:mm:ss.SSS',
        }),
        winston.format.align(),
        // winston.format.ms(),
        nestWinstonModuleUtilities.format.nestLike('', {
            colors: true,
            prettyPrint: true,
            processId: false,
            appName: false,
        }),
    ),
    level: isDevelopment() ? 'debug' : 'info',
});

async function bootstrap(): Promise<void> {
    const nodePayload = parseNodePayload();

    const app = await NestFactory.create(AppModule, {
        httpsOptions: {
            key: nodePayload.nodeKeyPem,
            cert: nodePayload.nodeCertPem,
            ca: [nodePayload.caCertPem],
            requestCert: true,
            rejectUnauthorized: true,
        },
        logger: WinstonModule.createLogger({
            instance: logger,
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
        exclude: [
            XRAY_INTERNAL_FULL_PATH,
            '/' + REST_API.VISION.BLOCK_IP,
            '/' + REST_API.VISION.UNBLOCK_IP,
        ],
    });

    app.useGlobalPipes(new ZodValidationPipe());
    app.enableShutdownHooks();

    await app.listen(Number(config.getOrThrow<string>('APP_PORT')));

    const httpAdapter = app.getHttpAdapter();
    const httpServer = httpAdapter.getInstance();

    const internalApp = express();
    internalApp.use(json({ limit: '1000mb' }));

    internalApp.use(
        [XRAY_INTERNAL_FULL_PATH, '/' + REST_API.VISION.BLOCK_IP, '/' + REST_API.VISION.UNBLOCK_IP],
        (req, res, next) => {
            req.url = req.originalUrl;

            httpServer.handle(req, res, next);
        },
    );

    internalApp.listen(XRAY_INTERNAL_API_PORT, '127.0.0.1');

    logger.info(
        '\n' +
            (await getStartMessage(
                Number(config.getOrThrow<string>('APP_PORT')),
                XRAY_INTERNAL_API_PORT,
                app,
            )) +
            '\n',
    );
}

void bootstrap();
