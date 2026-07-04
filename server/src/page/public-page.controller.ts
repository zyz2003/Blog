import { Controller, Get, Param, NotFoundException } from '@nestjs/common';
import { Public } from '../common/decorators/public.decorator';
import { PageService } from './page.service';

/**
 * PublicPageController handles public page access by path.
 * Mounted at /api/public/pages — uses @Public() to skip auth.
 *
 * Per D-74: wildcard route captures multi-level paths (e.g., /privacy, /docs/guide).
 * Per D-75: only returns published pages; unpublished pages return 404 with no existence hint.
 */
@Public()
@Controller('public/pages')
export class PublicPageController {
  constructor(private readonly pageService: PageService) {}

  /**
   * GET /api/public/pages/*path
   * Get published page by path. Matches Go GetByPath handler.
   *
   * NestJS @Get('*path') with @Controller('public/pages') captures
   * everything after /api/public/pages/ in the path param.
   * - /api/public/pages/privacy → path = "privacy"
   * - /api/public/pages/docs/guide → path = "docs/guide"
   *
   * Prepend '/' to normalize (NestJS strips leading slash from wildcard param).
   *
   * Per D-75: unpublished pages return 404 with '页面不存在' message,
   * providing no hint about page existence.
   */
  @Get('*path')
  async getByPath(@Param('path') path: string) {
    // Prepend '/' if not already present (NestJS strips leading slash from wildcard)
    const normalizedPath = path.startsWith('/') ? path : '/' + path;

    const page = await this.pageService.getByPath(normalizedPath);

    // Per D-75: only return published pages
    if (!page.is_published) {
      throw new NotFoundException('页面不存在');
    }

    return page;
  }
}
