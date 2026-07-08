import { Expose, Type } from 'class-transformer';

/**
 * CommentResponseDto — matches Go dto.Response JSON fields exactly.
 * Per D-138: all fields from Go Response struct including admin-only fields.
 * Admin-only fields (email, ip_address, content, status) are optional
 * and only populated when isAdminView=true.
 */
export class CommentResponseDto {
  @Expose()
  id: string;

  @Expose()
  created_at: string;

  @Expose()
  pinned_at?: string | null;

  @Expose()
  nickname: string;

  @Expose()
  email_md5: string;

  @Expose()
  qq_number?: string | null;

  @Expose()
  avatar_url?: string | null;

  @Expose()
  website?: string | null;

  @Expose()
  content_html: string;

  @Expose()
  is_admin_comment: boolean;

  @Expose()
  is_anonymous: boolean;

  @Expose()
  ip_location?: string;

  @Expose()
  user_agent?: string | null;

  @Expose()
  target_path: string;

  @Expose()
  target_title?: string | null;

  @Expose()
  parent_id?: string | null;

  @Expose()
  reply_to_id?: string | null;

  @Expose()
  reply_to_nick?: string | null;

  @Expose()
  like_count: number;

  @Expose()
  total_children: number;

  @Expose()
  @Type(() => CommentResponseDto)
  children: CommentResponseDto[] = [];

  // --- Admin-only fields ---
  @Expose()
  email?: string | null;

  @Expose()
  ip_address?: string | null;

  @Expose()
  content?: string | null;

  @Expose()
  status?: number;
}

/**
 * ListCommentResponseDto — matches Go dto.ListResponse JSON fields exactly.
 * Per D-139: list + pagination fields.
 * total = root comment count (for pagination).
 * total_with_children = all comments including descendants (for display).
 * has_more = whether 500 limit was reached.
 */
export class ListCommentResponseDto {
  @Expose()
  @Type(() => CommentResponseDto)
  list: CommentResponseDto[];

  @Expose()
  total: number;

  @Expose()
  total_with_children: number;

  @Expose()
  page: number;

  @Expose()
  pageSize: number;

  @Expose()
  has_more?: boolean;
}
