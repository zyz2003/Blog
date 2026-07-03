import { IsString, IsNotEmpty, IsOptional } from 'class-validator';

/**
 * CreatePostTagDto matches Go CreatePostTagRequest:
 * name (required), slug
 */
export class CreatePostTagDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsOptional()
  @IsString()
  slug?: string;
}
