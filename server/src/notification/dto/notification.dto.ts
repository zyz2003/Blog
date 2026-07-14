/**
 * In-app notification DTOs.
 * Per D-218, new endpoints for in-app notification management.
 */
export class NotificationResponseDto {
  id: number;
  notificationTypeId: number;
  title: string;
  content: string | null;
  isRead: boolean;
  createdAt: Date | null;
  readAt: Date | null;
}

export class NotificationListResponseDto {
  list: NotificationResponseDto[];
  total: number;
  page: number;
  pageSize: number;
}

export class UnreadCountResponseDto {
  count: number;
}
