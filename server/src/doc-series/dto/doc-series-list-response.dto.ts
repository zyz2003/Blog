import { DocSeriesResponseDto } from './doc-series-response.dto';

/**
 * DocSeriesListResponseDto — matches Go DocSeriesListResponse exactly.
 * Reference: pkg/domain/model/docseries.go DocSeriesListResponse.
 * Paginated list of DocSeries with total count.
 */
export interface DocSeriesListResponseDto {
  list: DocSeriesResponseDto[];
  total: number;
  page: number;
  pageSize: number;
}
