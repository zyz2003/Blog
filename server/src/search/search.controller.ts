import { Controller, Get, Query } from '@nestjs/common';
import { Public } from '../common/decorators/public.decorator';
import { SearchService } from './search.service';
import { SearchQueryDto } from './dto/search-query.dto';

/**
 * SearchController handles the public search endpoint.
 * Per D-149: GET /api/search is @Public() — no auth required.
 * Per D-158: Part of SearchModule with SearchService.
 */
@Public()
@Controller('search')
export class SearchController {
  constructor(private readonly searchService: SearchService) {}

  /**
   * GET /api/search?q=keyword&page=1&size=10
   * Search articles using FTS5 with bm25 weighted ranking.
   * Per D-149: Public endpoint, no authentication required.
   * ResponseInterceptor wraps return as { code, data, message }.
   */
  @Get()
  async search(@Query() dto: SearchQueryDto) {
    return this.searchService.search(dto.q, dto.page, dto.size);
  }
}
