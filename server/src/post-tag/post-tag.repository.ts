import { Inject, Injectable } from '@nestjs/common';
import { DRIZZLE } from '../database/database.module';
import { postTags } from '../database/schemas/post-tag.schema';
import { isNull, eq, and } from 'drizzle-orm';

@Injectable()
export class PostTagRepository {
  constructor(@Inject(DRIZZLE) private readonly db: any) {}

  async findAll() {
    return this.db
      .select()
      .from(postTags)
      .where(isNull(postTags.deletedAt));
  }

  async findById(dbId: number) {
    const [tag] = await this.db
      .select()
      .from(postTags)
      .where(and(eq(postTags.id, dbId), isNull(postTags.deletedAt)));
    return tag ?? null;
  }

  async findByName(name: string) {
    const [tag] = await this.db
      .select()
      .from(postTags)
      .where(and(eq(postTags.name, name), isNull(postTags.deletedAt)));
    return tag ?? null;
  }

  async create(data: { name: string; slug?: string }) {
    const [tag] = await this.db
      .insert(postTags)
      .values({
        name: data.name,
        slug: data.slug ?? null,
      })
      .returning();
    return tag;
  }

  async update(dbId: number, data: { name?: string; slug?: string }) {
    const [tag] = await this.db
      .update(postTags)
      .set(data)
      .where(eq(postTags.id, dbId))
      .returning();
    return tag ?? null;
  }

  async softDelete(dbId: number) {
    const [tag] = await this.db
      .update(postTags)
      .set({ deletedAt: new Date() })
      .where(eq(postTags.id, dbId))
      .returning();
    return tag ?? null;
  }
}
