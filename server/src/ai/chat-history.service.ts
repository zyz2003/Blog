import { Injectable, Inject } from '@nestjs/common';
import { eq, desc, asc, sql, count } from 'drizzle-orm';
import { DRIZZLE } from '../database/database.module';
import {
  generatePublicID,
  decodePublicID,
  EntityType,
} from '../common/utils/sqids.util';
import { chatConversations, chatMessages, ChatMessagePart } from './chat.schema';

/**
 * StoredMessage — the persisted form of a chat message.
 * Framework-agnostic: no AI SDK types, only primitive fields + JSON parts.
 */
export interface StoredMessage {
  role: 'user' | 'assistant' | 'system' | 'tool';
  content: string;
  parts?: ChatMessagePart[];
  inputTokens?: number;
  outputTokens?: number;
  createdAt: Date;
}

/**
 * StoredConversation — the persisted form of a chat conversation.
 */
export interface StoredConversation {
  publicId: string;
  title: string | null;
  profileId: string | null;
  userId: number | null;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * ChatHistoryService — framework-agnostic CRUD for chat conversations and messages.
 *
 * Per D-353: truncateHistory hard-deletes old messages (no soft-delete/recovery).
 * Per architecture doc §三.3: pure Drizzle queries, zero AI library imports.
 *
 * Migration-protected: this file does NOT import 'ai' or '@ai-sdk/*'. It will
 * survive a framework switch (e.g. to LangGraph) unchanged.
 */
@Injectable()
export class ChatHistoryService {
  constructor(@Inject(DRIZZLE) private db: any) {}

  /**
   * Create a new conversation row and return its Sqids-encoded publicId.
   * The publicId is generated from the inserted DB id + EntityType.ChatConversation.
   * Per D-391: userId is nullable — anonymous=null, logged-in=DB ID.
   */
  async createConversation(title?: string, profileId?: string, userId?: number | null): Promise<string> {
    const [row] = await this.db
      .insert(chatConversations)
      .values({
        title: title ?? null,
        profileId: profileId ?? null,
        userId: userId ?? null,
      })
      .returning({ id: chatConversations.id });

    const publicId = generatePublicID(row.id, EntityType.ChatConversation);

    await this.db
      .update(chatConversations)
      .set({ publicId })
      .where(eq(chatConversations.id, row.id));

    return publicId;
  }

  /**
   * Append a message to an existing conversation (looked up by publicId).
   * Decodes the publicId to get the DB-level conversation id.
   */
  async appendMessage(
    conversationPublicId: string,
    msg: Omit<StoredMessage, 'createdAt'>,
  ): Promise<void> {
    const { dbID } = decodePublicID(conversationPublicId);

    await this.db.insert(chatMessages).values({
      conversationId: dbID,
      role: msg.role,
      content: msg.content,
      parts: msg.parts ?? null,
      inputTokens: msg.inputTokens ?? null,
      outputTokens: msg.outputTokens ?? null,
    });
  }

  /**
   * Get all messages for a conversation, ordered by createdAt ascending.
   * Returns empty array if the conversation has no messages.
   * Parts are stored as JSON and returned as ChatMessagePart[] (or undefined if null).
   */
  async getMessages(conversationPublicId: string): Promise<StoredMessage[]> {
    const { dbID } = decodePublicID(conversationPublicId);

    const rows = await this.db
      .select()
      .from(chatMessages)
      .where(eq(chatMessages.conversationId, dbID))
      .orderBy(asc(chatMessages.createdAt));

    return rows.map((row: any) => ({
      role: row.role,
      content: row.content,
      parts: row.parts ?? undefined,
      inputTokens: row.inputTokens ?? undefined,
      outputTokens: row.outputTokens ?? undefined,
      createdAt: row.createdAt,
    }));
  }

