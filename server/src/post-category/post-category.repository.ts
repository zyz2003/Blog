import { Inject, Injectable } from '@nestjs/common';
import { DRIZZLE } from '../database/database.module';
import { postCategories } from '../database/schemas/post-category.schema';
import { isNull, eq, and, sql } from 'drizzle-orm';

@Injectable()
export class PostCategoryRepository {
  constructor(@Inject(DRIZZLE) private readonly db: any) {}

  async findAll() {
    return this.db
      .select()
      .from(postCategories)
      .where(isNull(postCategories.deletedAt));
  }

  async findById(dbId: number) {
    const [category] = await this.db
      .select()
      .from(postCategories)
      .where(and(eq(postCategories.id, dbId), isNull(postCategories.deletedAt)));
    return category ?? null;
  }

  async findByName(name: string) {
    const [category] = await this.db
      .select()
      .from(postCategories)
      .where(and(eq(postCategories.name, name), isNull(postCategories.deletedAt)));
    return category ?? null;
  }

  async create(data: {
    name: string;
    slug?: string;
    description?: string;
    isSeries?: boolean;
    sortOrder?: number;
  }) {
    const [category] = await this.db
      .insert(postCategories)
      .values({
        name: data.name,
        slug: data.slug ?? null,
        description: data.description ?? null,
        isSeries: data.isSeries ?? false,
        sortOrder: data.sortOrder ?? 0,
      })
      .returning();
    return category;
  }

  async update(
    dbId: number,
    data: {
      name?: string;
      slug?: string;
      description?: string;
      isSeries?: boolean;
      sortOrder?: number;
    },
  ) {
    const [category] = await this.db
      .update(postCategories)
      .set(data)
      .where(eq(postCategories.id, dbId))
      .returning();
    return category ?? null;
  }

  async softDelete(dbId: number) {
    const [category] = await this.db
      .update(postCategories)
      .set({ deletedAt: new Date() })
      .where(eq(postCategories.id, dbId))
      .returning();
    return category ?? null;
  }

  async incrementCount(dbId: number) {
    await this.db
      .update(postCategories)
      .set({ count: sql`${postCategories.count} + 1` })
      .where(eq(postCategories.id, dbId));
  }

  async decrementCount(dbId: number) {
    await this.db
      .update(postCategories)
      .set({ count: sql`CASE WHEN ${postCategories.count} > 0 THEN ${postCategories.count} - 1 ELSE 0 END` })
      .where(eq(postCategories.id, dbId));
  }
}
