import { Injectable, Logger, NotFoundException, OnModuleInit } from '@nestjs/common';
import { NotificationRepository } from './notification.repository';
import { UpdateSimpleNotificationSettingsDto } from './dto/simple-notification-settings.dto';
import { UpdateUserNotificationConfigDto } from './dto/user-notification-config.dto';
import { ErrorCodes } from '../common/constants/error-codes';

/**
 * Default notification types per D-220.
 * Matches Go pkg/domain/model/notification.go DefaultNotificationTypes().
 */
const DEFAULT_NOTIFICATION_TYPES = [
  {
    code: 'comment_reply',
    name: '评论回复通知',
    description: '当您的评论被他人回复时通知您',
    category: 'comment',
    isActive: true,
    defaultEnabled: true,
    supportedChannels: ['email', 'push'],
  },
  {
    code: 'comment_new',
    name: '新评论通知',
    description: '当网站收到新评论时通知博主',
    category: 'comment',
    isActive: true,
    defaultEnabled: true,
    supportedChannels: ['email', 'push'],
  },
  {
    code: 'system_update',
    name: '系统更新通知',
    description: '接收系统更新和新功能介绍',
    category: 'system',
    isActive: true,
    defaultEnabled: true,
    supportedChannels: ['email'],
  },
  {
    code: 'marketing_promo',
    name: '营销推广通知',
    description: '接收活动推荐和优惠信息',
    category: 'marketing',
    isActive: true,
    defaultEnabled: false,
    supportedChannels: ['email'],
  },
];

@Injectable()
export class NotificationService implements OnModuleInit {
  private readonly logger = new Logger(NotificationService.name);

  constructor(private readonly repo: NotificationRepository) {}

  /**
   * Initialize default notification types on startup.
   * Per D-220, matches Go InitializeDefaultNotificationTypes.
   */
  async onModuleInit() {
    await this.initializeDefaultNotificationTypes();
  }

  /**
   * Per D-220, check-then-create-or-update pattern for idempotent initialization.
   * Matches Go InitializeDefaultNotificationTypes exactly.
   * Per Pitfall 7 in RESEARCH.md, this avoids UNIQUE constraint violations on restart.
   */
  async initializeDefaultNotificationTypes() {
    for (const defaultType of DEFAULT_NOTIFICATION_TYPES) {
      const existing = await this.repo.findNotificationTypeByCode(defaultType.code);
      if (!existing) {
        await this.repo.createNotificationType(defaultType);
        this.logger.log(`Created notification type: ${defaultType.code}`);
      } else {
        await this.repo.updateNotificationType(existing.id, {
          name: defaultType.name,
          description: defaultType.description,
          category: defaultType.category,
          isActive: defaultType.isActive,
          defaultEnabled: defaultType.defaultEnabled,
          supportedChannels: defaultType.supportedChannels,
        });
      }
    }
    this.logger.log('Default notification types initialized');
  }

  /**
   * Per D-220, ensure user has default configs for all notification types.
   * Matches Go EnsureUserDefaultConfigs.
   */
  async ensureUserDefaultConfigs(userId: number) {
    const allTypes = await this.repo.findNotificationTypes();
    const existingConfigs = await this.repo.findUserNotificationConfigs(userId);
    const existingTypeIds = new Set(
      existingConfigs.map((c: any) => c.notificationTypeId),
    );

    for (const type of allTypes) {
      if (!existingTypeIds.has(type.id)) {
        await this.repo.createUserNotificationConfig({
          userId,
          notificationTypeId: type.id,
          isEnabled: type.defaultEnabled,
          enabledChannels: type.supportedChannels,
        });
      }
    }

    // Return all configs after ensuring defaults
    return this.repo.findUserNotificationConfigs(userId);
  }

  /**
   * List all notification types.
   * Matches Go ListNotificationTypes.
   */
  async listNotificationTypes() {
    return this.repo.findNotificationTypes();
  }

  /**
   * Find a notification type by code.
   * Exposed for Plan 07 comment→notification integration.
   * Matches Go GetNotificationTypeByCode.
   */
  async findNotificationTypeByCode(code: string) {
    return this.repo.findNotificationTypeByCode(code);
  }

