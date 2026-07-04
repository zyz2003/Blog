import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
} from '@nestjs/common';
import { PageService } from './page.service';
import { CreatePageDto } from './dto/create-page.dto';
import { UpdatePageDto } from './dto/update-page.dto';

/**
 * PageController handles admin CRUD endpoints for pages.
 * Mounted at /api/pages — protected by global JwtAuthGuard + AdminGuard.
 * No @Public() decorator: all routes require JWT + Admin role.
 *
 * Per D-71: Page IDs are raw numeric (no Sqids encoding).
 * Per D-73: List uses page_size query parameter (underscore format).
 */
@Controller('pages')
export class PageController {
  constructor(private readonly pageService: PageService) {}

  /**
   * POST /api/pages
   * Create a new page. Matches Go Create handler.
   * Per D-77: title, path, content are required.
   */
  @Post()
  async create(@Body() dto: CreatePageDto) {
    return this.pageService.create(dto);
  }

  /**
   * GET /api/pages
   * List pages with pagination and filters. Matches Go List handler.
   * Per D-73: uses page_size (underscore), returns { pages, total, page, size }.
   */
  @Get()
  async list(@Query() query: any) {
    const page = query.page ? parseInt(query.page, 10) : 1;
    const pageSize = query.page_size ? parseInt(query.page_size, 10) : 10;
    const search = query.search || undefined;
    const isPublished =
      query.is_published !== undefined
        ? query.is_published === 'true' || query.is_published === true
        : undefined;

    return this.pageService.list({
      page: page < 1 ? 1 : page,
      pageSize: pageSize < 1 || pageSize > 100 ? 10 : pageSize,
      search,
      isPublished,
    });
  }

  /**
   * POST /api/pages/initialize
   * Initialize default pages. Matches Go InitializeDefaultPages handler.
   * MUST be defined before @Get(':id') to avoid 'initialize' being captured as :id param.
   * Per D-82: creates 3 default pages (privacy, cookies, copyright).
   */
  @Post('initialize')
  async initializeDefaultPages() {
    await this.pageService.initializeDefaultPages();
    return null;
  }

  /**
   * GET /api/pages/:id
   * Get page by numeric ID. Matches Go GetByID handler.
   * Per D-71: Page uses raw numeric ID, no Sqids encoding.
   */
  @Get(':id')
  async get(@Param('id') id: string) {
    const numericId = parseInt(id, 10);
    return this.pageService.getById(numericId);
  }

  /**
   * PUT /api/pages/:id
   * Update page. Matches Go Update handler.
   * Per D-78: all fields optional, only provided fields are updated.
   */
  @Put(':id')
  async update(@Param('id') id: string, @Body() dto: UpdatePageDto) {
    const numericId = parseInt(id, 10);
    return this.pageService.update(numericId, dto);
  }

  /**
   * DELETE /api/pages/:id
   * Soft-delete page. Matches Go Delete handler.
   * Per D-81: uses deletedAt field for soft delete.
   */
  @Delete(':id')
  async delete(@Param('id') id: string) {
    const numericId = parseInt(id, 10);
    await this.pageService.delete(numericId);
    return null;
  }
}
