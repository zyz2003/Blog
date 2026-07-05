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
  UseInterceptors,
  UploadedFile,
  Inject,
} from '@nestjs/common';
import { ArticleService } from './article.service';
import { CreateArticleDto } from './dto/create-article.dto';
import { UpdateArticleDto } from './dto/update-article.dto';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { decodePublicID, EntityType } from '../common/utils/sqids.util';
import { FileInterceptor } from '@nestjs/platform-express';
import { StoragePolicyService } from '../storage-policy/storage-policy.service';
import { ThumbnailService } from '../thumbnail/thumbnail.service';
import { generatePublicID } from '../common/utils/sqids.util';
import { files } from '../database/schemas/file.schema';
import { entities } from '../database/schemas/entity.schema';
import { DRIZZLE } from '../database/database.module';
import { eq, isNull, and } from 'drizzle-orm';
import * as fs from 'fs/promises';
import * as path from 'path';

@Controller('articles')
export class ArticleController {
  constructor(
    private readonly articleService: ArticleService,
    private readonly policyService: StoragePolicyService,
    private readonly thumbnailService: ThumbnailService,
    @Inject(DRIZZLE) private readonly db: any,
  ) {}

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

  /**
   * Article image upload — replaces Phase 03 501 stub per D-113.
   * Uses FileInterceptor('file') with StoragePolicyService and ThumbnailService.
   */
  @Post('upload')
  @UseInterceptors(FileInterceptor('file'))
  async uploadImage(
    @UploadedFile() file: Express.Multer.File,
    @CurrentUser() user: any,
  ) {
    if (!file) {
      throw new HttpException('未选择文件', HttpStatus.BAD_REQUEST);
    }

    const ownerId = this.extractOwnerDbId(user);

    // 1. Get default article_image policy per D-113
    const policy = await this.policyService.findByFlag('article_image');
    if (!policy) {
      throw new HttpException(
        '默认存储策略未初始化',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }

    // 2. Generate unique filename
    const timestamp = Date.now();
    const uniqueName = `${timestamp}-${file.originalname}`;

    // 3. Ensure target directory exists
    const targetDir = path.join(policy.basePath || 'data/uploads', 'articles');
    await fs.mkdir(targetDir, { recursive: true });

    // 4. Write uploaded file to target path
    const targetPath = path.join(targetDir, uniqueName);
    await fs.writeFile(targetPath, file.buffer);

    // 5. Create entity record
    const [entity] = await this.db
      .insert(entities)
      .values({
        type: 'image_content',
        source: targetPath,
        size: file.size,
        policyId: policy.id,
        createdBy: ownerId,
        mimeType: file.mimetype,
      })
      .returning();

    // 6. Create file record
    const [fileRecord] = await this.db
      .insert(files)
      .values({
        ownerId,
        name: file.originalname,
        size: file.size,
        type: 1, // file
        primaryEntityId: entity.id,
      })
      .returning();

    // 7. Generate thumbnail (try-catch per D-106)
    try {
      await this.thumbnailService.generateThumbnail(
        fileRecord.id,
        targetPath,
        file.originalname,
      );
    } catch {
      // Thumbnail failure does not block upload per D-106
    }

    // 8. Return response matching Go backend UploadImage format
    return {
      file_id: generatePublicID(fileRecord.id, EntityType.File),
      name: file.originalname,
      size: file.size,
    };
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
