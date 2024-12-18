import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ConfigService } from '@nestjs/config';
import { ZodValidationPipe } from 'nestjs-zod';
import { NotFoundExceptionFilter } from './common/exception/not-found-exception.filter';
import { ROOT } from '../libs/contract';
import helmet from 'helmet';
import morgan from 'morgan';
import compression from 'compression';
import { isDevelopment } from './common/utils/is-development';

import { utilities as nestWinstonModuleUtilities, WinstonModule } from 'nest-winston';
import * as winston from 'winston';

async function bootstrap(): Promise<void> {
    const app = await NestFactory.create(AppModule, {
        logger: WinstonModule.createLogger({
            transports: [new winston.transports.Console()],
            format: winston.format.combine(
                winston.format.timestamp(),
                winston.format.ms(),
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

    app.setGlobalPrefix(ROOT);

    app.useGlobalPipes(new ZodValidationPipe());
    app.enableShutdownHooks();

    await app.listen(Number(config.getOrThrow<string>('APP_PORT')));
}
void bootstrap();
