import { Inject, Injectable } from '@nestjs/common';
import { DRIZZLE } from '../database/database.module';
import { storagePolicies } from '../database/schemas/storage-policy.schema';
import { files } from '../database/schemas/file.schema';
import { entities } from '../database/schemas/entity.schema';
import { isNull, eq, and, desc, count, sql } from 'drizzle-orm';

@Injectable()
export class StoragePolicyRepository {
  constructor(@Inject(DRIZZLE) private readonly db: any) {}

  async findById(id: number) {
    const [policy] = await this.db
      .select()
      .from(storagePolicies)
      .where(and(eq(storagePolicies.id, id), isNull(storagePolicies.deletedAt)));
    return policy ?? null;
  }

  async findByName(name: string) {
    const [policy] = await this.db
      .select()
      .from(storagePolicies)
      .where(
        and(eq(storagePolicies.name, name), isNull(storagePolicies.deletedAt)),
      );
    return policy ?? null;
  }

  async findByFlag(flag: string) {
    const [policy] = await this.db
      .select()
      .from(storagePolicies)
      .where(
        and(eq(storagePolicies.flag, flag), isNull(storagePolicies.deletedAt)),
      );
    return policy ?? null;
  }

  async create(data: any) {
    const [policy] = await this.db
      .insert(storagePolicies)
      .values(data)
      .returning();
    return policy;
  }

  async update(id: number, data: any) {
    const [policy] = await this.db
      .update(storagePolicies)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(storagePolicies.id, id))
      .returning();
    return policy ?? null;
  }

  async softDelete(id: number) {
    const [policy] = await this.db
      .update(storagePolicies)
      .set({ deletedAt: new Date() })
      .where(eq(storagePolicies.id, id))
      .returning();
    return policy ?? null;
  }

  async list(options: { page: number; pageSize: number }) {
    const { page, pageSize } = options;

    const whereClause = isNull(storagePolicies.deletedAt);

    const [{ count: total }] = await this.db
      .select({ count: sql`count(*)` })
      .from(storagePolicies)
      .where(whereClause);

    const list = await this.db
      .select()
      .from(storagePolicies)
      .where(whereClause)
      .orderBy(desc(storagePolicies.id))
      .limit(pageSize)
      .offset((page - 1) * pageSize);

    return { list, total };
  }

  async hasReferencingFiles(id: number): Promise<boolean> {
    const [result] = await this.db
      .select({ count: sql`count(*)` })
      .from(files)
      .innerJoin(entities, eq(files.primaryEntityId, entities.id))
      .where(and(eq(entities.policyId, id), isNull(files.deletedAt)));

    return (result?.count ?? 0) > 0;
  }
}
