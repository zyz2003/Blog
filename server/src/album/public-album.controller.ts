import {
  Controller,
  Get,
  Put,
  Param,
  Query,
  ParseIntPipe,
  UseGuards,
  BadRequestException,
} from '@nestjs/common';
import { Public } from '../common/decorators/public.decorator';
import { JwtAuthOptionalGuard } from '../common/guards/jwt-auth-optional.guard';
import { AlbumService } from './album.service';
import { AlbumCategoryService } from './album-category.service';
import { AlbumStatQueryDto } from './dto/album-stat-query.dto';

/**
 * PublicAlbumController — public endpoints for album browsing.
 * All routes use @Public() to skip JWT auth.
 * JwtAuthOptionalGuard parses token if present but does not require it.
 *
 * Route patterns match Go backend exactly:
 * - GET /api/public/albums           — getPublicAlbums (default pageSize=12)
 * - GET /api/public/album-categories — getPublicAlbumCategories
 * - PUT /api/public/stat/:id         — updateAlbumStat (view/download count)
 */
@Public()
@Controller()
@UseGuards(JwtAuthOptionalGuard)
export class PublicAlbumController {
  constructor(
    private readonly albumService: AlbumService,
    private readonly albumCategoryService: AlbumCategoryService,
  ) {}

  /**
   * GET /api/public/albums
   * Get public album list with pagination and filters.
   * Matches Go GetPublicAlbums (router.go).
   * Default pageSize=12 (not 10 like admin endpoint).
   */
  @Get('public/albums')
  async getPublicAlbums(@Query() query: any) {
    return this.albumService.findAlbums({
      page: query.page ? parseInt(query.page, 10) : 1,
      pageSize: query.pageSize ? parseInt(query.pageSize, 10) : 12,
      categoryId: query.categoryId ? parseInt(query.categoryId, 10) : undefined,
      tag: query.tag,
      createdAtStart: query.createdAt?.[0] || (Array.isArray(query['createdAt[0]']) ? query['createdAt[0]'] : query['createdAt[0]']),
      createdAtEnd: query.createdAt?.[1] || (Array.isArray(query['createdAt[1]']) ? query['createdAt[1]'] : query['createdAt[1]']),
      sort: query.sort || 'display_order_asc',
    });
  }

  /**
   * GET /api/public/album-categories
   * Get public album categories list.
   * Matches Go GetPublicAlbumCategories (router.go).
   */
  @Get('public/album-categories')
  async getPublicAlbumCategories() {
    return this.albumCategoryService.listCategories();
  }

  /**
   * PUT /api/public/stat/:id
   * Update album view or download count.
   * Matches Go UpdateAlbumStat (router.go).
   * Query param type: "view" or "download".
   * Returns null with message "更新成功".
   */
  @Put('public/stat/:id')
  async updateAlbumStat(
    @Param('id', ParseIntPipe) id: number,
    @Query() query: AlbumStatQueryDto,
  ) {
    await this.albumService.incrementAlbumStat(id, query.type);
    return null;
  }
}