  /**
   * Hard-delete old messages, keeping only the most recent `keepLast` messages.
   * Per D-353: keepLast is required (no default) — Phase 19's prepareStep decides the value.
   *
   * Strategy: select the ids of the messages to keep (ORDER BY created_at DESC LIMIT keepLast),
   * then delete all messages in the conversation whose id is NOT in the kept set.
   * If keepLast >= total message count, no deletion occurs.
   */
  async truncateHistory(
    conversationPublicId: string,
    keepLast: number,
  ): Promise<void> {
    const { dbID } = decodePublicID(conversationPublicId);

    // Get the ids of messages to keep (most recent `keepLast`)
    const keepRows = await this.db
      .select({ id: chatMessages.id })
      .from(chatMessages)
      .where(eq(chatMessages.conversationId, dbID))
      .orderBy(desc(chatMessages.createdAt))
      .limit(keepLast);

    // If no messages to keep (keepLast=0), delete all messages in the conversation
    if (keepRows.length === 0) {
      await this.db
        .delete(chatMessages)
        .where(eq(chatMessages.conversationId, dbID));
      return;
    }

    // Get all message ids for this conversation
    const allRows = await this.db
      .select({ id: chatMessages.id })
      .from(chatMessages)
      .where(eq(chatMessages.conversationId, dbID));

    // If all messages fit within keepLast, nothing to delete
    if (allRows.length <= keepLast) {
      return;
    }

    const keepIds = keepRows.map((r: any) => r.id);
    const toDeleteIds = allRows
      .map((r: any) => r.id)
      .filter((id: number) => !keepIds.includes(id));

    // Delete the messages not in the keep set
    if (toDeleteIds.length > 0) {
      await this.db
        .delete(chatMessages)
        .where(
          sql`${chatMessages.id} in (${sql.join(
            toDeleteIds.map((id: number) => sql`${id}`),
            sql`,`,
          )})`,
        );
    }
  }

  /**
   * List all conversations, ordered by updatedAt descending.
   * Returns publicId, title, profileId, userId, createdAt, updatedAt for each conversation.
   */
  async listConversations(): Promise<StoredConversation[]> {
    const rows = await this.db
      .select()
      .from(chatConversations)
      .orderBy(desc(chatConversations.updatedAt));

    return rows.map((row: any) => ({
      publicId: row.publicId,
      title: row.title,
      profileId: row.profileId,
      userId: row.userId ?? null,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    }));
  }

  /**
   * List conversations with pagination, ordered by updatedAt descending.
   * Returns paginated list with total count for pagination metadata.
   */
  async listConversationsPaged(
    page: number = 1,
    pageSize: number = 20,
  ): Promise<{ list: StoredConversation[]; total: number }> {
    const offset = (page - 1) * pageSize;

    const [rows, countResult] = await Promise.all([
      this.db
        .select()
        .from(chatConversations)
        .orderBy(desc(chatConversations.updatedAt))
        .limit(pageSize)
        .offset(offset),
      this.db
        .select({ total: count() })
        .from(chatConversations),
    ]);

    const total = countResult[0]?.total ?? 0;

    return {
      list: rows.map((row: any) => ({
        publicId: row.publicId,
        title: row.title,
        profileId: row.profileId,
        userId: row.userId ?? null,
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
      })),
      total,
    };
  }

  /**
   * Get messages for a conversation by publicId.
   * Alias for getMessages() — used by the controller for the messages endpoint.
   */
  async getConversationMessages(publicId: string): Promise<StoredMessage[]> {
    return this.getMessages(publicId);
  }

  /**
   * Delete a conversation and all its messages by publicId.
   * Order: messages first (FK constraint), then conversation row.
   */
  async deleteConversation(publicId: string): Promise<void> {
    const { dbID } = decodePublicID(publicId);

    // Delete messages first (FK constraint)
    await this.db
      .delete(chatMessages)
      .where(eq(chatMessages.conversationId, dbID));

    // Then delete the conversation row
    await this.db
      .delete(chatConversations)
      .where(eq(chatConversations.id, dbID));
  }
}
