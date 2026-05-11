import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { ConfigService } from '@nestjs/config';
import { LoggerService } from '../logger/logger.service';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  constructor(
    private readonly configService: ConfigService,
    private readonly logger: LoggerService,
  ) {
    super({
      datasources: {
        db: {
          url: configService.get<string>('database.url'),
        },
      },
      log: [
        {
          emit: 'event',
          level: 'query',
        },
        {
          emit: 'event',
          level: 'error',
        },
        {
          emit: 'event',
          level: 'info',
        },
        {
          emit: 'event',
          level: 'warn',
        },
      ],
    });
  }

  async onModuleInit() {
    // Set up event listeners for logging
    this.$on('query', (e) => {
      this.logger.debug(`Query: ${e.query}`, {
        params: e.params,
        duration: e.duration,
        target: e.target,
      });
    });

    this.$on('error', (e) => {
      this.logger.error('Prisma error', e);
    });

    this.$on('info', (e) => {
      this.logger.log('Prisma info', e.message);
    });

    this.$on('warn', (e) => {
      this.logger.warn('Prisma warning', e.message);
    });

    await this.$connect();
    this.logger.log('Database connected successfully');
  }

  async onModuleDestroy() {
    await this.$disconnect();
    this.logger.log('Database disconnected');
  }

  async cleanDatabase() {
    if (this.configService.get<string>('nodeEnv') === 'development') {
      // Only allow in development
      const tablenames = await this.$queryRaw`SELECT tablename FROM pg_tables WHERE schemaname='public'`;

      for (const { tablename } of tablenames) {
        if (tablename !== '_prisma_migrations') {
          try {
            await this.$executeRawUnsafe(`TRUNCATE TABLE "public"."${tablename}" CASCADE;`);
          } catch (error) {
            this.logger.error(`Error truncating table ${tablename}`, error);
          }
        }
      }
    }
  }

  async healthCheck(): Promise<boolean> {
    try {
      await this.$queryRaw`SELECT 1`;
      return true;
    } catch (error) {
      this.logger.error('Database health check failed', error);
      return false;
    }
  }

  async getDatabaseStats() {
    try {
      const stats = await this.$queryRaw`
        SELECT 
          schemaname,
          tablename,
          attname,
          n_distinct,
          correlation
        FROM pg_stats 
        WHERE schemaname = 'public'
        ORDER BY tablename, attname;
      `;
      return stats;
    } catch (error) {
      this.logger.error('Failed to get database stats', error);
      return null;
    }
  }

  async createBackup() {
    // This would typically involve calling pg_dump or similar
    // For now, just log that backup was requested
    this.logger.log('Database backup requested');
    return { message: 'Backup functionality to be implemented' };
  }
}
