import { Inject, Injectable } from '@nestjs/common';
import { DRIZZLE } from '../database/database.module';
import { files } from '../database/schemas/file.schema';
import { entities } from '../database/schemas/entity.schema';
import { storagePolicies } from '../database/schemas/storage-policy.schema';
import { isNull, eq, and, desc, asc, count, sql } from 'drizzle-orm';

@Injectable()
export class FileRepository {
  constructor(@Inject(DRIZZLE) private readonly db: any) {}

  async findById(id: number) {
    const [file] = await this.db
      .select()
      .from(files)
      .where(and(eq(files.id, id), isNull(files.deletedAt)));
    return file ?? null;
  }

  async findByParentAndName(
    parentId: number | null,
    name: string,
    ownerId: number,
  ) {
    const conditions = [
      eq(files.name, name),
      eq(files.ownerId, ownerId),
      isNull(files.deletedAt),
    ];
    if (parentId === null) {
      conditions.push(isNull(files.parentId));
    } else {
      conditions.push(eq(files.parentId, parentId));
    }

    const [file] = await this.db
      .select()
      .from(files)
      .where(and(...conditions));
    return file ?? null;
  }

  async findChildrenByParentId(
    parentId: number | null,
    ownerId: number,
    options?: { page?: number; pageSize?: number; orderBy?: string; orderDirection?: string },
  ) {
    const page = options?.page ?? 1;
    const pageSize = options?.pageSize ?? 50;
    const orderBy = options?.orderBy ?? 'name';
    const orderDirection = options?.orderDirection ?? 'asc';

    const conditions = [
      eq(files.ownerId, ownerId),
      isNull(files.deletedAt),
    ];
    if (parentId === null) {
      conditions.push(isNull(files.parentId));
    } else {
      conditions.push(eq(files.parentId, parentId));
    }

    const whereClause = and(...conditions);

    const [{ count: total }] = await this.db
      .select({ count: sql`count(*)` })
      .from(files)
      .where(whereClause);

    // Determine sort column
    const orderCol = orderBy === 'size' ? files.size
      : orderBy === 'created_at' ? files.createdAt
      : orderBy === 'updated_at' ? files.updatedAt
      : files.name;
    const orderFn = orderDirection === 'desc' ? desc : asc;

    const list = await this.db
      .select()
      .from(files)
      .where(whereClause)
      .orderBy(orderFn(orderCol))
      .limit(pageSize)
      .offset((page - 1) * pageSize);

    return { list, total };
  }

  /**
   * Iteratively find all descendant file records under a directory.
   * Uses BFS since SQLite CTE support varies.
   */
  async findDescendantFiles(parentId: number): Promise<any[]> {
    const result: any[] = [];
    const queue: number[] = [parentId];

    while (queue.length > 0) {
      const currentId = queue.shift()!;
      const children = await this.db
        .select()
        .from(files)
        .where(
          and(eq(files.parentId, currentId), isNull(files.deletedAt)),
        );

      for (const child of children) {
        if (child.type === 2) {
          // Directory — recurse
          queue.push(child.id);
        }
        result.push(child);
      }
    }

    return result;
  }

  async createFile(data: any) {
    const [file] = await this.db
      .insert(files)
      .values(data)
      .returning();
    return file;
  }

  async updateFile(id: number, data: any) {
    const [file] = await this.db
      .update(files)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(files.id, id))
      .returning();
    return file ?? null;
  }

  async softDeleteFile(id: number) {
    const [file] = await this.db
      .update(files)
      .set({ deletedAt: new Date() })
      .where(eq(files.id, id))
      .returning();
    return file ?? null;
  }

  async findEntityById(id: number) {
    const [entity] = await this.db
      .select()
      .from(entities)
      .where(eq(entities.id, id));
    return entity ?? null;
  }

  async updateEntity(id: number, data: any) {
    const [entity] = await this.db
      .update(entities)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(entities.id, id))
      .returning();
    return entity ?? null;
  }

  async deleteEntity(id: number) {
    await this.db.delete(entities).where(eq(entities.id, id));
  }

  async findStoragePolicyById(id: number) {
    const [policy] = await this.db
      .select()
      .from(storagePolicies)
      .where(and(eq(storagePolicies.id, id), isNull(storagePolicies.deletedAt)));
    return policy ?? null;
  }

  async countChildren(parentId: number) {
    const [result] = await this.db
      .select({ count: sql`count(*)` })
      .from(files)
      .where(
        and(eq(files.parentId, parentId), isNull(files.deletedAt)),
      );
    return result?.count ?? 0;
  }
}
