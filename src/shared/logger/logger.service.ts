import { Injectable, LoggerService as NestLoggerService, LogLevel } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as winston from 'winston';
import * as DailyRotateFile from 'winston-daily-rotate-file';

@Injectable()
export class LoggerService implements NestLoggerService {
  private readonly logger: winston.Logger;
  private readonly context: string;

  constructor(private readonly configService: ConfigService) {
    const logLevel = this.configService.get<string>('logging.level') || 'info';
    const logPath = this.configService.get<string>('logging.filePath') || 'logs';

    // Define log format
    const logFormat = winston.format.combine(
      winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
      winston.format.errors({ stack: true }),
      winston.format.json(),
      winston.format.printf(({ timestamp, level, message, context, trace, ...meta }) => {
        return JSON.stringify({
          timestamp,
          level,
          message,
          context,
          trace,
          ...meta,
        });
      }),
    );

    // Create logger instance
    this.logger = winston.createLogger({
      level: logLevel,
      format: logFormat,
      defaultMeta: { service: 'nhms-api' },
      transports: [
        // Console transport for development
        new winston.transports.Console({
          format: winston.format.combine(
            winston.format.colorize(),
            winston.format.simple(),
            winston.format.printf(({ timestamp, level, message, context }) => {
              return `${timestamp} [${context || 'App'}] ${level}: ${message}`;
            }),
          ),
        }),

        // File transport for errors
        new DailyRotateFile({
          filename: `${logPath}/error-%DATE%.log`,
          datePattern: 'YYYY-MM-DD',
          level: 'error',
          maxSize: '20m',
          maxFiles: '14d',
          format: logFormat,
        }),

        // File transport for all logs
        new DailyRotateFile({
          filename: `${logPath}/combined-%DATE%.log`,
          datePattern: 'YYYY-MM-DD',
          maxSize: '20m',
          maxFiles: '14d',
          format: logFormat,
        }),
      ],
    });

    // Handle uncaught exceptions
    this.logger.exceptions.handle(
      new DailyRotateFile({
        filename: `${logPath}/exceptions-%DATE%.log`,
        datePattern: 'YYYY-MM-DD',
        maxSize: '20m',
        maxFiles: '14d',
      }),
    );

    // Handle unhandled promise rejections
    this.logger.rejections.handle(
      new DailyRotateFile({
        filename: `${logPath}/rejections-%DATE%.log`,
        datePattern: 'YYYY-MM-DD',
        maxSize: '20m',
        maxFiles: '14d',
      }),
    );
  }

  setContext(context: string): void {
    (this as any).context = context;
  }

  log(message: any, context?: string): void {
    this.logger.info(message, { context: context || this.context });
  }

  error(message: any, trace?: string, context?: string): void {
    this.logger.error(message, { trace, context: context || this.context });
  }

  warn(message: any, context?: string): void {
    this.logger.warn(message, { context: context || this.context });
  }

  debug(message: any, context?: string): void {
    this.logger.debug(message, { context: context || this.context });
  }

  verbose(message: any, context?: string): void {
    this.logger.verbose(message, { context: context || this.context });
  }

  // Custom methods for structured logging
  logRequest(req: any, res: any, responseTime: number): void {
    const { method, originalUrl, ip, headers } = req;
    const { statusCode } = res;

    this.logger.info('HTTP Request', {
      method,
      url: originalUrl,
      statusCode,
      responseTime: `${responseTime}ms`,
      ip,
      userAgent: headers['user-agent'],
      context: 'HTTP',
    });
  }

  logError(error: Error, context?: string): void {
    this.logger.error('Application Error', {
      message: error.message,
      stack: error.stack,
      context: context || this.context,
    });
  }

  logDatabaseQuery(query: string, params: any, duration: number): void {
    this.logger.debug('Database Query', {
      query,
      params,
      duration: `${duration}ms`,
      context: 'Database',
    });
  }

  logAuthEvent(event: string, userId?: string, details?: any): void {
    this.logger.info('Authentication Event', {
      event,
      userId,
      details,
      context: 'Auth',
    });
  }

  logBusinessEvent(event: string, entityId: string, entityType: string, userId?: string, details?: any): void {
    this.logger.info('Business Event', {
      event,
      entityId,
      entityType,
      userId,
      details,
      context: 'Business',
    });
  }

  logSecurityEvent(event: string, details: any): void {
    this.logger.warn('Security Event', {
      event,
      details,
      context: 'Security',
    });
  }

  logPerformanceMetric(metric: string, value: number, unit?: string, details?: any): void {
    this.logger.info('Performance Metric', {
      metric,
      value,
      unit,
      details,
      context: 'Performance',
    });
  }

  // Health check for logger
  healthCheck(): { status: string; message: string } {
    try {
      this.logger.info('Logger health check', { context: 'Health' });
      return { status: 'healthy', message: 'Logger is working correctly' };
    } catch (error) {
      return { status: 'unhealthy', message: `Logger error: ${error.message}` };
    }
  }

  // Get logger instance for external use
  getLogger(): winston.Logger {
    return this.logger;
  }
}
