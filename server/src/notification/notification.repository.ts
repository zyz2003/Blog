import { Inject, Injectable } from '@nestjs/common';
import { DRIZZLE } from '../database/database.module';
import { notificationTypes } from '../database/schemas/notification-type.schema';
import { userNotificationConfigs } from '../database/schemas/user-notification-config.schema';
import { notifications } from '../database/schemas/notification.schema';
import { eq, and, desc, sql } from 'drizzle-orm';

@Injectable()
export class NotificationRepository {
  constructor(@Inject(DRIZZLE) private readonly db: any) {}

  // ============================================================
  // Notification Types
  // ============================================================

  async findNotificationTypes() {
    return this.db.select().from(notificationTypes);
  }

  async findNotificationTypeByCode(code: string) {
    const [type] = await this.db
      .select()
      .from(notificationTypes)
      .where(eq(notificationTypes.code, code));
    return type ?? undefined;
  }

  async createNotificationType(data: {
    code: string;
    name: string;
    description?: string | null;
    category: string;
    isActive: boolean;
    defaultEnabled: boolean;
    supportedChannels?: string[] | null;
  }) {
    const [type] = await this.db
      .insert(notificationTypes)
      .values(data)
      .returning();
    return type;
  }

  async updateNotificationType(
    id: number,
    data: {
      name?: string;
      description?: string | null;
      category?: string;
      isActive?: boolean;
      defaultEnabled?: boolean;
      supportedChannels?: string[] | null;
    },
  ) {
    const [type] = await this.db
      .update(notificationTypes)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(notificationTypes.id, id))
      .returning();
    return type;
  }

  // ============================================================
  // User Notification Configs
  // ============================================================

  async findUserNotificationConfigs(userId: number) {
    return this.db
      .select({
        id: userNotificationConfigs.id,
        createdAt: userNotificationConfigs.createdAt,
        updatedAt: userNotificationConfigs.updatedAt,
        userId: userNotificationConfigs.userId,
        notificationTypeId: userNotificationConfigs.notificationTypeId,
        isEnabled: userNotificationConfigs.isEnabled,
        enabledChannels: userNotificationConfigs.enabledChannels,
        notificationEmail: userNotificationConfigs.notificationEmail,
        customSettings: userNotificationConfigs.customSettings,
        // Nested notificationType
        notificationType: {
          id: notificationTypes.id,
          code: notificationTypes.code,
          name: notificationTypes.name,
          description: notificationTypes.description,
          category: notificationTypes.category,
          isActive: notificationTypes.isActive,
          defaultEnabled: notificationTypes.defaultEnabled,
          supportedChannels: notificationTypes.supportedChannels,
          createdAt: notificationTypes.createdAt,
          updatedAt: notificationTypes.updatedAt,
        },
      })
      .from(userNotificationConfigs)
      .innerJoin(
        notificationTypes,
        eq(userNotificationConfigs.notificationTypeId, notificationTypes.id),
      )
      .where(eq(userNotificationConfigs.userId, userId));
  }

  async findUserNotificationConfig(userId: number, typeId: number) {
    const [config] = await this.db
      .select()
      .from(userNotificationConfigs)
      .where(
        and(
          eq(userNotificationConfigs.userId, userId),
          eq(userNotificationConfigs.notificationTypeId, typeId),
        ),
      );
    return config ?? undefined;
  }

  async createUserNotificationConfig(data: {
    userId: number;
    notificationTypeId: number;
    isEnabled: boolean;
    enabledChannels?: string[] | null;
    notificationEmail?: string | null;
    customSettings?: Record<string, any> | null;
  }) {
    const [config] = await this.db
      .insert(userNotificationConfigs)
      .values(data)
      .returning();
    return config;
  }

  async updateUserNotificationConfig(
    id: number,
    data: {
      isEnabled?: boolean;
      enabledChannels?: string[] | null;
      notificationEmail?: string | null;
      customSettings?: Record<string, any> | null;
    },
  ) {
    const [config] = await this.db
      .update(userNotificationConfigs)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(userNotificationConfigs.id, id))
      .returning();
    return config;
  }

  // ============================================================
  // In-App Notifications (per D-217, D-218)
  // ============================================================

  async findNotifications(
    userId: number,
    options: { page: number; pageSize: number; isRead?: boolean },
  ) {
    const conditions = [eq(notifications.userId, userId)];

    if (options.isRead !== undefined) {
      conditions.push(eq(notifications.isRead, options.isRead));
    }

    const whereClause = and(...conditions);

    const [{ count: total }] = await this.db
      .select({ count: sql`count(*)` })
      .from(notifications)
      .where(whereClause);

    const list = await this.db
      .select({
        id: notifications.id,
        notificationTypeId: notifications.notificationTypeId,
        title: notifications.title,
        content: notifications.content,
        isRead: notifications.isRead,
        readAt: notifications.readAt,
        createdAt: notifications.createdAt,
      })
      .from(notifications)
      .where(whereClause)
      .orderBy(desc(notifications.createdAt))
      .limit(options.pageSize)
      .offset((options.page - 1) * options.pageSize);

    return { list, total };
  }

  async findNotificationById(id: number, userId: number) {
    const [notification] = await this.db
      .select()
      .from(notifications)
      .where(and(eq(notifications.id, id), eq(notifications.userId, userId)));
    return notification ?? undefined;
  }

  async markNotificationAsRead(id: number) {
    const [notification] = await this.db
      .update(notifications)
      .set({ isRead: true, readAt: new Date() })
      .where(eq(notifications.id, id))
      .returning();
    return notification;
  }

  async markAllNotificationsAsRead(userId: number) {
    await this.db
      .update(notifications)
      .set({ isRead: true, readAt: new Date() })
      .where(and(eq(notifications.userId, userId), eq(notifications.isRead, false)));
  }

  async countUnreadNotifications(userId: number) {
    const [{ count }] = await this.db
      .select({ count: sql`count(*)` })
      .from(notifications)
      .where(and(eq(notifications.userId, userId), eq(notifications.isRead, false)));
    return count as number;
  }

  async createNotification(data: {
    userId: number;
    notificationTypeId: number;
    title: string;
    content?: string | null;
  }) {
    const [notification] = await this.db
      .insert(notifications)
      .values(data)
      .returning();
    return notification;
  }
}