  /**
   * Get simplified notification settings for the current user.
   * Per D-220, only exposes allowCommentReplyNotification boolean.
   * Matches Go GetUserNotificationSettings.
   */
  async getUserNotificationSettings(userId: number) {
    await this.ensureUserDefaultConfigs(userId);
    const configs = await this.repo.findUserNotificationConfigs(userId);

    // Find the comment_reply type config
    const commentReplyConfig = (configs as any[]).find(
      (c: any) => c.notificationType?.code === 'comment_reply',
    );

    return {
      allowCommentReplyNotification: commentReplyConfig?.isEnabled ?? true,
    };
  }

  /**
   * Update simplified notification settings.
   * Per D-220, updates the comment_reply type config.
   * Matches Go UpdateUserNotificationSettings.
   */
  async updateUserNotificationSettings(
    userId: number,
    dto: UpdateSimpleNotificationSettingsDto,
  ) {
    // Find comment_reply type
    const commentReplyType = await this.repo.findNotificationTypeByCode('comment_reply');
    if (!commentReplyType) {
      throw new NotFoundException(ErrorCodes.NOTIFICATION_TYPE_NOT_FOUND);
    }

    // Find or create user config for comment_reply
    let config = await this.repo.findUserNotificationConfig(userId, commentReplyType.id);
    if (!config) {
      config = await this.repo.createUserNotificationConfig({
        userId,
        notificationTypeId: commentReplyType.id,
        isEnabled: dto.allowCommentReplyNotification,
        enabledChannels: commentReplyType.supportedChannels,
      });
    } else {
      config = await this.repo.updateUserNotificationConfig(config.id, {
        isEnabled: dto.allowCommentReplyNotification,
      });
    }

    return {
      allowCommentReplyNotification: dto.allowCommentReplyNotification,
    };
  }

  /**
   * Get full notification configs for the current user.
   * Per D-220, returns all configs with nested notificationType info.
   * Matches Go GetUserNotificationConfigs.
   */
  async getUserNotificationConfigs(userId: number) {
    return this.ensureUserDefaultConfigs(userId);
  }

  /**
   * Update a specific notification config.
   * Matches Go UpdateUserNotificationConfig.
   */
  async updateUserNotificationConfig(
    userId: number,
    configId: number,
    dto: UpdateUserNotificationConfigDto,
  ) {
    const updated = await this.repo.updateUserNotificationConfig(configId, dto);
    if (!updated) {
      throw new NotFoundException(ErrorCodes.NOTIFICATION_CONFIG_UPDATE_FAILED);
    }
    return updated;
  }

  /**
   * Check if a user should be notified for a given type and channel.
   * Matches Go ShouldNotifyUser.
   */
  async shouldNotifyUser(userId: number, typeCode: string, channel: string): Promise<boolean> {
    const type = await this.repo.findNotificationTypeByCode(typeCode);
    if (!type || !type.isActive) return false;

    const config = await this.repo.findUserNotificationConfig(userId, type.id);
    if (!config || !config.isEnabled) return false;

    const channels: string[] = config.enabledChannels ?? [];
    return channels.includes(channel);
  }

  /**
   * Create an in-app notification record.
   * Per D-218, creates a notification in the notifications table.
   */
  async createNotification(params: {
    userId: number;
    notificationTypeId: number;
    title: string;
    content?: string;
  }) {
    return this.repo.createNotification(params);
  }

  /**
   * List in-app notifications with pagination and optional isRead filter.
   * Per D-218.
   */
  async listNotifications(
    userId: number,
    options: { page: number; pageSize: number; isRead?: boolean },
  ) {
    const { list, total } = await this.repo.findNotifications(userId, options);
    return {
      list,
      total,
      page: options.page,
      pageSize: options.pageSize,
    };
  }

  /**
   * Mark a single notification as read.
   * Per D-218, user-scoped for security (T-09-11).
   */
  async markNotificationAsRead(notificationId: number, userId: number) {
    const notification = await this.repo.findNotificationById(notificationId, userId);
    if (!notification) {
      throw new NotFoundException(ErrorCodes.NOTIFICATION_NOT_FOUND);
    }
    return this.repo.markNotificationAsRead(notificationId);
  }

  /**
   * Mark all unread notifications as read for a user.
   * Per D-218.
   */
  async markAllNotificationsAsRead(userId: number) {
    await this.repo.markAllNotificationsAsRead(userId);
  }

  /**
   * Get unread notification count for a user.
   * Per D-218.
   */
  async getUnreadCount(userId: number) {
    const count = await this.repo.countUnreadNotifications(userId);
    return { count };
  }
}
