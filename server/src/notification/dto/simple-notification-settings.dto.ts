import { IsBoolean } from 'class-validator';

/**
 * Simple notification settings DTOs.
 * Matches Go pkg/handler/notification/dto.go SimpleUserNotificationSettingsRequest/Response.
 * Only exposes the allowCommentReplyNotification boolean switch.
 */
export class SimpleNotificationSettingsResponseDto {
  allowCommentReplyNotification: boolean;
}

export class UpdateSimpleNotificationSettingsDto {
  @IsBoolean()
  allowCommentReplyNotification: boolean;
}
