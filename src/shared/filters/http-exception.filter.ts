import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  LoggerService,
} from '@nestjs/common';
import { Request, Response } from 'express';

@Catch(HttpException)
export class HttpExceptionFilter implements ExceptionFilter {
  constructor(private readonly logger: LoggerService) {}

  catch(exception: HttpException, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const status = exception.getStatus();
    const exceptionResponse = exception.getResponse();

    let message: string;
    let details: any;

    if (typeof exceptionResponse === 'string') {
      message = exceptionResponse;
    } else if (typeof exceptionResponse === 'object') {
      message = (exceptionResponse as any).message || exception.message;
      details = (exceptionResponse as any).details || (exceptionResponse as any).errors;
    } else {
      message = exception.message;
    }

    // Log the HTTP exception
    this.logger.warn(
      `HTTP Exception: ${request.method} ${request.url} - Status: ${status} - Message: ${message}`,
      {
        method: request.method,
        url: request.url,
        status,
        message,
        details,
        userAgent: request.headers['user-agent'],
        ip: request.ip,
      },
    );

    // Prepare error response
    const errorResponse = {
      statusCode: status,
      timestamp: new Date().toISOString(),
      path: request.url,
      method: request.method,
      message,
      ...(details && { details }),
    };

    response.status(status).json(errorResponse);
  }
}
