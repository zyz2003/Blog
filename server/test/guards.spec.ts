import { describe, it, expect, beforeEach } from 'vitest';
import { Reflector } from '@nestjs/core';
import { ForbiddenException } from '@nestjs/common';
import { JwtAuthGuard } from '../src/common/guards/jwt-auth.guard';
import { JwtAuthOptionalGuard } from '../src/common/guards/jwt-auth-optional.guard';
import { AdminGuard } from '../src/common/guards/admin.guard';
import { IS_PUBLIC_KEY } from '../src/common/decorators/public.decorator';
import {
  initSqidsEncoderWithSeed,
  generatePublicID,
  EntityType,
} from '../src/common/utils/sqids.util';

describe('JwtAuthGuard', () => {
  let guard: JwtAuthGuard;
  let reflector: Reflector;

  beforeEach(() => {
    reflector = new Reflector();
    guard = new JwtAuthGuard(reflector);
  });

  it('should return true when @Public() decorator is present on handler', () => {
    const handler = () => {};
    Reflect.defineMetadata(IS_PUBLIC_KEY, true, handler);

    const mockContext = {
      switchToHttp: () => ({
        getRequest: () => ({ headers: {} }),
        getResponse: () => ({ statusCode: 200 }),
      }),
      getHandler: () => handler,
      getClass: () => class {},
    } as any;

    const result = guard.canActivate(mockContext);
    expect(result).toBe(true);
  });

  it('should return true when @Public() decorator is present on controller class', () => {
    class PublicController {}
    Reflect.defineMetadata(IS_PUBLIC_KEY, true, PublicController);

    const mockContext = {
      switchToHttp: () => ({
        getRequest: () => ({ headers: {} }),
        getResponse: () => ({ statusCode: 200 }),
      }),
      getHandler: () => () => {},
      getClass: () => PublicController,
    } as any;

    const result = guard.canActivate(mockContext);
    expect(result).toBe(true);
  });

  it('should not return true when no @Public() is present', () => {
    const mockContext = {
      switchToHttp: () => ({
        getRequest: () => ({ headers: {} }),
        getResponse: () => ({ statusCode: 200 }),
      }),
      getHandler: () => () => {},
      getClass: () => class {},
    } as any;

    // Without @Public(), guard should not short-circuit to true
    // It will delegate to AuthGuard('jwt') which needs passport strategy
    // We just verify it doesn't return true (meaning @Public() was not found)
    const result = guard.canActivate(mockContext);
    expect(result).not.toBe(true);
  });
});

describe('JwtAuthOptionalGuard', () => {
  let guard: JwtAuthOptionalGuard;

  beforeEach(() => {
    guard = new JwtAuthOptionalGuard();
  });

  it('should return true when no Authorization header is present (guest)', () => {
    const mockContext = {
      switchToHttp: () => ({
        getRequest: () => ({ headers: {} }),
      }),
    } as any;

    const result = guard.canActivate(mockContext);
    expect(result).toBe(true);
  });

  it('should return true for malformed Authorization header (not Bearer format)', () => {
    const mockContext = {
      switchToHttp: () => ({
        getRequest: () => ({ headers: { authorization: 'Basic abc123' } }),
      }),
    } as any;

    const result = guard.canActivate(mockContext);
    expect(result).toBe(true);
  });

  it('should return true when Authorization header has only one part', () => {
    const mockContext = {
      switchToHttp: () => ({
        getRequest: () => ({ headers: { authorization: 'just-a-token' } }),
      }),
    } as any;

    const result = guard.canActivate(mockContext);
    expect(result).toBe(true);
  });

  it('should not return true for valid Bearer format (delegates to AuthGuard)', () => {
    const mockContext = {
      switchToHttp: () => ({
        getRequest: () => ({ headers: { authorization: 'Bearer some-token' } }),
        getResponse: () => ({ statusCode: 200, setHeader: () => {}, end: () => {} }),
      }),
    } as any;

    // With Bearer token present, guard delegates to AuthGuard('jwt')
    // It should not short-circuit to true
    const result = guard.canActivate(mockContext);
    expect(result).not.toBe(true);
  });
});

describe('AdminGuard', () => {
  let guard: AdminGuard;

  beforeEach(() => {
    guard = new AdminGuard();
    // Initialize Sqids with a test seed for consistent encoding
    initSqidsEncoderWithSeed('test-seed-for-admin-guard');
  });

  it('should throw ForbiddenException when no user on request', () => {
    const mockContext = {
      switchToHttp: () => ({
        getRequest: () => ({}),
      }),
    } as any;

    expect(() => guard.canActivate(mockContext)).toThrow(ForbiddenException);
  });

  it('should throw ForbiddenException when user has no user_group_id', () => {
    const mockContext = {
      switchToHttp: () => ({
        getRequest: () => ({ user: { user_id: 'some-id' } }),
      }),
    } as any;

    expect(() => guard.canActivate(mockContext)).toThrow(ForbiddenException);
  });

  it('should return true when UserGroupID decodes to dbID=1 and entityType=UserGroup', () => {
    const adminGroupId = generatePublicID(1, EntityType.UserGroup);

    const mockContext = {
      switchToHttp: () => ({
        getRequest: () => ({ user: { user_id: 'user-1', user_group_id: adminGroupId } }),
      }),
    } as any;

    const result = guard.canActivate(mockContext);
    expect(result).toBe(true);
  });

  it('should throw ForbiddenException when UserGroupID decodes to dbID=2 (non-admin)', () => {
    const nonAdminGroupId = generatePublicID(2, EntityType.UserGroup);

    const mockContext = {
      switchToHttp: () => ({
        getRequest: () => ({
          user: { user_id: 'user-2', user_group_id: nonAdminGroupId },
        }),
      }),
    } as any;

    expect(() => guard.canActivate(mockContext)).toThrow(ForbiddenException);
  });

  it('should throw ForbiddenException when UserGroupID has wrong entityType', () => {
    const wrongTypeId = generatePublicID(1, EntityType.Article);

    const mockContext = {
      switchToHttp: () => ({
        getRequest: () => ({
          user: { user_id: 'user-3', user_group_id: wrongTypeId },
        }),
      }),
    } as any;

    expect(() => guard.canActivate(mockContext)).toThrow(ForbiddenException);
  });
});
