import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ThrottlerModule } from '@nestjs/throttler';
import { ScheduleModule } from '@nestjs/schedule';
import { BullModule } from '@nestjs/bull';
import { ServeStaticModule } from '@nestjs/serve-static';
import { join } from 'path';

import { DatabaseModule } from './database/database.module';
import { AuthModule } from './modules/auth/auth.module';
import { HotelModule } from './modules/hotel/hotel.module';
import { RoomModule } from './modules/room/room.module';
import { BookingModule } from './modules/booking/booking.module';
import { GuestModule } from './modules/guest/guest.module';
import { PaymentModule } from './modules/payment/payment.module';
import { InvoiceModule } from './modules/invoice/invoice.module';
import { HousekeepingModule } from './modules/housekeeping/housekeeping.module';
import { EmployeeModule } from './modules/employee/employee.module';
import { NotificationModule } from './modules/notification/notification.module';
import { ReportModule } from './modules/report/report.module';
import { UserModule } from './modules/user/user.module';
import { HealthModule } from './modules/health/health.module';

import { LoggerModule } from './shared/logger/logger.module';
import { PrismaModule } from './shared/prisma/prisma.module';
import { RedisModule } from './shared/redis/redis.module';
import { MailModule } from './shared/mail/mail.module';
import { StorageModule } from './shared/storage/storage.module';
import { AuditModule } from './shared/audit/audit.module';

import configuration from './config/configuration';

@Module({
  imports: [
    // Configuration
    ConfigModule.forRoot({
      isGlobal: true,
      load: [configuration],
      envFilePath: ['.env.local', '.env'],
    }),

    // Throttling
    ThrottlerModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => [
        {
          ttl: configService.get<number>('RATE_LIMIT_WINDOW_MS') || 900000, // 15 minutes
          limit: configService.get<number>('RATE_LIMIT_MAX_REQUESTS') || 100,
        },
      ],
      inject: [ConfigService],
    }),

    // Scheduling
    ScheduleModule.forRoot(),

    // Queue
    BullModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => ({
        redis: {
          host: configService.get<string>('QUEUE_REDIS_HOST') || 'localhost',
          port: configService.get<number>('QUEUE_REDIS_PORT') || 6379,
          password: configService.get<string>('QUEUE_REDIS_PASSWORD') || undefined,
        },
        defaultJobOptions: {
          removeOnComplete: 10,
          removeOnFail: 50,
          attempts: 3,
          backoff: {
            type: 'exponential',
            delay: 2000,
          },
        },
      }),
      inject: [ConfigService],
    }),

    // Static files
    ServeStaticModule.forRoot({
      rootPath: join(__dirname, '..', 'uploads'),
      serveRoot: '/uploads',
      exclude: ['/api/*'],
    }),

    // Core modules
    DatabaseModule,
    PrismaModule,
    RedisModule,
    LoggerModule,
    MailModule,
    StorageModule,
    AuditModule,

    // Business modules
    AuthModule,
    UserModule,
    HotelModule,
    RoomModule,
    BookingModule,
    GuestModule,
    PaymentModule,
    InvoiceModule,
    HousekeepingModule,
    EmployeeModule,
    NotificationModule,
    ReportModule,
    HealthModule,
  ],
  controllers: [],
  providers: [],
})
export class AppModule {}
