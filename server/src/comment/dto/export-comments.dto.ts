import { IsOptional, IsArray, IsString } from 'class-validator';

/**
 * Export comments request DTO.
 * Matches Go ExportRequest: { ids: string[] } — empty array exports all.
 */
export class ExportCommentsDto {
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  ids?: string[] = [];
}
