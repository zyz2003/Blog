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
  BadRequestException,
} from '@nestjs/common';
import { PostTagService } from './post-tag.service';
import { CreatePostTagDto } from './dto/create-post-tag.dto';
import { UpdatePostTagDto } from './dto/update-post-tag.dto';
import { Public } from '../common/decorators/public.decorator';
import { AdminGuard } from '../common/guards/admin.guard';
import { decodePublicID, EntityType } from '../common/utils/sqids.util';
import { ErrorCodes } from '../common/constants/error-codes';

@Controller('post-tags')
export class PostTagController {
  constructor(private readonly service: PostTagService) {}

  /**
   * GET /api/post-tags — Public list of all tags.
   * Matches Go router: JWTAuthOptional on list endpoint.
   * Using @Public() since optional JWT context is not needed for tag listing.
   */
  @Public()
  @Get()
  async list(@Query('sort') sort?: string) {
    // Go backend supports sort by 'count' or 'name', default 'count'.
    // For now, return all tags — sorting can be added when needed.
    return this.service.list();
  }

  /**
   * POST /api/post-tags — Create tag (admin only).
   * Matches Go router: JWTAuth + AdminAuth.
   */
  @HttpCode(HttpStatus.OK)
  @Post()
  @UseGuards(AdminGuard)
  async create(@Body() dto: CreatePostTagDto) {
    return this.service.create(dto);
  }

  /**
   * PUT /api/post-tags/:id — Update tag by Sqids public ID (admin only).
   * Matches Go router: JWTAuth + AdminAuth.
   * Controller decodes Sqids ID, passes dbId to service (per D-63).
   */
  @Put(':id')
  @UseGuards(AdminGuard)
  async update(@Param('id') publicId: string, @Body() dto: UpdatePostTagDto) {
    const { dbID, entityType } = decodePublicID(publicId);
    if (entityType !== EntityType.PostTag) {
      throw new BadRequestException(ErrorCodes.INVALID_PUBLIC_ID);
    }
    return this.service.update(dbID, dto);
  }

  /**
   * DELETE /api/post-tags/:id — Soft-delete tag by Sqids public ID (admin only).
   * Matches Go router: JWTAuth + AdminAuth.
   * Controller decodes Sqids ID, passes dbId to service (per D-63).
   */
  @Delete(':id')
  @UseGuards(AdminGuard)
  async delete(@Param('id') publicId: string) {
    const { dbID, entityType } = decodePublicID(publicId);
    if (entityType !== EntityType.PostTag) {
      throw new BadRequestException(ErrorCodes.INVALID_PUBLIC_ID);
    }
    return this.service.delete(dbID);
  }
}
