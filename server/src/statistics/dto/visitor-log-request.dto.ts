import { IsString, IsNotEmpty, IsOptional, IsInt } from 'class-validator';

/**
 * VisitorLogRequestDto — matches Go VisitorLogRequest JSON fields exactly.
 * POST /public/statistics/visit
 * Per D-165: visitor log request validation.
 */
export class VisitorLogRequestDto {
  @IsString()
  @IsNotEmpty()
  url_path: string;

  @IsOptional()
  @IsString()
  page_title?: string;

  @IsOptional()
  @IsString()
  referer?: string;

  @IsOptional()
  @IsInt()
  duration: number = 0;
}
