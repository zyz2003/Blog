import { IsObject, IsNotEmpty } from 'class-validator';

export class UpdateSettingsRequestDto {
  @IsObject()
  @IsNotEmpty()
  settings!: Record<string, string>;
}
