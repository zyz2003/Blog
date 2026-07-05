import { IsString, IsObject } from 'class-validator';

export class UpdateViewConfigDto {
  @IsString()
  folder_id: string;

  @IsObject()
  view: Record<string, any>;
}
