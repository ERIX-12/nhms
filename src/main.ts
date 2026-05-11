import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { ConfigService } from '@nestjs/config';
import helmet from 'helmet';
import * as compression from 'compression';

import { AppModule } from './app.module';
import { LoggerService } from './shared/logger/logger.service';
import { AllExceptionsFilter } from './shared/filters/all-exceptions.filter';
import { ResponseInterceptor } from './shared/interceptors/response.interceptor';
import { HttpExceptionFilter } from './shared/filters/http-exception.filter';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    logger: ['error', 'warn', 'log', 'debug', 'verbose'],
  });

  const configService = app.get(ConfigService);
  const logger = app.get(LoggerService);

  // Security middleware
  app.use(helmet());
  app.use(compression());

  // CORS configuration
  const corsOrigin = configService.get<string>('CORS_ORIGIN') || 'http://localhost:3000';
  app.enableCors({
    origin: corsOrigin,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  });

  // Global pipes
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: {
        enableImplicitConversion: true,
      },
    }),
  );

  // Global filters
  app.useGlobalFilters(new AllExceptionsFilter(logger));
  app.useGlobalFilters(new HttpExceptionFilter(logger));

  // Global interceptors
  app.useGlobalInterceptors(new ResponseInterceptor());

  // API prefix
  const apiPrefix = configService.get<string>('API_PREFIX') || 'api/v1';
  app.setGlobalPrefix(apiPrefix);

  // Swagger documentation
  if (configService.get<string>('NODE_ENV') !== 'production') {
    const config = new DocumentBuilder()
      .setTitle('Nyaika Hotel Management System API')
      .setDescription('Production-ready Hotel Management System API documentation')
      .setVersion('1.0.0')
      .addBearerAuth()
      .addTag('Authentication')
      .addTag('Hotels')
      .addTag('Rooms')
      .addTag('Bookings')
      .addTag('Guests')
      .addTag('Payments')
      .addTag('Invoices')
      .addTag('Housekeeping')
      .addTag('Employees')
      .addTag('Notifications')
      .addTag('Reports')
      .addServer(`http://localhost:${configService.get('PORT') || 3001}/${apiPrefix}`)
      .build();

    const document = SwaggerModule.createDocument(app, config);
    SwaggerModule.setup(`${apiPrefix}/docs`, app, document, {
      swaggerOptions: {
        persistAuthorization: true,
        displayRequestDuration: true,
        filter: true,
        showExtensions: true,
        showCommonExtensions: true,
        tryItOutEnabled: true,
      },
      customSiteTitle: 'NHMS API Documentation',
      customfavIcon: '/favicon.ico',
      customCss: `
        .topbar-wrapper img { content: url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMzIiIGhlaWdodD0iMzIiIHZpZXdCb3g9IjAgMCAzMiAzMiIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHJlY3Qgd2lkdGg9IjMyIiBoZWlnaHQ9IjMyIiByeD0iOCIgZmlsbD0iIzJEM0E4NCIvPgo8cGF0aCBkPSJNOCAxNkgxNlY4SDhWMTZaTTE2IDE2SDI0VjhIMTZWMTZaTTggMjRIMTZWMTZIOFYyNFpNMTYgMjRIMjRWMTZIMTZWMjRaIiBmaWxsPSJ3aGl0ZSIvPgo8L3N2Zz4='); }
        .swagger-ui .topbar { background-color: #2D3A84; }
        .swagger-ui .topbar-wrapper .link { color: white; }
      `,
    });

    logger.log('Swagger documentation available at: /' + apiPrefix + '/docs');
  }

  // Graceful shutdown
  process.on('SIGTERM', async () => {
    logger.log('SIGTERM signal received: closing HTTP server');
    await app.close();
    process.exit(0);
  });

  process.on('SIGINT', async () => {
    logger.log('SIGINT signal received: closing HTTP server');
    await app.close();
    process.exit(0);
  });

  // Start server
  const port = configService.get<number>('PORT') || 3001;
  await app.listen(port);

  logger.log(`🚀 Application is running on: http://localhost:${port}/${apiPrefix}`);
  logger.log(`📚 Environment: ${configService.get('NODE_ENV')}`);
  logger.log(`🏨 Nyaika Hotel Management System started successfully`);
}

bootstrap().catch((error) => {
  console.error('Failed to start application:', error);
  process.exit(1);
});
