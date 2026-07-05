import { IsString } from 'class-validator';

export class RenameItemDto {
  @IsString()
  id: string;

  @IsString()
  new_name: string;
}
