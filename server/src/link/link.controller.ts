import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Query,
  Param,
  Body,
  Req,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { Public } from '../common/decorators/public.decorator';
import { JwtAuthOptionalGuard } from '../common/guards/jwt-auth-optional.guard';
import { LinkService } from './link.service';
import { ApplyLinkRequestDto } from './dto/apply-link-request.dto';
import { AdminCreateLinkRequestDto } from './dto/admin-create-link-request.dto';
import { UpdateLinkRequestDto } from './dto/update-link-request.dto';
import { ReviewLinkRequestDto } from './dto/review-link-request.dto';
import { BatchDeleteLinksRequestDto } from './dto/batch-delete-links-request.dto';
import { BatchUpdateSortRequestDto } from './dto/batch-update-sort-request.dto';
import { ImportLinksRequestDto } from './dto/import-links-request.dto';
import { CreateCategoryRequestDto } from './dto/create-category-request.dto';
import { UpdateCategoryRequestDto } from './dto/update-category-request.dto';
import { CreateTagRequestDto } from './dto/create-tag-request.dto';
import { UpdateTagRequestDto } from './dto/update-tag-request.dto';

/**
 * LinkController handles all friend link endpoints.
 * Two route groups per D-180:
 *
 * Public endpoints (use @Public() + JwtAuthOptionalGuard):
 *   - POST /public/links — Apply for friend link
 *   - GET /public/links — Get APPROVED links grouped by category
 *   - GET /public/links/random — Get random APPROVED links
 *   - GET /public/links/applications — Get all link applications
 *   - GET /public/links/check-exists — Check if URL exists
 *   - GET /public/link-categories — Get categories with APPROVED links
 *
 * Admin endpoints (protected by global JwtAuthGuard + AdminGuard):
 *   - POST /links — Create link
 *   - GET /links — List links with filters
 *   - DELETE /links/batch-delete — Batch delete (BEFORE /links/:id)
 *   - PUT /links/:id — Update link
 *   - DELETE /links/:id — Delete link
 *   - PUT /links/:id/review — Review link
 *   - POST /links/import — Import links
 *   - GET /links/export — Export links
 *   - POST /links/health-check — Trigger health check
 *   - GET /links/health-check/status — Get health check status
 *   - PUT /links/sort — Batch update sort
 *   - GET/POST/PUT/DELETE /links/categories — Category CRUD
 *   - GET/POST/PUT/DELETE /links/tags — Tag CRUD
 *
 * CRITICAL route ordering: @Delete('links/batch-delete') and @Get('links/health-check/status')
 * MUST be defined before parametric routes to prevent NestJS from matching them as :id.
 */
@Controller()
export class LinkController {
  constructor(private readonly linkService: LinkService) {}

  // ─── Public endpoints ─────────────────────────────────────────────

  /**
   * POST /api/public/links
   * Apply for a friend link. Rate-limited per IP.
   * Matches Go ApplyLink (router.go).
   */
  @Public()
  @HttpCode(HttpStatus.OK)
  @Post('public/links')
  @UseGuards(JwtAuthOptionalGuard)
  async applyLink(@Body() dto: ApplyLinkRequestDto, @Req() req: any) {
    const ip =
      req.headers['x-forwarded-for']?.split(',')[0]?.trim() ||
      req.ip ||
      req.connection?.remoteAddress ||
      '';
    return this.linkService.applyLink(dto, ip);
  }

  /**
   * GET /api/public/links
   * Get APPROVED links grouped by category.
   * Matches Go ListPublicLinks (router.go).
   */
  @Public()
  @Get('public/links')
  async listPublicLinks() {
    return this.linkService.listPublicLinks();
  }

  /**
   * GET /api/public/links/random
   * Get random APPROVED links.
   * Matches Go GetRandomLinks (router.go).
   * MUST be declared before @Get('public/links/:param') routes.
   */
  @Public()
  @Get('public/links/random')
  async getRandomLinks(@Query('num') num?: string) {
    const count = num ? parseInt(num, 10) : 0;
    return this.linkService.getRandomLinks(count);
  }

