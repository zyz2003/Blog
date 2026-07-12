import { DocSeriesResponseDto } from './doc-series-response.dto';
import { DocArticleItemDto } from './doc-article-item.dto';

/**
 * DocSeriesWithArticlesDto — matches Go DocSeriesWithArticles exactly.
 * Reference: pkg/domain/model/docseries.go DocSeriesWithArticles.
 * Extends DocSeriesResponse with articles array.
 */
export interface DocSeriesWithArticlesDto extends DocSeriesResponseDto {
  articles: DocArticleItemDto[];
}
