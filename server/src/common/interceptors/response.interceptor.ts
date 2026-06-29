import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Observable, map } from 'rxjs';

export interface ApiResponse<T = any> {
  code: number;
  message: string;
  data: T;
}

/**
 * Global response interceptor that wraps all controller returns into
 * { code, message, data } format matching Go's pkg/response/response.go.
 *
 * Go: Success(c, data, message) -> { code: http.StatusOK, message, data }
 * Go: SuccessWithStatus(c, code, data, message) -> { code, message, data }
 */
@Injectable()
export class ResponseInterceptor<T> implements NestInterceptor<T, ApiResponse<T>> {
  intercept(context: ExecutionContext, next: CallHandler): Observable<ApiResponse<T>> {
    const statusCode = context.switchToHttp().getResponse().statusCode;
    return next.handle().pipe(
      map((data) => ({
        code: statusCode,
        message: 'success',
        data,
      })),
    );
  }
}
