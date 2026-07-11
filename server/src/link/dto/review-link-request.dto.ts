import { IsString, IsNotEmpty, IsOptional, IsIn } from 'class-validator';

/**
 * ReviewLinkRequestDto — matches Go ReviewLinkRequest JSON fields exactly.
 * PUT /links/:id/review
 */
export class ReviewLinkRequestDto {
  @IsString()
  @IsNotEmpty()
  @IsIn(['APPROVED', 'REJECTED'])
  status: string;

  @IsOptional()
  @IsString()
  siteshot?: string | null;

  @IsOptional()
  @IsString()
  reject_reason?: string | null;
}
