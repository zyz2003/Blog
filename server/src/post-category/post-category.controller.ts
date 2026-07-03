import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  UseGuards,
  BadRequestException,
} from '@nestjs/common';
import { PostCategoryService } from './post-category.service';
import { CreatePostCategoryDto } from './dto/create-post-category.dto';
import { UpdatePostCategoryDto } from './dto/update-post-category.dto';
import { Public } from '../common/decorators/public.decorator';
import { AdminGuard } from '../common/guards/admin.guard';
import { decodePublicID, EntityType } from '../common/utils/sqids.util';
import { ErrorCodes } from '../common/constants/error-codes';

@Controller('post-categories')
export class PostCategoryController {
  constructor(private readonly service: PostCategoryService) {}

  /**
   * GET /api/post-categories — Public list of all categories.
   * Matches Go router: no auth middleware on list endpoint.
   */
  @Public()
  @Get()
  async list() {
    return this.service.list();
  }

  /**
   * POST /api/post-categories — Create category (admin only).
   * Matches Go router: JWTAuth + AdminAuth.
   */
  @Post()
  @UseGuards(AdminGuard)
  async create(@Body() dto: CreatePostCategoryDto) {
    return this.service.create(dto);
  }

  /**
   * PUT /api/post-categories/:id — Update category by Sqids public ID (admin only).
   * Matches Go router: JWTAuth + AdminAuth.
   * Controller decodes Sqids ID, passes dbId to service (per D-63).
   */
  @Put(':id')
  @UseGuards(AdminGuard)
  async update(@Param('id') publicId: string, @Body() dto: UpdatePostCategoryDto) {
    const { dbID, entityType } = decodePublicID(publicId);
    if (entityType !== EntityType.PostCategory) {
      throw new BadRequestException(ErrorCodes.INVALID_PUBLIC_ID);
    }
    return this.service.update(dbID, dto);
  }

  /**
   * DELETE /api/post-categories/:id — Soft-delete category by Sqids public ID (admin only).
   * Matches Go router: JWTAuth + AdminAuth.
   * Controller decodes Sqids ID, passes dbId to service (per D-63).
   */
  @Delete(':id')
  @UseGuards(AdminGuard)
  async delete(@Param('id') publicId: string) {
    const { dbID, entityType } = decodePublicID(publicId);
    if (entityType !== EntityType.PostCategory) {
      throw new BadRequestException(ErrorCodes.INVALID_PUBLIC_ID);
    }
    return this.service.delete(dbID);
  }
}
