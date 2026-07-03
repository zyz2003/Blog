import { IsOptional, IsString } from 'class-validator';

/**
 * UpdatePostTagDto matches Go UpdatePostTagRequest:
 * All fields optional (pointer types in Go).
 * Manually defined instead of PartialType to avoid @nestjs/mapped-types dependency.
 */
export class UpdatePostTagDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  slug?: string;
}
