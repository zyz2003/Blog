import { Injectable, ConflictException, NotFoundException } from '@nestjs/common';
import { PostCategoryRepository } from './post-category.repository';
import { generatePublicID, EntityType } from '../common/utils/sqids.util';
import { formatToChinaTime, toISODateString } from '../common/utils/time.util';
import { ErrorCodes } from '../common/constants/error-codes';
import { CreatePostCategoryDto } from './dto/create-post-category.dto';
import { UpdatePostCategoryDto } from './dto/update-post-category.dto';

@Injectable()
export class PostCategoryService {
  constructor(private readonly repository: PostCategoryRepository) {}

  /**
   * List all non-deleted categories.
   * Matches Go PostCategoryService.List — returns array of PostCategoryResponse.
   */
  async list() {
    const categories = await this.repository.findAll();
    return categories.map((c) => this.toApiResponse(c));
  }

  /**
   * Create a new category.
   * Matches Go PostCategoryService.Create — checks name uniqueness, auto-generates slug.
   */
  async create(dto: CreatePostCategoryDto) {
    const existing = await this.repository.findByName(dto.name);
    if (existing) {
      throw new ConflictException(ErrorCodes.CATEGORY_NAME_EXISTS);
    }

    const category = await this.repository.create({
      name: dto.name,
      slug: dto.slug || this.generateSlug(dto.name),
      description: dto.description,
      isSeries: dto.is_series,
      sortOrder: dto.sort_order,
    });

    return this.toApiResponse(category);
  }

  /**
   * Update a category by database ID.
   * Matches Go PostCategoryService.Update.
   */
  async update(dbId: number, dto: UpdatePostCategoryDto) {
    const existing = await this.repository.findById(dbId);
    if (!existing) {
      throw new NotFoundException(ErrorCodes.CATEGORY_NOT_FOUND);
    }

    // Check name uniqueness if name is being changed
    if (dto.name && dto.name !== existing.name) {
      const nameConflict = await this.repository.findByName(dto.name);
      if (nameConflict) {
        throw new ConflictException(ErrorCodes.CATEGORY_NAME_EXISTS);
      }
    }

    const updateData: Record<string, any> = {};
    if (dto.name !== undefined) updateData.name = dto.name;
    if (dto.slug !== undefined) updateData.slug = dto.slug;
    if (dto.description !== undefined) updateData.description = dto.description;
    if (dto.is_series !== undefined) updateData.isSeries = dto.is_series;
    if (dto.sort_order !== undefined) updateData.sortOrder = dto.sort_order;

    const category = await this.repository.update(dbId, updateData);
    return this.toApiResponse(category);
  }

  /**
   * Soft-delete a category by database ID.
   * Matches Go PostCategoryService.Delete — sets deletedAt timestamp.
   */
  async delete(dbId: number) {
    const existing = await this.repository.findById(dbId);
    if (!existing) {
      throw new NotFoundException(ErrorCodes.CATEGORY_NOT_FOUND);
    }

    await this.repository.softDelete(dbId);
    return null;
  }

  /**
   * Convert database row to API response shape matching Go PostCategoryResponse.
   * Fields: id (Sqids), created_at, updated_at, name, slug, description, count, is_series, sort_order
   */
  private toApiResponse(category: any) {
    if (!category) return null;
    return {
      id: generatePublicID(category.id, EntityType.PostCategory),
      created_at: toISODateString(category.createdAt),
      updated_at: toISODateString(category.updatedAt),
      name: category.name,
      slug: category.slug,
      description: category.description,
      count: category.count,
      is_series: category.isSeries,
      sort_order: category.sortOrder,
    };
  }

  /**
   * Generate a URL-safe slug from name.
   * Matches Go util.GenerateSlug — lowercase, spaces to hyphens, strip special chars.
   */
  private generateSlug(name: string): string {
    return name
      .toLowerCase()
      .replace(/\s+/g, '-')
      .replace(/[^a-z0-9一-鿿-]/g, '')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '');
  }
}
