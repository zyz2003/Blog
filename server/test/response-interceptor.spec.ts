import { describe, it, expect, beforeEach } from 'vitest';
import { ResponseInterceptor } from '../src/common/interceptors/response.interceptor';
import { firstValueFrom } from 'rxjs';

describe('ResponseInterceptor', () => {
  let interceptor: ResponseInterceptor;

  beforeEach(() => {
    interceptor = new ResponseInterceptor();
  });

  it('should wrap response data as { code, message, data } with statusCode 200', async () => {
    const mockContext = {
      switchToHttp: () => ({
        getResponse: () => ({ statusCode: 200 }),
      }),
    } as any;

    const mockCallHandler = {
      handle: () => require('rxjs').of({ test: 'data' }),
    };

    const result = await firstValueFrom(interceptor.intercept(mockContext, mockCallHandler));
    expect(result.code).toBe(200);
    expect(result.message).toBe('success');
    expect(result.data).toEqual({ test: 'data' });
  });

  it('should wrap response data with statusCode 201', async () => {
    const mockContext = {
      switchToHttp: () => ({
        getResponse: () => ({ statusCode: 201 }),
      }),
    } as any;

    const mockCallHandler = {
      handle: () => require('rxjs').of({ id: 1, name: 'created' }),
    };

    const result = await firstValueFrom(interceptor.intercept(mockContext, mockCallHandler));
    expect(result.code).toBe(201);
    expect(result.message).toBe('success');
    expect(result.data).toEqual({ id: 1, name: 'created' });
  });

  it('should handle null data', async () => {
    const mockContext = {
      switchToHttp: () => ({
        getResponse: () => ({ statusCode: 200 }),
      }),
    } as any;

    const mockCallHandler = {
      handle: () => require('rxjs').of(null),
    };

    const result = await firstValueFrom(interceptor.intercept(mockContext, mockCallHandler));
    expect(result.code).toBe(200);
    expect(result.message).toBe('success');
    expect(result.data).toBeNull();
  });

  it('should match Go backend response format structure', async () => {
    const mockContext = {
      switchToHttp: () => ({
        getResponse: () => ({ statusCode: 200 }),
      }),
    } as any;

    const mockCallHandler = {
      handle: () => require('rxjs').of({ items: [1, 2, 3], total: 3 }),
    };

    const result = await firstValueFrom(interceptor.intercept(mockContext, mockCallHandler));
    // Verify format matches Go: { code: int, message: string, data: any }
    expect(result).toHaveProperty('code');
    expect(result).toHaveProperty('message');
    expect(result).toHaveProperty('data');
    expect(typeof result.code).toBe('number');
    expect(typeof result.message).toBe('string');
  });
});
