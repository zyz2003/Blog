import {
  Controller,
  Get,
  Query,
  Param,
  BadRequestException,
} from '@nestjs/common';
import { Public } from '../common/decorators/public.decorator';
import { ArticleService } from './article.service';

/**
 * PublicArticleController handles all public-facing article endpoints.
 * Mounted at /api/public/articles — separate from ArticleController
 * which is at /api/articles (admin-only routes).
 *
 * All endpoints use @Public() at class level — no auth required.
 * Per D-60/D-49: public endpoints have independent service methods.
 */
@Public()
@Controller('public/articles')
export class PublicArticleController {
  constructor(private readonly articleService: ArticleService) {}

  /**
   * GET /api/public/articles
   * List published articles with pagination and filters.
   * Matches Go ListPublic (handler.go lines 155-177).
   */
  @Get()
  async listPublic(@Query() query: any) {
    return this.articleService.listPublic({
      page: query.page ? parseInt(query.page, 10) : undefined,
      pageSize: query.pageSize ? parseInt(query.pageSize, 10) : undefined,
      category: query.category,
      tag: query.tag,
      year: query.year ? parseInt(query.year, 10) : undefined,
      month: query.month ? parseInt(query.month, 10) : undefined,
    });
  }

  /**
   * GET /api/public/articles/home
   * List home-visible articles. No pagination.
   * Matches Go ListHome (handler.go lines 304-311).
   */
  @Get('home')
  async listHome() {
    return this.articleService.listHome();
  }

  /**
   * GET /api/public/articles/random
   * Get single random published article.
   * Matches Go GetRandom (handler.go lines 222-235).
   */
  @Get('random')
  async getRandom() {
    return this.articleService.getRandom();
  }

  /**
   * GET /api/public/articles/archives
   * Get year-month grouped archive summary.
   * Matches Go ListArchives (handler.go lines 187-194).
   */
  @Get('archives')
  async listArchives() {
    return this.articleService.listArchives();
  }

  /**
   * GET /api/public/articles/statistics
   * Get article statistics.
   * Matches Go GetArticleStatistics (handler.go lines 204-211).
   */
  @Get('statistics')
  async getArticleStatistics() {
    return this.articleService.getArticleStatistics();
  }

  /**
   * GET /api/public/articles/by-url?url=...
   * Get article by URL slug extraction.
   * Matches Go GetByURL (handler.go lines 352-376).
   */
  @Get('by-url')
  async getByURL(@Query('url') url: string) {
    if (!url) {
      throw new BadRequestException('缺少 url 参数');
    }
    return this.articleService.getByURL(url);
  }

  /**
   * GET /api/public/articles/:id
   * Get public article detail with prev/next navigation.
   * MUST be last route to avoid catching 'home', 'random', etc.
   * Matches Go GetPublic (handler.go lines 322-340).
   */
  @Get(':id')
  async getPublic(@Param('id') id: string) {
    return this.articleService.getPublic(id);
  }
}
