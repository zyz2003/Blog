import { IsArray, IsNotEmpty, ArrayMaxSize } from 'class-validator';

/**
 * BatchDeleteLinksRequestDto — matches Go BatchDeleteLinksRequest JSON fields exactly.
 * DELETE /links/batch-delete
 * Max 100 IDs. IDs are Sqids-encoded public IDs.
 */
export class BatchDeleteLinksRequestDto {
  @IsArray()
  @IsNotEmpty()
  @ArrayMaxSize(100)
  ids: string[];
}
