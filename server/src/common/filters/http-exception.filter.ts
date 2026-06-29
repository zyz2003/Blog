import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
} from '@nestjs/common';
import { Response } from 'express';

/**
 * Global exception filter that formats all HttpException errors into
 * { code, message, data: null } format matching Go's Fail() function.
 *
 * Go: Fail(c, code, message) -> { code: httpStatus, message, data: nil }
 */
@Catch(HttpException)
export class HttpExceptionFilter implements ExceptionFilter {
  catch(exception: HttpException, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const status = exception.getStatus();
    const exceptionResponse = exception.getResponse();

    let message: string;

    if (typeof exceptionResponse === 'string') {
      message = exceptionResponse;
    } else if (
      typeof exceptionResponse === 'object' &&
      exceptionResponse !== null
    ) {
      const resp = exceptionResponse as { message?: string | string[] };
      if (Array.isArray(resp.message)) {
        message = resp.message.join('; ');
      } else if (typeof resp.message === 'string') {
        message = resp.message;
      } else {
        message = exception.message;
      }
    } else {
      message = exception.message;
    }

    response.status(status).json({
      code: status,
      message,
      data: null,
    });
  }
}
