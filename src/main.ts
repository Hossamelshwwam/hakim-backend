import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { AppModule } from './app.module';
import { ZodValidationPipe } from 'nestjs-zod';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const config = app.get(ConfigService);
  const logger = new Logger('Bootstrap');

  app.setGlobalPrefix('api/v1');

  const allowedOrigins = config
    .get<string>(
      'CORS_ORIGINS',
      'http://localhost:3000,http://localhost:5173,http://localhost:3001',
    )
    .split(',')
    .map((origin) => origin.trim());

  app.enableCors({
    origin: allowedOrigins,
    credentials: true,
  });

  app.useGlobalPipes(new ZodValidationPipe());

  const swaggerConfig = new DocumentBuilder()
    .setTitle('Threadly')
    .setDescription('Threadly description')
    .setVersion('1.0')
    .addBearerAuth()
    .build();

  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('api-docs', app, document);

  const port = config.get<number>('PORT', 3000);
  await app.listen(port);

  logger.log(`Application running on port ${port} (prefix: /api/v1)`);
  logger.log(`CORS allowed origins: ${allowedOrigins.join(', ')}`);
}

bootstrap().catch((err) => {
  const logger = new Logger('Bootstrap');
  logger.error(
    'Failed to start application',
    err instanceof Error ? err.stack : err,
  );
  process.exit(1);
});
