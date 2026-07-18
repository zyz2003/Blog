import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { Public } from '../common/decorators/public.decorator';
import { AdminGuard } from '../common/guards/admin.guard';
import { DocSeriesService } from './doc-series.service';
import { ListDocSeriesQueryDto } from './dto/list-doc-series-query.dto';
import { CreateDocSeriesRequestDto } from './dto/create-doc-series-request.dto';
import { UpdateDocSeriesRequestDto } from './dto/update-doc-series-request.dto';

/**
 * DocSeriesController — handles both admin and public doc series endpoints.
 *
 * Public endpoints (use @Public() decorator):
 * - GET /api/public/doc-series           — list
 * - GET /api/public/doc-series/:id       — get
 * - GET /api/public/doc-series/:id/articles — getWithArticles
 *
 * Admin endpoints (protected by global JwtAuthGuard + AdminGuard):
 * - GET    /api/doc-series     — list
 * - GET    /api/doc-series/:id — get
 * - POST   /api/doc-series     — create
 * - PUT    /api/doc-series/:id — update
 * - DELETE /api/doc-series/:id — delete
 *
 * :id param is Sqids string (not integer) per D-183.
 */
@Controller()
export class DocSeriesController {
  constructor(private readonly docSeriesService: DocSeriesService) {}

  // ─── Public endpoints ─────────────────────────────────────────────

  /**
   * GET /api/public/doc-series
   * List doc series with pagination (public).
   * Matches Go List (public route in router.go).
   */
  @Public()
  @Get('public/doc-series')
  async listPublic(@Query() query: ListDocSeriesQueryDto) {
    return this.docSeriesService.list({
      page: query.page,
      pageSize: query.pageSize,
    });
  }

  /**
   * GET /api/public/doc-series/:id
   * Get doc series by public ID (public).
   * Matches Go Get (public route in router.go).
   */
  @Public()
  @Get('public/doc-series/:id')
  async getPublic(@Param('id') id: string) {
    return this.docSeriesService.getById(id);
  }

  /**
   * GET /api/public/doc-series/:id/articles
   * Get doc series with associated articles (public).
   * Matches Go GetWithArticles (public route in router.go).
   */
  @Public()
  @Get('public/doc-series/:id/articles')
  async getWithArticlesPublic(@Param('id') id: string) {
    return this.docSeriesService.getByIdWithArticles(id);
  }

  // ─── Admin endpoints ──────────────────────────────────────────────

  /**
   * GET /api/doc-series
   * List doc series with pagination (admin).
   * Matches Go List (admin route in router.go).
   */
  @Get('doc-series')
  @UseGuards(AdminGuard)
  async list(@Query() query: ListDocSeriesQueryDto) {
    return this.docSeriesService.list({
      page: query.page,
      pageSize: query.pageSize,
    });
  }

  /**
   * GET /api/doc-series/:id
   * Get doc series by public ID (admin).
   * Matches Go Get (admin route in router.go).
   */
  @Get('doc-series/:id')
  @UseGuards(AdminGuard)
  async get(@Param('id') id: string) {
    return this.docSeriesService.getById(id);
  }

  /**
   * POST /api/doc-series
   * Create a new doc series (admin).
   * Matches Go Create (admin route in router.go).
   */
  @HttpCode(HttpStatus.OK)
  @Post('doc-series')
  @UseGuards(AdminGuard)
  async create(@Body() dto: CreateDocSeriesRequestDto) {
    return this.docSeriesService.create(dto);
  }

  /**
   * PUT /api/doc-series/:id
   * Update a doc series (admin).
   * Matches Go Update (admin route in router.go).
   */
  @Put('doc-series/:id')
  @UseGuards(AdminGuard)
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateDocSeriesRequestDto,
  ) {
    return this.docSeriesService.update(id, dto);
  }

  /**
   * DELETE /api/doc-series/:id
   * Delete a doc series (admin).
   * Matches Go Delete (admin route in router.go).
   * Returns null with message "删除成功".
   */
  @Delete('doc-series/:id')
  @UseGuards(AdminGuard)
  async delete(@Param('id') id: string) {
    await this.docSeriesService.delete(id);
    return { data: null, message: '删除成功' };
  }
}
