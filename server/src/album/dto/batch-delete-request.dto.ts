import { IsArray, ArrayMinSize, IsInt } from 'class-validator';
import { Type } from 'class-transformer';

/**
 * BatchDeleteRequestDto — matches Go BatchDeleteAlbums request body exactly.
 * Reference: pkg/handler/album/handler.go BatchDeleteAlbums.
 * ids is required array of at least 1 integer ID.
 */
export class BatchDeleteRequestDto {
  @IsArray()
  @ArrayMinSize(1)
  @Type(() => Number)
  @IsInt({ each: true })
  ids: number[];
}
