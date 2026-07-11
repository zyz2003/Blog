import { IsOptional, IsString } from 'class-validator';

/**
 * UpdateTagRequestDto — matches Go UpdateLinkTagRequest JSON fields exactly.
 */
export class UpdateTagRequestDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  color?: string;
}
