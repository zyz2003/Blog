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
 *
 * Controllers can return either:
 * - Plain data (message defaults to 'success')
 * - { data, message } object for custom messages (e.g., "登录成功")
 */
@Injectable()
export class ResponseInterceptor<T> implements NestInterceptor<T, ApiResponse<T>> {
  intercept(context: ExecutionContext, next: CallHandler): Observable<ApiResponse<T>> {
    const statusCode = context.switchToHttp().getResponse().statusCode;
    return next.handle().pipe(
      map((result) => {
        // Support { data, message } return format for custom success messages
        if (result && typeof result === 'object' && 'data' in result && 'message' in result) {
          return {
            code: statusCode,
            message: result.message,
            data: result.data,
          };
        }
        return {
          code: statusCode,
          message: 'success',
          data: result,
        };
      }),
    );
  }
}
