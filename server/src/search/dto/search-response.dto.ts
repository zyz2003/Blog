/**
 * Search response DTOs matching Go model.SearchResult/SearchHit structure.
 * Per D-148: Search results match Go SearchResult/SearchHit format exactly.
 */

export interface SearchHitDto {
  id: string;
  type: string;
  url: string;
  title: string;
  snippet: string;
  author: string;
  category: string;
  tags: string[];
  publish_date: string;
  cover_url: string;
  abbrlink: string;
  view_count: number;
  word_count: number;
  reading_time: number;
  is_doc: boolean;
  doc_series_id: string;
}

export interface SearchPaginationDto {
  total: number;
  page: number;
  size: number;
  totalPages: number;
}

export interface SearchResultDto {
  pagination: SearchPaginationDto;
  hits: SearchHitDto[];
}
