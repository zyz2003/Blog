import {
  IsOptional,
  IsInt,
  IsString,
  Min,
  Max,
  IsIn,
} from 'class-validator';
import { Type } from 'class-transformer';

/**
 * AdminListCommentDto — matches Go AdminListRequest query fields exactly.
 * Per D-135: admin list supports filters with pagination.
 * All JSON keys use snake_case matching Go form tags.
 */
export class AdminListCommentDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  pageSize: number = 10;

  @IsOptional()
  @IsString()
  nickname?: string;

  @IsOptional()
  @IsString()
  email?: string;

  @IsOptional()
  @IsString()
  target_path?: string;

  @IsOptional()
  @IsString()
  ip_address?: string;

  @IsOptional()
  @IsString()
  content?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @IsIn([1, 2])
  status?: number;
}
