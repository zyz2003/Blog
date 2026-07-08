import {
  IsOptional,
  IsString,
  MinLength,
  MaxLength,
  IsEmail,
  IsUrl,
} from 'class-validator';

/**
 * UpdateCommentInfoDto — matches Go UpdateCommentRequest JSON fields exactly.
 * Per D-137: updates nickname/email/website, optionally content.
 */
export class UpdateCommentInfoDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(1000)
  content?: string;

  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(50)
  nickname?: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsUrl()
  website?: string;
}
