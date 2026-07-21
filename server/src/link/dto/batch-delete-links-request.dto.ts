import { IsArray, IsNotEmpty, ArrayMaxSize, IsInt } from 'class-validator';

/**
 * BatchDeleteLinksRequestDto — matches Go BatchDeleteLinksRequest JSON fields exactly.
 * DELETE /links/batch-delete
 * Per D-301/D-303: IDs are raw DB ints, matching Go BatchDeleteLinksRequest.IDs []int.
 * Max 100 IDs.
 */
export class BatchDeleteLinksRequestDto {
  @IsArray()
  @IsNotEmpty()
  @ArrayMaxSize(100)
  @IsInt({ each: true })
  ids: number[];
}
