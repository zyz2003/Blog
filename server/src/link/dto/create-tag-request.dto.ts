import { IsString, IsNotEmpty, IsOptional } from 'class-validator';

/**
 * CreateTagRequestDto — matches Go CreateLinkTagRequest JSON fields exactly.
 */
export class CreateTagRequestDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsOptional()
  @IsString()
  color?: string = '#666666';
}
