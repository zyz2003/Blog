import { Inject, Injectable } from '@nestjs/common';
import { DRIZZLE } from '../database/database.module';
import { albumCategories } from '../database/schemas/album-category.schema';
import { albums } from '../database/schemas/album.schema';
import { isNull, eq, and, asc, sql } from 'drizzle-orm';

export interface CreateCategoryParams {
  name: string;
  description?: string;
  displayOrder?: number;
}

export interface UpdateCategoryParams {
  name?: string;
  description?: string;
  displayOrder?: number;
}

@Injectable()
export class AlbumCategoryRepository {
  constructor(@Inject(DRIZZLE) private readonly db: any) {}

  /**
   * Create a new album category.
   * Returns the inserted record with all fields.
   */
  async create(params: CreateCategoryParams) {
    const [category] = await this.db
      .insert(albumCategories)
      .values({
        name: params.name,
        description: params.description ?? null,
        displayOrder: params.displayOrder ?? 0,
      })
      .returning();
    return category;
  }

  /**
   * Find all album categories, ordered by displayOrder ASC.
   * Matches Go ListCategories response order.
   */
  async findAll() {
    return this.db
      .select()
      .from(albumCategories)
      .orderBy(asc(albumCategories.displayOrder));
  }

  /**
   * Find a single category by ID.
   */
  async getById(id: number) {
    const [category] = await this.db
      .select()
      .from(albumCategories)
      .where(eq(albumCategories.id, id));
    return category ?? null;
  }

  /**
   * Find a category by name. Used for name uniqueness check.
   */
  async getByName(name: string) {
    const [category] = await this.db
      .select()
      .from(albumCategories)
      .where(eq(albumCategories.name, name));
    return category ?? null;
  }

  /**
   * Update category fields by ID.
   */
  async update(id: number, params: UpdateCategoryParams) {
    const [category] = await this.db
      .update(albumCategories)
      .set(params)
      .where(eq(albumCategories.id, id))
      .returning();
    return category ?? null;
  }

  /**
   * Delete a category only if no active album references it.
   * Checks for albums WHERE category_id = X AND deleted_at IS NULL.
   * Hard delete (AlbumCategory has no SoftDeleteMixin per Go schema).
   * Returns true if deleted, throws if category is in use.
   */
  async delete(id: number): Promise<boolean> {
    // Check if any active album references this category
    const [result] = await this.db
      .select({ count: sql`count(*)` })
      .from(albums)
      .where(and(eq(albums.categoryId, id), isNull(albums.deletedAt)));

    if ((result?.count ?? 0) > 0) {
      return false; // Category is in use — service layer will throw appropriate error
    }

    await this.db
      .delete(albumCategories)
      .where(eq(albumCategories.id, id));
    return true;
  }

  /**
   * Get all categories for import validation.
   * Returns all categories as name→id map for FK validation during import.
   */
  async findAllForImport() {
    const allCategories = await this.db
      .select()
      .from(albumCategories);

    const categoryMap = new Map<string, any>();
    for (const cat of allCategories) {
      categoryMap.set(cat.name, cat);
    }
    return categoryMap;
  }
}