  /**
   * GET /api/public/links/applications
   * Get all link applications (all statuses).
   * Matches Go ListAllApplications (router.go).
   * MUST be declared before parametric routes.
   */
  @Public()
  @Get('public/links/applications')
  async listApplications() {
    return this.linkService.listApplications();
  }

  /**
   * GET /api/public/links/check-exists
   * Check if URL already has an APPROVED link.
   * Matches Go CheckLinkExists (router.go).
   * MUST be declared before parametric routes.
   */
  @Public()
  @Get('public/links/check-exists')
  async checkLinkExists(@Query('url') url: string) {
    return this.linkService.checkLinkExists(url);
  }

  /**
   * GET /api/public/link-categories
   * Get categories that have APPROVED links.
   * Matches Go ListPublicCategories (router.go).
   */
  @Public()
  @Get('public/link-categories')
  async listPublicCategories() {
    return this.linkService.listPublicCategories();
  }

  // ─── Admin endpoints ──────────────────────────────────────────────

  /**
   * POST /api/links
   * Create a link (admin).
   * Matches Go AdminCreateLink (router.go).
   */
  @Post('links')
  async adminCreateLink(@Body() dto: AdminCreateLinkRequestDto) {
    return this.linkService.adminCreateLink(dto);
  }

  /**
   * GET /api/links
   * List links with filters (admin).
   * Matches Go ListLinks (router.go).
   */
  @Get('links')
  async adminListLinks(
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
    @Query('status') status?: string,
    @Query('category_id') categoryId?: string,
    @Query('tag_id') tagId?: string,
  ) {
    return this.linkService.adminListLinks({
      page: page ? parseInt(page, 10) : 1,
      pageSize: pageSize ? parseInt(pageSize, 10) : 10,
      status,
      categoryId: categoryId ? parseInt(categoryId, 10) : undefined,
      tagId: tagId ? parseInt(tagId, 10) : undefined,
    });
  }

  /**
   * DELETE /api/links/batch-delete
   * Batch delete links (admin).
   * Matches Go AdminBatchDeleteLinks (router.go).
   * CRITICAL: Must be defined BEFORE @Delete('links/:id') to avoid route conflict.
   */
  @Delete('links/batch-delete')
  async adminBatchDeleteLinks(@Body() dto: BatchDeleteLinksRequestDto) {
    return this.linkService.adminBatchDeleteLinks(dto);
  }

  /**
   * PUT /api/links/:id
   * Update a link (admin).
   * Matches Go AdminUpdateLink (router.go).
   */
  @Put('links/:id')
  async adminUpdateLink(
    @Param('id') id: string,
    @Body() dto: UpdateLinkRequestDto,
  ) {
    return this.linkService.adminUpdateLink(id, dto);
  }

  /**
   * DELETE /api/links/:id
   * Delete a link (admin).
   * Matches Go AdminDeleteLink (router.go).
   */
  @Delete('links/:id')
  async adminDeleteLink(@Param('id') id: string) {
    return this.linkService.adminDeleteLink(id);
  }

  /**
   * PUT /api/links/:id/review
   * Review a link application (admin).
   * Matches Go ReviewLink (router.go).
   */
  @Put('links/:id/review')
  async reviewLink(
    @Param('id') id: string,
    @Body() dto: ReviewLinkRequestDto,
  ) {
    return this.linkService.reviewLink(id, dto);
  }

  /**
   * POST /api/links/import
   * Import links (admin).
   * Matches Go ImportLinks (router.go).
   */
  @Post('links/import')
  async importLinks(@Body() dto: ImportLinksRequestDto) {
    return this.linkService.importLinks(dto);
  }

