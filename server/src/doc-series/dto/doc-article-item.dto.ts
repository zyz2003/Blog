/**
 * DocArticleItemDto — matches Go DocArticleItem exactly.
 * Reference: pkg/domain/model/docseries.go DocArticleItem.
 * Article items within a DocSeries, with Sqids-encoded ID.
 * All JSON keys use snake_case matching Go JSON tags.
 */
export interface DocArticleItemDto {
  id: string;
  title: string;
  abbrlink: string;
  doc_sort: number;
  created_at: string;
}
