import {
  Controller,
  Get,
  Put,
  Query,
  Param,
  Body,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { AdminGuard } from '../common/guards/admin.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { decodePublicID, EntityType } from '../common/utils/sqids.util';
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
  @UseGuards(JwtAuthGuard, AdminGuard)
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
  @UseGuards(JwtAuthGuard)
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
  @UseGuards(JwtAuthGuard)
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
  @UseGuards(JwtAuthGuard)
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
   */
  @Get('user/notifications')
  @UseGuards(JwtAuthGuard)
  async listNotifications(
    @CurrentUser() user: any,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
    @Query('isRead') isRead?: string,
  ) {
    const userId = this.getUserId(user);
    return this.notificationService.listNotifications(userId, {
      page: page ? parseInt(page, 10) : 1,
      pageSize: pageSize ? parseInt(pageSize, 10) : 10,
      isRead: isRead !== undefined ? isRead === 'true' : undefined,
    });
  }

  /**
   * PUT /api/user/notifications/:id/read
   * Mark a single notification as read.
   * User-scoped for security (T-09-11).
   */
  @Put('user/notifications/:id/read')
  @UseGuards(JwtAuthGuard)
  async markNotificationAsRead(
    @CurrentUser() user: any,
    @Param('id') id: string,
  ) {
    const userId = this.getUserId(user);
    await this.notificationService.markNotificationAsRead(parseInt(id, 10), userId);
    return null;
  }

  /**
   * PUT /api/user/notifications/read-all
   * Mark all unread notifications as read for current user.
   */
  @Put('user/notifications/read-all')
  @UseGuards(JwtAuthGuard)
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
  @UseGuards(JwtAuthGuard)
  async getUnreadCount(@CurrentUser() user: any) {
    const userId = this.getUserId(user);
    return this.notificationService.getUnreadCount(userId);
  }
}
