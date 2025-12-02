import { utilities as nestWinstonModuleUtilities, WinstonModule } from 'nest-winston';
import { ZodValidationPipe } from 'nestjs-zod';
import express, { json } from 'express';
import { createLogger } from 'winston';
import compression from 'compression';
import * as winston from 'winston';
import { Server } from 'https';
import helmet from 'helmet';
import morgan from 'morgan';

import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';

import { parseNodePayload } from '@common/utils/decode-node-payload';
import { getStartMessage } from '@common/utils/get-start-message';
import { isDevelopment } from '@common/utils/is-development';
import { NotFoundExceptionFilter } from '@common/exception';
import { customLogFilter } from '@common/utils/filter-logs';
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

    const nodeHttpServer: Server = app.getHttpServer();
    nodeHttpServer.keepAliveTimeout = 60_000;
    nodeHttpServer.headersTimeout = 61_000;

    app.use(json({ limit: '1000mb' }));

    app.use(compression());

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

    await app.listen(Number(config.getOrThrow<string>('NODE_PORT')));

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

    const internalServer = internalApp.listen(XRAY_INTERNAL_API_PORT, '127.0.0.1');

    let internalServerClosed = false;

    const closeInternalServer = () => {
        if (internalServerClosed) return;
        internalServerClosed = true;

        internalServer.close(() => {
            logger.info('Shutting down...');
        });
    };

    app.enableShutdownHooks();

    process.on('SIGINT', closeInternalServer);
    process.on('SIGTERM', closeInternalServer);

    logger.info(
        '\n' +
            (await getStartMessage(
                Number(config.getOrThrow<string>('NODE_PORT')),
                XRAY_INTERNAL_API_PORT,
                app,
            )) +
            '\n',
    );

    // TODO: Remove this in the next version.
    if (config.getOrThrow<boolean>('HAS_DEPRECATED_SSL_CERT')) {
        logger.error('SSL_CERT is set, but it is deprecated. Use SECRET_KEY instead.');
        logger.error('Please update your .env file to use SECRET_KEY instead of SSL_CERT.');
        logger.error(
            'SSL_CERT has been converted to SECRET_KEY. Automatic migration will be removed in the next version.',
        );
    }

    // TODO: Remove this in the next version.
    if (config.getOrThrow<boolean>('HAS_DEPRECATED_APP_PORT')) {
        logger.error('APP_PORT is set, but it is deprecated. Use NODE_PORT instead.');
        logger.error('Please update your .env file to use NODE_PORT instead of APP_PORT.');
        logger.error(
            'APP_PORT has been converted to NODE_PORT. Automatic migration will be removed in the next version.',
        );
    }
}

void bootstrap();
