import { IsString, IsNotEmpty, MinLength, MaxLength } from 'class-validator';

/**
 * UpdateContentCommentDto — matches Go UpdateContentRequest JSON fields exactly.
 * Per D-137: updates Markdown content, service re-renders HTML.
 */
export class UpdateContentCommentDto {
  @IsString()
  @IsNotEmpty()
  @MinLength(1)
  @MaxLength(1000)
  content: string;
}
