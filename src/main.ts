import { utilities as nestWinstonModuleUtilities, WinstonModule } from 'nest-winston';
import * as bodyParser from '@kastov/body-parser-with-zstd';
import { ZodValidationPipe } from 'nestjs-zod';
import express, { json } from 'express';
import { createLogger } from 'winston';
import compression from 'compression';
import * as winston from 'winston';
import { Server } from 'https';
import * as fs from 'node:fs';
import helmet from 'helmet';
import morgan from 'morgan';

import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';

import { initializeMTLSCerts } from '@common/utils/generate-mtls-certs';
import { parseNodePayload } from '@common/utils/decode-node-payload';
import { getStartMessage } from '@common/utils/get-start-message';
import { isDevelopment } from '@common/utils/is-development';
import { NotFoundExceptionFilter } from '@common/exception';
import { customLogFilter } from '@common/utils/filter-logs';
import { XRAY_INTERNAL_API_SOCKET_PATH, XRAY_INTERNAL_FULL_PATH } from '@libs/contracts/constants';
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
    if (fs.existsSync(XRAY_INTERNAL_API_SOCKET_PATH)) {
        fs.unlinkSync(XRAY_INTERNAL_API_SOCKET_PATH);
    }

    await initializeMTLSCerts();

    const nodePayload = parseNodePayload();

    const app = await NestFactory.create(AppModule, {
        httpsOptions: {
            key: nodePayload.nodeKeyPem,
            cert: nodePayload.nodeCertPem,
            ca: [nodePayload.caCertPem],
            requestCert: true,
            rejectUnauthorized: true,
        },
        bodyParser: false,
        logger: WinstonModule.createLogger({
            instance: logger,
        }),
    });

    app.use(
        bodyParser.json({
            limit: '1000mb',
        }),
    );

    const nodeHttpServer: Server = app.getHttpServer();
    nodeHttpServer.keepAliveTimeout = 60_000;
    nodeHttpServer.headersTimeout = 61_000;

    // app.use(json({ limit: '1000mb' }));

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

    // '/' + REST_API.VISION.BLOCK_IP, '/' + REST_API.VISION.UNBLOCK_IP
    internalApp.use([XRAY_INTERNAL_FULL_PATH], (req, res, next) => {
        req.url = req.originalUrl;

        httpServer.handle(req, res, next);
    });

    const internalServer = internalApp.listen(XRAY_INTERNAL_API_SOCKET_PATH);

    let internalServerClosed = false;

    const closeInternalServer = () => {
        if (internalServerClosed) return;
        internalServerClosed = true;

        internalServer.close(() => {
            if (fs.existsSync(XRAY_INTERNAL_API_SOCKET_PATH)) {
                fs.unlinkSync(XRAY_INTERNAL_API_SOCKET_PATH);
            }

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

                app,
            )) +
            '\n',
    );
}

void bootstrap();
