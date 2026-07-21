import { IsArray, IsNotEmpty, ValidateNested, IsInt } from 'class-validator';
import { Type } from 'class-transformer';

/**
 * SortItem — single link sort entry.
 * Per D-301/D-303: ID is raw DB int, matching Go LinkSortItem.ID int.
 */
class SortItem {
  @IsInt()
  id: number;

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
