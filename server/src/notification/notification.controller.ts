import {
  Controller,
  Get,
  Put,
  Query,
  Param,
  Body,
  ParseIntPipe,
  UseGuards,
} from '@nestjs/common';
import { AdminGuard } from '../common/guards/admin.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { decodePublicID } from '../common/utils/sqids.util';
import { NotificationService } from './notification.service';
import { UpdateSimpleNotificationSettingsDto } from './dto/simple-notification-settings.dto';
import { UpdateUserNotificationConfigDto } from './dto/user-notification-config.dto';

/**
 * NotificationController handles all notification endpoints.
 * Split into admin and user sections matching Go backend route groups.
 *
 * Admin endpoints (JWT + AdminGuard):
 * - GET /api/notification/types
 *
 * User endpoints (JWT only):
 * - GET/PUT /api/user/notification-settings
 * - GET /api/user/notification-configs
 * - GET /api/user/notifications
 * - PUT /api/user/notifications/:id/read
 * - PUT /api/user/notifications/read-all
 * - GET /api/user/notifications/unread-count
 *
 * WR-02 fix: Removed redundant @UseGuards(JwtAuthGuard) — JwtAuthGuard is
 * already registered as a global APP_GUARD in app.module.ts.
 */
@Controller()
export class NotificationController {
  constructor(private readonly notificationService: NotificationService) {}

  /**
   * Helper: extract database user ID from JWT claims.
   * JWT payload has user_id as public ID string (Sqids-encoded).
   */
  private getUserId(user: any): number {
    const decoded = decodePublicID(user.user_id);
    return decoded.dbID;
  }

  // ============================================================
  // Admin endpoints
  // ============================================================

  /**
   * GET /api/notification/types
   * List all notification types. Admin-only.
   * Matches Go ListNotificationTypes (router.go notificationAdmin group).
   */
  @Get('notification/types')
  @UseGuards(AdminGuard)
  async listNotificationTypes() {
    return this.notificationService.listNotificationTypes();
  }

  // ============================================================
  // User endpoints — notification settings (simplified)
  // ============================================================

  /**
   * GET /api/user/notification-settings
   * Get simplified notification settings for current user.
   * Matches Go GetUserNotificationSettings.
   */
  @Get('user/notification-settings')
  async getUserNotificationSettings(@CurrentUser() user: any) {
    const userId = this.getUserId(user);
    return this.notificationService.getUserNotificationSettings(userId);
  }

  /**
   * PUT /api/user/notification-settings
   * Update simplified notification settings for current user.
   * Matches Go UpdateUserNotificationSettings.
   */
  @Put('user/notification-settings')
  async updateUserNotificationSettings(
    @CurrentUser() user: any,
    @Body() dto: UpdateSimpleNotificationSettingsDto,
  ) {
    const userId = this.getUserId(user);
    return this.notificationService.updateUserNotificationSettings(userId, dto);
  }

  // ============================================================
  // User endpoints — notification configs (full)
  // ============================================================

  /**
   * GET /api/user/notification-configs
   * Get full notification configs for current user with nested notificationType.
   * Matches Go GetUserNotificationConfigs.
   */
  @Get('user/notification-configs')
  async getUserNotificationConfigs(@CurrentUser() user: any) {
    const userId = this.getUserId(user);
    return this.notificationService.getUserNotificationConfigs(userId);
  }

  // ============================================================
  // User endpoints — in-app notifications (per D-218)
  // ============================================================

  /**
   * GET /api/user/notifications
   * List in-app notifications with pagination and optional isRead filter.
   * WR-05 fix: Validate page/pageSize bounds to prevent invalid offset calculations.
   */
  @Get('user/notifications')
  async listNotifications(
    @CurrentUser() user: any,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
    @Query('isRead') isRead?: string,
  ) {
    const userId = this.getUserId(user);
    const parsedPage = Math.max(1, parseInt(page || '1', 10) || 1);
    const parsedPageSize = Math.min(100, Math.max(1, parseInt(pageSize || '10', 10) || 10));
    return this.notificationService.listNotifications(userId, {
      page: parsedPage,
      pageSize: parsedPageSize,
      isRead: isRead !== undefined ? isRead === 'true' : undefined,
    });
  }

  /**
   * PUT /api/user/notifications/:id/read
   * Mark a single notification as read.
   * User-scoped for security (T-09-11).
   * WR-01 fix: Use ParseIntPipe for proper 400 on non-numeric ID.
   */
  @Put('user/notifications/:id/read')
  async markNotificationAsRead(
    @CurrentUser() user: any,
    @Param('id', ParseIntPipe) id: number,
  ) {
    const userId = this.getUserId(user);
    await this.notificationService.markNotificationAsRead(id, userId);
    return null;
  }

  /**
   * PUT /api/user/notifications/read-all
   * Mark all unread notifications as read for current user.
   */
  @Put('user/notifications/read-all')
  async markAllNotificationsAsRead(@CurrentUser() user: any) {
    const userId = this.getUserId(user);
    await this.notificationService.markAllNotificationsAsRead(userId);
    return null;
  }

  /**
   * GET /api/user/notifications/unread-count
   * Get unread notification count for current user.
   */
  @Get('user/notifications/unread-count')
  async getUnreadCount(@CurrentUser() user: any) {
    const userId = this.getUserId(user);
    return this.notificationService.getUnreadCount(userId);
  }
}
