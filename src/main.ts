import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ConfigService } from '@nestjs/config';
import { patchNestJsSwagger, ZodValidationPipe } from 'nestjs-zod';
import { NotFoundExceptionFilter } from './common/exception/not-found-exception.filter';
import helmet from 'helmet';

patchNestJsSwagger();

async function bootstrap(): Promise<void> {
    const app = await NestFactory.create(AppModule);
    const config = app.get(ConfigService);

    app.use(helmet());
    app.use;
    app.useGlobalFilters(new NotFoundExceptionFilter());

    app.setGlobalPrefix(config.getOrThrow<string>('API_PREFIX'));

    app.useGlobalPipes(new ZodValidationPipe());
    app.enableShutdownHooks();

    await app.listen(Number(config.getOrThrow<string>('APP_PORT')));
}
void bootstrap();
