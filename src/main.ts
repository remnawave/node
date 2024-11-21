import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ConfigService } from '@nestjs/config';
import { ZodValidationPipe } from 'nestjs-zod';
import { NotFoundExceptionFilter } from './common/exception/not-found-exception.filter';
import helmet from 'helmet';
import { ROOT } from '../libs/contract';
import { LogLevel } from '@nestjs/common';

async function bootstrap(): Promise<void> {
    const isDevelopment = process.env.NODE_ENV === 'development';

    const logLevels: LogLevel[] = isDevelopment
        ? ['log', 'error', 'warn', 'debug', 'verbose']
        : ['log', 'error', 'warn'];

    const app = await NestFactory.create(AppModule, {
        logger: logLevels,
    });
    const config = app.get(ConfigService);

    app.use(helmet());
    app.use;
    app.useGlobalFilters(new NotFoundExceptionFilter());

    app.setGlobalPrefix(ROOT);

    app.useGlobalPipes(new ZodValidationPipe());
    app.enableShutdownHooks();

    await app.listen(Number(config.getOrThrow<string>('APP_PORT')));
}
void bootstrap();
