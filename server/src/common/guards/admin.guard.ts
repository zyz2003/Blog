import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { decodePublicID, EntityType } from '../utils/sqids.util';
import { ErrorCodes } from '../constants/error-codes';

/**
 * Admin permission guard.
 * Decodes UserGroupID from JWT claims via Sqids, then verifies
 * entityType === EntityType.UserGroup and dbID === 1.
 *
 * Matches Go's AdminAuth middleware exactly:
 * 1. Get claims from context (set by JwtAuthGuard)
 * 2. Decode user_group_id via Sqids
 * 3. Verify entityType === EntityTypeUserGroup
 * 4. Verify dbID === 1 (admin group)
 *
 * Per D-07, D-09: AdminGuard manually applied via @UseGuards(AdminGuard).
 */
@Injectable()
export class AdminGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user) {
      throw new ForbiddenException(ErrorCodes.CLAIMS_NOT_FOUND);
    }

    // Verify claims format
    if (!user.user_group_id) {
      throw new ForbiddenException(ErrorCodes.CLAIMS_FORMAT_INVALID);
    }

    // Decode UserGroupID via Sqids
    let dbID: number;
    let entityType: number;
    try {
      const decoded = decodePublicID(user.user_group_id);
      dbID = decoded.dbID;
      entityType = decoded.entityType;
    } catch {
      throw new ForbiddenException(ErrorCodes.USER_GROUP_ID_INVALID);
    }

    // Verify entityType === UserGroup
    if (entityType !== EntityType.UserGroup) {
      throw new ForbiddenException(ErrorCodes.USER_GROUP_ID_INVALID);
    }

    // Verify dbID === 1 (admin group)
    if (dbID !== 1) {
      throw new ForbiddenException(ErrorCodes.ADMIN_PERMISSION_REQUIRED);
    }

    return true;
  }
}
