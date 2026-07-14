/**
 * NotificationType DTOs.
 * Matches Go pkg/handler/notification/dto.go NotificationTypeDTO.
 */
export class NotificationTypeResponseDto {
  id: number;
  code: string;
  name: string;
  description: string | null;
  category: string;
  isActive: boolean;
  defaultEnabled: boolean;
  supportedChannels: string[] | null;
  createdAt: Date | null;
  updatedAt: Date | null;
}
