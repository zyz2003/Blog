import { Injectable, ConflictException, NotFoundException } from '@nestjs/common';
import { PostTagRepository } from './post-tag.repository';
import { generatePublicID, EntityType } from '../common/utils/sqids.util';
import { formatToChinaTime, toISODateString } from '../common/utils/time.util';
import { ErrorCodes } from '../common/constants/error-codes';
import { CreatePostTagDto } from './dto/create-post-tag.dto';
import { UpdatePostTagDto } from './dto/update-post-tag.dto';

@Injectable()
export class PostTagService {
  constructor(private readonly repository: PostTagRepository) {}

  /**
   * List all non-deleted tags.
   * Matches Go PostTagService.List — returns array of PostTagResponse.
   */
  async list() {
    const tags = await this.repository.findAll();
    return tags.map((t) => this.toApiResponse(t));
  }

  /**
   * Create a new tag.
   * Matches Go PostTagService.Create — checks name uniqueness, auto-generates slug.
   */
  async create(dto: CreatePostTagDto) {
    const existing = await this.repository.findByName(dto.name);
    if (existing) {
      throw new ConflictException(ErrorCodes.TAG_NAME_EXISTS);
    }

    const tag = await this.repository.create({
      name: dto.name,
      slug: dto.slug || this.generateSlug(dto.name),
    });

    return this.toApiResponse(tag);
  }

  /**
   * Update a tag by database ID.
   * Matches Go PostTagService.Update.
   */
  async update(dbId: number, dto: UpdatePostTagDto) {
    const existing = await this.repository.findById(dbId);
    if (!existing) {
      throw new NotFoundException(ErrorCodes.TAG_NOT_FOUND);
    }

    // Check name uniqueness if name is being changed
    if (dto.name && dto.name !== existing.name) {
      const nameConflict = await this.repository.findByName(dto.name);
      if (nameConflict) {
        throw new ConflictException(ErrorCodes.TAG_NAME_EXISTS);
      }
    }

    const updateData: Record<string, any> = {};
    if (dto.name !== undefined) updateData.name = dto.name;
    if (dto.slug !== undefined) updateData.slug = dto.slug;

    const tag = await this.repository.update(dbId, updateData);
    return this.toApiResponse(tag);
  }

  /**
   * Soft-delete a tag by database ID.
   * Matches Go PostTagService.Delete — sets deletedAt timestamp.
   */
  async delete(dbId: number) {
    const existing = await this.repository.findById(dbId);
    if (!existing) {
      throw new NotFoundException(ErrorCodes.TAG_NOT_FOUND);
    }

    await this.repository.softDelete(dbId);
    return null;
  }

  /**
   * Convert database row to API response shape matching Go PostTagResponse.
   * Fields: id (Sqids), created_at, updated_at, name, slug, count
   */
  private toApiResponse(tag: any) {
    if (!tag) return null;
    return {
      id: generatePublicID(tag.id, EntityType.PostTag),
      created_at: toISODateString(tag.createdAt),
      updated_at: toISODateString(tag.updatedAt),
      name: tag.name,
      slug: tag.slug,
      count: tag.count,
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
