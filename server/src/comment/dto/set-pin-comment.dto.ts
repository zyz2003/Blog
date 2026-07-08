import { IsBoolean, IsNotEmpty } from 'class-validator';

/**
 * SetPinCommentDto — matches Go SetPinRequest JSON fields exactly.
 * Per D-134: isPinned=true sets pinnedAt=now, isPinned=false clears pinnedAt.
 */
export class SetPinCommentDto {
  @IsBoolean()
  @IsNotEmpty()
  pinned: boolean;
}
