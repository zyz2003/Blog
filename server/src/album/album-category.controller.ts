import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  ParseIntPipe,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { AlbumCategoryService } from './album-category.service';
import { CreateAlbumCategoryRequestDto } from './dto/create-album-category-request.dto';
import { UpdateAlbumCategoryRequestDto } from './dto/update-album-category-request.dto';
import { AdminGuard } from '../common/guards/admin.guard';

/**
 * AlbumCategoryController — admin endpoints for album category management.
 * All routes require JWT auth (global guard) + AdminGuard.
 *
 * Route patterns match Go backend exactly:
 * - POST   /api/album-categories     — createCategory
 * - GET    /api/album-categories     — listCategories
 * - GET    /api/album-categories/:id — getCategory
 * - PUT    /api/album-categories/:id — updateCategory
 * - DELETE /api/album-categories/:id — deleteCategory
 */
@Controller()
@UseGuards(AdminGuard)
export class AlbumCategoryController {
  constructor(private readonly albumCategoryService: AlbumCategoryService) {}

  /**
   * POST /api/album-categories
   * Create a new album category.
   * Matches Go CreateCategory (handler.go).
   */
  @Post('album-categories')
  @HttpCode(HttpStatus.CREATED)
  async createCategory(@Body() dto: CreateAlbumCategoryRequestDto) {
    return this.albumCategoryService.createCategory({
      name: dto.name,
      description: dto.description,
      displayOrder: dto.displayOrder,
    });
  }

  /**
   * GET /api/album-categories
   * List all album categories ordered by displayOrder.
   * Matches Go ListCategories (handler.go).
   */
  @Get('album-categories')
  async listCategories() {
    return this.albumCategoryService.listCategories();
  }

  /**
   * GET /api/album-categories/:id
   * Get a single album category by ID.
   * Matches Go GetCategory (handler.go).
   */
  @Get('album-categories/:id')
  async getCategory(@Param('id', ParseIntPipe) id: number) {
    return this.albumCategoryService.getCategory(id);
  }

  /**
   * PUT /api/album-categories/:id
   * Update an album category.
   * Matches Go UpdateCategory (handler.go).
   */
  @Put('album-categories/:id')
  async updateCategory(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateAlbumCategoryRequestDto,
  ) {
    return this.albumCategoryService.updateCategory(id, {
      name: dto.name,
      description: dto.description,
      displayOrder: dto.displayOrder,
    });
  }

  /**
   * DELETE /api/album-categories/:id
   * Delete an album category (if not in use).
   * Matches Go DeleteCategory (handler.go).
   * Returns null with message "删除成功".
   */
  @Delete('album-categories/:id')
  async deleteCategory(@Param('id', ParseIntPipe) id: number) {
    await this.albumCategoryService.deleteCategory(id);
    return null;
  }
}
