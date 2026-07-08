import {
  IsString,
  IsNotEmpty,
  MaxLength,
  IsOptional,
  IsEmail,
  IsUrl,
  IsBoolean,
  MinLength,
} from 'class-validator';

/**
 * CreateCommentDto — matches Go CreateRequest JSON fields exactly.
 * Per D-126: comment create flow validation.
 * All JSON keys use snake_case matching Go JSON tags.
 */
export class CreateCommentDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  target_path: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  target_title?: string;

  @IsOptional()
  @IsString()
  parent_id?: string;

  @IsOptional()
  @IsString()
  reply_to_id?: string;

  @IsString()
  @IsNotEmpty()
  @MinLength(2)
  @MaxLength(50)
  nickname: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsUrl()
  website?: string;

  @IsString()
  @IsNotEmpty()
  @MinLength(1)
  @MaxLength(1000)
  content: string;

  @IsBoolean()
  is_anonymous: boolean = false;
}
