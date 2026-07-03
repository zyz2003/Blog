import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { ArticleService } from './article.service';
import { CreateArticleDto } from './dto/create-article.dto';
import { UpdateArticleDto } from './dto/update-article.dto';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { decodePublicID, EntityType } from '../common/utils/sqids.util';

@Controller('articles')
export class ArticleController {
  constructor(private readonly articleService: ArticleService) {}

  @Post()
  async create(
    @Body() dto: CreateArticleDto,
    @CurrentUser() user: any,
  ) {
    // Decode user public ID to DB ID for ownerId
    const ownerDbId = this.extractOwnerDbId(user);
    return this.articleService.create(dto, ownerDbId);
  }

  @Get()
  async list(@Query() query: any) {
    return this.articleService.list({
      page: query.page ? parseInt(query.page, 10) : undefined,
      pageSize: query.pageSize ? parseInt(query.pageSize, 10) : undefined,
      query: query.query,
      status: query.status,
      category: query.category,
      tag: query.tag,
    });
  }

  @Get(':id')
  async get(@Param('id') publicId: string) {
    return this.articleService.get(publicId);
  }

  @Put(':id')
  async update(
    @Param('id') publicId: string,
    @Body() dto: UpdateArticleDto,
    @CurrentUser() user: any,
  ) {
    const ownerDbId = this.extractOwnerDbId(user);
    return this.articleService.update(publicId, dto, ownerDbId);
  }

  @Delete(':id')
  async delete(@Param('id') publicId: string) {
    return this.articleService.delete(publicId);
  }

  // Stubs for Phase 05 dependencies
  @Post('upload')
  async uploadImage() {
    throw new HttpException('功能暂未实现', HttpStatus.NOT_IMPLEMENTED);
  }

  @Post('primary-color')
  async getPrimaryColor(@Body() body: { image_url?: string }) {
    return { primary_color: '#b4bfe2' };
  }

  @Post('export')
  async exportArticles() {
    throw new HttpException('功能暂未实现', HttpStatus.NOT_IMPLEMENTED);
  }

  @Post('import')
  async importArticles() {
    throw new HttpException('功能暂未实现', HttpStatus.NOT_IMPLEMENTED);
  }

  @Delete('batch')
  async batchDelete() {
    throw new HttpException('功能暂未实现', HttpStatus.NOT_IMPLEMENTED);
  }

  private extractOwnerDbId(user: any): number {
    if (!user) return 1; // Default owner
    // User object from JWT may have id as public Sqids ID or raw dbId
    if (user.dbId) return user.dbId;
    if (user.id) {
      try {
        const { dbID, entityType } = decodePublicID(user.id);
        if (entityType === EntityType.User) return dbID;
      } catch {
        // Not a Sqids ID, might be a raw number
      }
    }
    return 1;
  }
}
