/**
 * DocSeriesResponseDto — TypeScript interface matching Go DocSeriesResponse exactly.
 * Reference: pkg/domain/model/docseries.go DocSeriesResponse.
 * DocSeries uses Sqids-encoded IDs (string) per D-183.
 * All JSON keys use snake_case matching Go JSON tags.
 */
export interface DocSeriesResponseDto {
  id: string;
  created_at: string;
  updated_at: string;
  name: string;
  description: string;
  cover_url: string;
  sort: number;
  doc_count: number;
}
