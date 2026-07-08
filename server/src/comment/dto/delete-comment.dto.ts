import { IsArray, IsNotEmpty, IsString } from 'class-validator';

/**
 * DeleteCommentDto — matches Go DeleteRequest JSON fields exactly.
 * Per D-136: batch delete uses soft delete, IDs are Sqids-encoded.
 */
export class DeleteCommentDto {
  @IsArray()
  @IsNotEmpty()
  @IsString({ each: true })
  ids: string[];
}
