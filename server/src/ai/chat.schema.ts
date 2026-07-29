import { sqliteTable, integer, text } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';

/**
 * Chat history storage schema — framework-agnostic migration-protected asset.
 *
 * Zero AI library imports (no `ai` or `@ai-sdk/*`). This file survives a
 * framework switch (e.g. to LangGraph) unchanged.
 *
 * Per D-352: ChatMessagePart union covers the three core variants that AI SDK
 * UIMessage parts map to. Phase 18+ can extend the union with reasoning /
 * source variants without breaking existing data.
 */

// --- ChatMessagePart union type (discriminated union, type-only) ---

export type TextPart = {
  type: 'text';
  text: string;
};

export type ToolCallPart = {
  type: 'tool_call';
  toolCallId: string;
  toolName: string;
  args: unknown;
};

export type ToolResultPart = {
  type: 'tool_result';
  toolCallId: string;
  result: unknown;
};

export type ChatMessagePart = TextPart | ToolCallPart | ToolResultPart;

// --- Drizzle tables ---

export const chatConversations = sqliteTable('chat_conversations', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  publicId: text('public_id').unique(),
  title: text('title'),
  profileId: text('profile_id'),
  userId: integer('user_id'),
  createdAt: integer('created_at', { mode: 'timestamp' }).default(sql`(unixepoch())`),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).default(sql`(unixepoch())`),
});

export const chatMessages = sqliteTable('chat_messages', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  conversationId: integer('conversation_id').notNull(),
  role: text('role').notNull(),
  content: text('content'),
  parts: text('parts', { mode: 'json' }),
  inputTokens: integer('input_tokens'),
  outputTokens: integer('output_tokens'),
  createdAt: integer('created_at', { mode: 'timestamp' }).default(sql`(unixepoch())`),
});
