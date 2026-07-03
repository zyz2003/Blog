/**
 * ArticleResponseDto — TypeScript interface matching Go ArticleResponse structure exactly.
 * Reference: pkg/domain/model/article.go lines 159-211.
 * All JSON keys use snake_case matching Go JSON tags.
 * Optional fields use `| null` (not `?`) per Pitfall 3 in RESEARCH.md —
 * Go nil serializes to JSON null, not missing key.
 */
export interface ArticleResponseDto {
  id: string;
  created_at: string | null;
  updated_at: string | null;
  title: string;
  content_md: string | null;
  content_html: string | null;
  cover_url: string | null;
  status: string;
  view_count: number;
  word_count: number;
  reading_time: number;
  ip_location: string | null;
  primary_color: string | null;
  is_primary_color_manual: boolean;
  show_on_home: boolean;
  post_tags: PostTagInArticleResponse[];
  post_categories: PostCategoryInArticleResponse[];
  home_sort: number;
  pin_sort: number;
  top_img_url: string | null;
  summaries: string[] | null;
  abbrlink: string | null;
  copyright: boolean;
  is_reprint: boolean;
  copyright_author: string | null;
  copyright_author_href: string | null;
  copyright_url: string | null;
  keywords: string | null;
  comment_count: number;
  scheduled_at: string | null;
  review_status: string;
  owner_id: number | null;
  owner_nickname: string | null;
  owner_avatar: string | null;
  owner_email: string | null;
  is_takedown: boolean;
  takedown_reason: string | null;
  takedown_at: string | null;
  takedown_by: number | null;
  extra_config: Record<string, unknown> | null;
  is_doc: boolean;
  doc_series_id: string | null;
  doc_sort: number;
}

/**
 * Nested post tag in article response.
 * Matches Go PostTagResponse in ToAPIResponse.
 */
export interface PostTagInArticleResponse {
  id: string;
  created_at: string | null;
  updated_at: string | null;
  name: string;
  slug: string | null;
  count: number;
}

/**
 * Nested post category in article response.
 * Matches Go PostCategoryResponse in ToAPIResponse.
 */
export interface PostCategoryInArticleResponse {
  id: string;
  created_at: string | null;
  updated_at: string | null;
  name: string;
  slug: string | null;
  description: string | null;
  count: number;
  is_series: boolean;
}

/**
 * Article list response matching Go ArticleListResponse.
 */
export interface ArticleListResponseDto {
  list: ArticleResponseDto[];
  total: number;
  page: number;
  pageSize: number; // camelCase matching Go ArticleListResponse.PageSize
}

/**
 * Simple article response for prev/next/related navigation.
 * Matches Go SimpleArticleResponse (model.go lines 214-223).
 */
export interface SimpleArticleResponseDto {
  id: string;
  title: string;
  cover_url: string | null;
  abbrlink: string | null;
  created_at: string | null;
  primary_color: string | null;
  is_doc: boolean;
  doc_series_id: string | null;
}

/**
 * Article detail response with prev/next/related articles.
 * Matches Go ArticleDetailResponse (model.go lines 226-231).
 */
export interface ArticleDetailResponseDto extends ArticleResponseDto {
  prev_article: SimpleArticleResponseDto | null;
  next_article: SimpleArticleResponseDto | null;
  related_articles: SimpleArticleResponseDto[];
}

/**
 * Archive item matching Go ArchiveItem (model.go lines 363-367).
 */
export interface ArchiveItemDto {
  year: number;
  month: number;
  count: number;
}

/**
 * Archive summary response matching Go ArchiveSummaryResponse (model.go lines 369-372).
 */
export interface ArchiveSummaryResponseDto {
  list: ArchiveItemDto[];
}

/**
 * Category stat item matching Go CategoryStatItem (model.go lines 279-283).
 */
export interface CategoryStatItemDto {
  name: string;
  count: number;
}

/**
 * Tag stat item matching Go TagStatItem (model.go lines 285-289).
 */
export interface TagStatItemDto {
  name: string;
  count: number;
}

/**
 * Top viewed post item matching Go TopViewedPostItem (model.go lines 292-297).
 */
export interface TopViewedPostItemDto {
  id: string;
  title: string;
  views: number;
  cover_url: string | null;
}

/**
 * Publish trend item matching Go PublishTrendItem (model.go lines 299-303).
 */
export interface PublishTrendItemDto {
  month: string;
  count: number;
}

/**
 * Article statistics matching Go ArticleStatistics (model.go lines 268-277).
 */
export interface ArticleStatisticsDto {
  total_posts: number;
  total_words: number;
  avg_words: number;
  total_views: number;
  category_stats: CategoryStatItemDto[];
  tag_stats: TagStatItemDto[];
  top_viewed_posts: TopViewedPostItemDto[];
  publish_trend: PublishTrendItemDto[];
}
