import { IsBoolean, IsOptional, IsString, IsArray } from 'class-validator';
import { NotificationTypeResponseDto } from './notification-type.dto';

/**
 * UserNotificationConfig DTOs.
 * Matches Go pkg/handler/notification/dto.go UserNotificationConfigDTO.
 */
export class UserNotificationConfigResponseDto {
  id: number;
  userId: number;
  notificationTypeId: number;
  isEnabled: boolean;
  enabledChannels: string[] | null;
  notificationEmail: string | null;
  customSettings: Record<string, any> | null;
  notificationType?: NotificationTypeResponseDto;
  createdAt: Date | null;
  updatedAt: Date | null;
}

export class UpdateUserNotificationConfigDto {
  @IsOptional()
  @IsBoolean()
  isEnabled?: boolean;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  enabledChannels?: string[];

  @IsOptional()
  @IsString()
  notificationEmail?: string;

  @IsOptional()
  customSettings?: Record<string, any>;
}
