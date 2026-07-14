import { Inject, Injectable } from '@nestjs/common';
import { DRIZZLE } from '../database/database.module';
import { subscribers } from '../database/schemas/subscriber.schema';
import { eq, and } from 'drizzle-orm';

/**
 * SubscriberRepository — Drizzle query methods for subscribers table.
 * Reference: Go pkg/repository/subscriber/repository.go
 */
@Injectable()
export class SubscriberRepository {
  constructor(@Inject(DRIZZLE) private readonly db: any) {}

  /**
   * Find a subscriber by email address.
   */
  async findByEmail(email: string) {
    const [row] = await this.db
      .select()
      .from(subscribers)
      .where(eq(subscribers.email, email))
      .limit(1);
    return row || null;
  }

  /**
   * Create a new subscriber record.
   * Returns the created record with auto-generated id.
   */
  async create(data: { email: string; isActive: boolean; token: string }) {
    const [row] = await this.db
      .insert(subscribers)
      .values({
        email: data.email,
        isActive: data.isActive,
        token: data.token,
      })
      .returning();
    return row;
  }

  /**
   * Update the isActive status of a subscriber.
   * Also updates the updatedAt timestamp.
   */
  async updateIsActive(id: number, isActive: boolean) {
    const [row] = await this.db
      .update(subscribers)
      .set({
        isActive,
        updatedAt: new Date(),
      })
      .where(eq(subscribers.id, id))
      .returning();
    return row;
  }

  /**
   * Find a subscriber by their unsubscribe token.
   * Used for token-based unsubscribe from email links.
   */
  async findByToken(token: string) {
    const [row] = await this.db
      .select()
      .from(subscribers)
      .where(eq(subscribers.token, token))
      .limit(1);
    return row || null;
  }

  /**
   * Find all active subscribers.
   * Used for sending article published notifications.
   */
  async findActiveSubscribers() {
    return this.db
      .select()
      .from(subscribers)
      .where(eq(subscribers.isActive, true));
  }
}
