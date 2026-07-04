import { Inject, Injectable } from '@nestjs/common';
import { DRIZZLE } from '../database/database.module';
import { pages } from '../database/schemas/page.schema';
import { isNull, eq, and, desc, like, or, sql } from 'drizzle-orm';

@Injectable()
export class PageRepository {
  constructor(@Inject(DRIZZLE) private readonly db: any) {}

  async findById(id: number) {
    const [page] = await this.db
      .select()
      .from(pages)
      .where(and(eq(pages.id, id), isNull(pages.deletedAt)));
    return page ?? null;
  }

  async findByPath(path: string) {
    const [page] = await this.db
      .select()
      .from(pages)
      .where(and(eq(pages.path, path), isNull(pages.deletedAt)));
    return page ?? null;
  }

  async existsByPath(path: string, excludeId?: number): Promise<boolean> {
    const conditions = [eq(pages.path, path), isNull(pages.deletedAt)];
    if (excludeId) {
      conditions.push(sql`${pages.id} != ${excludeId}`);
    }
    const [result] = await this.db
      .select({ id: pages.id })
      .from(pages)
      .where(and(...conditions))
      .limit(1);
    return !!result;
  }

  async create(data: any) {
    const [page] = await this.db.insert(pages).values(data).returning();
    return page;
  }

  async update(id: number, data: any) {
    data.updatedAt = new Date();
    const [page] = await this.db
      .update(pages)
      .set(data)
      .where(eq(pages.id, id))
      .returning();
    return page;
  }

  async softDelete(id: number) {
    await this.db
      .update(pages)
      .set({ deletedAt: new Date() })
      .where(eq(pages.id, id));
  }

  async list(options: {
    page: number;
    pageSize: number;
    search?: string;
    isPublished?: boolean;
  }) {
    const conditions = [isNull(pages.deletedAt)];

    if (options.search) {
      conditions.push(
        or(
          like(pages.title, `%${options.search}%`),
          like(pages.path, `%${options.search}%`),
          like(pages.description, `%${options.search}%`),
        )!,
      );
    }

    if (options.isPublished !== undefined) {
      conditions.push(eq(pages.isPublished, options.isPublished));
    }

    const totalResult = await this.db
      .select({ count: sql<number>`count(*)` })
      .from(pages)
      .where(and(...conditions));
    const total = totalResult[0]?.count ?? 0;

    const offset = (options.page - 1) * options.pageSize;
    const list = await this.db
      .select()
      .from(pages)
      .where(and(...conditions))
      .orderBy(desc(pages.sort), desc(pages.createdAt))
      .limit(options.pageSize)
      .offset(offset);

    return { list, total };
  }
}
