import { IsArray, IsNotEmpty, ValidateNested, IsString, IsInt } from 'class-validator';
import { Type } from 'class-transformer';

/**
 * SortItem — single link sort entry.
 */
class SortItem {
  @IsString()
  id: string;

  @IsInt()
  sort_order: number;
}

/**
 * BatchUpdateSortRequestDto — matches Go BatchUpdateLinkSortRequest JSON fields exactly.
 * PUT /links/sort
 */
export class BatchUpdateSortRequestDto {
  @IsArray()
  @IsNotEmpty()
  @ValidateNested({ each: true })
  @Type(() => SortItem)
  items: SortItem[];
}
