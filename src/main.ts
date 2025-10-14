import { utilities as nestWinstonModuleUtilities, WinstonModule } from 'nest-winston';
import { ZodValidationPipe } from 'nestjs-zod';
import express, { json } from 'express';
import { createLogger } from 'winston';
import compression from 'compression';
import * as winston from 'winston';
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

import net from 'net'

function startProxyStripper(listenPort: number, targetPort: number) {
  const server = net.createServer((client) => {
    client.on('error', (err: NodeJS.ErrnoException) => {
      if (['EPIPE', 'ECONNRESET', 'ERR_STREAM_DESTROYED'].includes(err.code ?? '')) return;
      console.warn('client error (outer):', err.message);
    });

    client.on('end', () => {
      if (!client.destroyed) client.destroy();
    });

    let buf = Buffer.alloc(0);
    let decided = false;
    const MAX_BUFFER_SIZE = 4096;
    const v2sig = Buffer.from([0x0d, 0x0a, 0x0d, 0x0a, 0x00, 0x0d, 0x0a, 0x51, 0x55, 0x49, 0x54, 0x0a]);

    const safeEnd = (sock: net.Socket) => {
      if (!sock.destroyed) sock.destroy();
    };

    const dataHandler = (chunk: Buffer) => {
      if (decided) return;
      buf = Buffer.concat([buf, chunk]);

      if (buf.length > MAX_BUFFER_SIZE) {
        console.warn('proxy-stripper: header too large, dropping connection');
        safeEnd(client);
        return;
      }

      const forward = (rest: Buffer) => {
        const backend = net.connect(targetPort);

        backend.on('error', (err: NodeJS.ErrnoException) => {
          if (['EPIPE', 'ECONNRESET', 'ERR_STREAM_DESTROYED'].includes(err.code ?? '')) return;
          console.warn('backend error:', err.message);
          safeEnd(client);
        });

        client.on('close', () => safeEnd(backend));
        backend.on('close', () => safeEnd(client));

        backend.once('connect', () => {
          if (rest.length) backend.write(rest);
          client.pipe(backend);
          backend.pipe(client);
        });
      };

      // v1
      if (buf.slice(0, 6).toString() === 'PROXY ') {
        const idx = buf.indexOf('\r\n');
        if (idx === -1) return;
        const rest = buf.slice(idx + 2);
        decided = true;
        client.off('data', dataHandler);
        forward(rest);
        return;
      }

      // v2
      if (buf.length >= 16 && buf.slice(0, 12).equals(v2sig)) {
        const len = buf.readUInt16BE(14);
        const total = 16 + len;
        if (buf.length < total) return;
        const rest = buf.slice(total);
        decided = true;
        client.off('data', dataHandler);
        forward(rest);
        return;
      }

      // no proxy
      if (buf.length > 16 && !decided) {
        decided = true;
        client.off('data', dataHandler);
        forward(buf);
      }
    };

    client.on('data', dataHandler);
  });

  server.on('error', (err: NodeJS.ErrnoException) => {
    if (['EPIPE', 'ECONNRESET', 'ERR_STREAM_DESTROYED'].includes(err.code ?? '')) return;
    console.error('proxy-stripper server error:', err.message);
  });

  server.listen(listenPort, () => {
    console.log(`proxy-stripper: listening on ${listenPort}, forwarding to ${targetPort}`);
  });

  return server;
}

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

    await app.listen(38443);

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
                Number(config.getOrThrow<string>('APP_PORT')),
                XRAY_INTERNAL_API_PORT,
                app,
            )) +
            '\n',
    );
}

const OUTER_PORT = Number(process.env.APP_PORT) || 2222;
const INNER_PORT = 38443;

void bootstrap().then(() => {
  startProxyStripper(OUTER_PORT, INNER_PORT);
});