  /**
   * GET /api/links/export
   * Export links (admin).
   * Matches Go ExportLinks (router.go).
   */
  @Get('links/export')
  async exportLinks(
    @Query('status') status?: string,
    @Query('category_id') categoryId?: string,
    @Query('tag_id') tagId?: string,
  ) {
    return this.linkService.exportLinks({
      status,
      categoryId: categoryId ? parseInt(categoryId, 10) : undefined,
      tagId: tagId ? parseInt(tagId, 10) : undefined,
    });
  }

  /**
   * POST /api/links/health-check
   * Trigger async health check (admin).
   * Matches Go CheckLinksHealth (router.go).
   * Returns immediately; check status via GET /links/health-check/status.
   */
  @HttpCode(HttpStatus.OK)
  @Post('links/health-check')
  async triggerHealthCheck() {
    await this.linkService.healthCheck();
    return {
      message: '友链健康检查任务已启动，将在后台执行',
      status: 'started',
    };
  }

  /**
   * GET /api/links/health-check/status
   * Get health check status (admin).
   * Matches Go GetHealthCheckStatus (router.go).
   * CRITICAL: Must be defined BEFORE any @Get('links/:id') route if it existed.
   */
  @Get('links/health-check/status')
  async getHealthCheckStatus() {
    return this.linkService.getHealthCheckStatus();
  }

  /**
   * PUT /api/links/sort
   * Batch update sort order (admin).
   * Matches Go BatchUpdateLinkSort (router.go).
   */
  @Put('links/sort')
  async batchUpdateSort(@Body() dto: BatchUpdateSortRequestDto) {
    return this.linkService.batchUpdateSort(dto);
  }

  // ─── Category CRUD (admin) ────────────────────────────────────────

  /**
   * GET /api/links/categories
   * List all categories (admin).
   * Matches Go ListCategories (router.go).
   */
  @Get('links/categories')
  async listCategories() {
    return this.linkService.listCategories();
  }

  /**
   * POST /api/links/categories
   * Create a category (admin).
   * Matches Go CreateCategory (router.go).
   */
  @Post('links/categories')
  async createCategory(@Body() dto: CreateCategoryRequestDto) {
    return this.linkService.createCategory(dto);
  }

  /**
   * PUT /api/links/categories/:id
   * Update a category (admin).
   * Matches Go UpdateCategory (router.go).
   */
  @Put('links/categories/:id')
  async updateCategory(
    @Param('id') id: string,
    @Body() dto: UpdateCategoryRequestDto,
  ) {
    return this.linkService.updateCategory(id, dto);
  }

  /**
   * DELETE /api/links/categories/:id
   * Delete a category (admin).
   * Matches Go DeleteCategory (router.go).
   */
  @Delete('links/categories/:id')
  async deleteCategory(@Param('id') id: string) {
    return this.linkService.deleteCategory(id);
  }

  // ─── Tag CRUD (admin) ─────────────────────────────────────────────

  /**
   * GET /api/links/tags
   * List all tags (admin).
   * Matches Go ListAllTags (router.go).
   */
  @Get('links/tags')
  async listTags() {
    return this.linkService.listTags();
  }

  /**
   * POST /api/links/tags
   * Create a tag (admin).
   * Matches Go CreateTag (router.go).
   */
  @Post('links/tags')
  async createTag(@Body() dto: CreateTagRequestDto) {
    return this.linkService.createTag(dto);
  }

  /**
   * PUT /api/links/tags/:id
   * Update a tag (admin).
   * Matches Go UpdateTag (router.go).
   */
  @Put('links/tags/:id')
  async updateTag(
    @Param('id') id: string,
    @Body() dto: UpdateTagRequestDto,
  ) {
    return this.linkService.updateTag(id, dto);
  }

  /**
   * DELETE /api/links/tags/:id
   * Delete a tag (admin).
   * Matches Go DeleteTag (router.go).
   */
  @Delete('links/tags/:id')
  async deleteTag(@Param('id') id: string) {
    return this.linkService.deleteTag(id);
  }
}
