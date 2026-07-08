import { IsInt, IsIn } from 'class-validator';

/**
 * UpdateStatusCommentDto — matches Go UpdateStatusRequest JSON fields exactly.
 * Per D-117: status enum 1=Published, 2=Pending, 3=Rejected.
 */
export class UpdateStatusCommentDto {
  @IsInt()
  @IsIn([1, 2, 3])
  status: number;
}
