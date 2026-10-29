import 'reflect-metadata';
import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import helmet from 'helmet';
import { Logger } from 'nestjs-pino';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';
import { ENV, Env } from './config/config.module';
import { AppModule } from './app.module';
import { createStartupMessage } from './startup-message';

async function bootstrap() {
  // rawBody: required to verify WhatsApp's HMAC signature over the exact bytes Meta sent.
  const app = await NestFactory.create<NestExpressApplication>(AppModule, { bufferLogs: true, rawBody: true });
  const env = app.get<Env>(ENV);
  app.useLogger(app.get(Logger));
  app.enableShutdownHooks();

  if (env.TRUST_PROXY) app.set('trust proxy', 1);
  app.use(helmet());
  app.enableCors({
    origin: env.FRONTEND_ORIGINS.split(',').map((v) => v.trim()).filter(Boolean),
    credentials: false,
  });

  const apiPrefix = env.API_PREFIX.split('/').filter(Boolean).join('/');
  app.setGlobalPrefix(apiPrefix);
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
  app.useGlobalFilters(new AllExceptionsFilter());

  // Swagger: on in development by default, OFF in production unless SWAGGER_ENABLED=true.
  const swaggerEnabled = env.SWAGGER_ENABLED ?? env.NODE_ENV !== 'production';
  if (swaggerEnabled) {
    const config = new DocumentBuilder()
      .setTitle('SalamaLine API')
      .setDescription('Safeguarding-first API. It never contacts emergency services, police or family by itself.')
      .setVersion('1.2.0')
      .addBearerAuth()
      .build();
    SwaggerModule.setup('docs', app, SwaggerModule.createDocument(app, config));
  }

  await (env.HOST ? app.listen(env.PORT, env.HOST) : app.listen(env.PORT));
  const address = app.getHttpServer().address();
  const port = address && typeof address !== 'string' ? address.port : env.PORT;
  const host = env.HOST || (address && typeof address !== 'string' ? address.address : 'localhost');
  console.info(`\n${createStartupMessage({ version: '1.2.0', host, port, apiPrefix, swaggerPath: 'docs', swaggerEnabled })}\n`);
}
void bootstrap();
