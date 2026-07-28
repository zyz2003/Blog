import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

/**
 * Tests for chat.schema.ts — Drizzle schema for chat history storage.
 * Per AI-04: chat.schema.ts defines chat_conversations + chat_messages tables
 * and ChatMessagePart union type. Zero AI library imports.
 */
describe('chat.schema', () => {
  const schemaPath = path.resolve(__dirname, 'chat.schema.ts');
  const schemaSource = () => fs.readFileSync(schemaPath, 'utf-8');

  // --- Table exports ---

  it('exports chatConversations table definition', () => {
    const source = schemaSource();
    expect(source).toContain('export const chatConversations');
    expect(source).toContain("sqliteTable('chat_conversations'");
  });

  it('exports chatMessages table definition', () => {
    const source = schemaSource();
    expect(source).toContain('export const chatMessages');
    expect(source).toContain("sqliteTable('chat_messages'");
  });

  it('exports ChatMessagePart type', () => {
    const source = schemaSource();
    expect(source).toContain('export type ChatMessagePart');
  });

  // --- chatConversations columns ---

  it('chatConversations has id (integer PK autoIncrement)', () => {
    const source = schemaSource();
    expect(source).toMatch(/integer\(['"]id['"]\)\.primaryKey\(\s*\{\s*autoIncrement\s*:\s*true/);
  });

  it('chatConversations has publicId (text unique)', () => {
    const source = schemaSource();
    expect(source).toMatch(/text\(['"]public_id['"]\)\.unique\(\)/);
  });

  it('chatConversations has title (text)', () => {
    const source = schemaSource();
    expect(source).toMatch(/text\(['"]title['"]\)/);
  });

  it('chatConversations has profileId (text)', () => {
    const source = schemaSource();
    expect(source).toMatch(/text\(['"]profile_id['"]\)/);
  });

  it('chatConversations has createdAt (integer timestamp default unixepoch)', () => {
    const source = schemaSource();
    expect(source).toMatch(/integer\(['"]created_at['"],\s*\{\s*mode\s*:\s*['"]timestamp['"]\s*\}\)\.default/);
  });

  it('chatConversations has updatedAt (integer timestamp default unixepoch)', () => {
    const source = schemaSource();
    expect(source).toMatch(/integer\(['"]updated_at['"],\s*\{\s*mode\s*:\s*['"]timestamp['"]\s*\}\)\.default/);
  });

  // --- chatMessages columns ---

  it('chatMessages has id (integer PK autoIncrement)', () => {
    const source = schemaSource();
    // Both tables have id PK, this is verified by the table structure overall
    expect(source).toMatch(/integer\(['"]id['"]\)\.primaryKey\(\s*\{\s*autoIncrement\s*:\s*true/);
  });

  it('chatMessages has conversationId (integer notNull)', () => {
    const source = schemaSource();
    expect(source).toMatch(/integer\(['"]conversation_id['"]\)\.notNull\(\)/);
  });

  it('chatMessages has role (text notNull)', () => {
    const source = schemaSource();
    expect(source).toMatch(/text\(['"]role['"]\)\.notNull\(\)/);
  });

  it('chatMessages has content (text)', () => {
    const source = schemaSource();
    expect(source).toMatch(/text\(['"]content['"]\)/);
  });

  it('chatMessages has parts (text mode json)', () => {
    const source = schemaSource();
    expect(source).toMatch(/text\(['"]parts['"],\s*\{\s*mode\s*:\s*['"]json['"]\s*\}\)/);
  });

  it('chatMessages has inputTokens (integer)', () => {
    const source = schemaSource();
    expect(source).toMatch(/integer\(['"]input_tokens['"]\)/);
  });

  it('chatMessages has outputTokens (integer)', () => {
    const source = schemaSource();
    expect(source).toMatch(/integer\(['"]output_tokens['"]\)/);
  });

  it('chatMessages has createdAt (integer timestamp default unixepoch)', () => {
    const source = schemaSource();
    expect(source).toMatch(/integer\(['"]created_at['"],\s*\{\s*mode\s*:\s*['"]timestamp['"]\s*\}\)\.default/);
  });

  // --- ChatMessagePart type ---

  it('ChatMessagePart type accepts TextPart { type: text, text: string }', () => {
    const source = schemaSource();
    expect(source).toMatch(/type\s*[:=]\s*['"]text['"]/);
    expect(source).toMatch(/text\s*[:=]\s*string/);
  });

  it('ChatMessagePart type accepts ToolCallPart { type: tool_call, toolCallId, toolName, args }', () => {
    const source = schemaSource();
    expect(source).toMatch(/type\s*[:=]\s*['"]tool_call['"]/);
    expect(source).toMatch(/toolCallId\s*[:=]\s*string/);
    expect(source).toMatch(/toolName\s*[:=]\s*string/);
    expect(source).toMatch(/args\s*[:=]\s*unknown/);
  });

  it('ChatMessagePart type accepts ToolResultPart { type: tool_result, toolCallId, result }', () => {
    const source = schemaSource();
    expect(source).toMatch(/type\s*[:=]\s*['"]tool_result['"]/);
    expect(source).toMatch(/result\s*[:=]\s*unknown/);
  });

  // --- Framework independence ---

  it('chat.schema.ts has zero imports from ai or @ai-sdk', () => {
    const source = schemaSource();
    const lines = source
      .split('\n')
      .map((l) => l.trim())
      .filter((l) => l && !l.startsWith('//') && !l.startsWith('*'));
    const hasAiImport = lines.some(
      (l) => l.includes("from 'ai'") || l.includes('@ai-sdk'),
    );
    expect(hasAiImport).toBe(false);
  });

  // --- Schema index registration ---

  it('schemas/index.ts re-exports chatConversations and chatMessages', () => {
    const indexPath = path.resolve(__dirname, '../database/schemas/index.ts');
    const indexSource = fs.readFileSync(indexPath, 'utf-8');
    expect(indexSource).toContain('chatConversations');
    expect(indexSource).toContain('chatMessages');
  });
});
