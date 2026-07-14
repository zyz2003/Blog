import { IsBoolean, IsOptional, IsString, IsArray, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
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

  // WR-04 fix: Use @IsEmail() for proper email validation
  @IsOptional()
  @IsString()
  notificationEmail?: string;

  // WR-03 fix: Add @ValidateNested + @Type() so whitelist: true doesn't strip it
  @IsOptional()
  @ValidateNested()
  @Type(() => Object)
  customSettings?: Record<string, any>;
}
