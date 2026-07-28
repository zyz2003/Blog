import { describe, it, expect, vi, beforeEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import { Test } from '@nestjs/testing';

// Mock sqids.util at module level
vi.mock('../../common/utils/sqids.util', () => ({
  generatePublicID: vi.fn().mockReturnValue('mock-pub-id'),
  decodePublicID: vi.fn().mockReturnValue({ dbID: 42, entityType: 23 }),
  EntityType: {
    User: 1,
    File: 2,
    Article: 8,
    Link: 22,
    ChatConversation: 23,
  },
}));

import { ChatHistoryService } from './chat-history.service';
import { generatePublicID, decodePublicID, EntityType } from '../../common/utils/sqids.util';

const mockGeneratePublicID = vi.mocked(generatePublicID);
const mockDecodePublicID = vi.mocked(decodePublicID);

/**
 * Helper: create a fresh mock db with chainable query builder methods.
 * Each method returns `this` (mockReturnThis) so query chains work,
 * except terminal methods (limit, returning, orderBy, where, all, get)
 * which resolve to configurable arrays.
 */
function createMockDb() {
  const db: any = {
    insert: vi.fn().mockReturnThis(),
    values: vi.fn().mockReturnThis(),
    returning: vi.fn().mockResolvedValue([{ id: 1 }]),
    update: vi.fn().mockReturnThis(),
    set: vi.fn().mockReturnThis(),
    delete: vi.fn().mockReturnThis(),
    select: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    orderBy: vi.fn().mockReturnThis(),
    limit: vi.fn().mockResolvedValue([]),
    all: vi.fn().mockReturnValue([]),
    get: vi.fn().mockReturnValue(undefined),
    run: vi.fn().mockReturnValue({ changes: 0 }),
  };
  return db;
}

describe('ChatHistoryService', () => {
  let service: ChatHistoryService;
  let mockDb: any;

  beforeEach(async () => {
    vi.clearAllMocks();
    mockDb = createMockDb();

    // Reset default mock returns
    mockGeneratePublicID.mockReturnValue('conv-pub-123');
    mockDecodePublicID.mockReturnValue({ dbID: 42, entityType: EntityType.ChatConversation });

    const module = await Test.createTestingModule({
      providers: [
        ChatHistoryService,
        { provide: 'DRIZZLE', useValue: mockDb },
      ],
    }).compile();

    service = module.get(ChatHistoryService);
  });

  // --- Test 1: @Injectable decorator ---

  it('is an injectable NestJS service (has @Injectable decorator)', () => {
    // The service was successfully injected via NestJS DI, proving @Injectable()
    expect(service).toBeDefined();
    expect(service).toBeInstanceOf(ChatHistoryService);
  });

  // --- Test 2: createConversation inserts and returns publicId ---

  it('createConversation() inserts into chat_conversations with title and profileId, returns publicId', async () => {
    mockDb.returning.mockResolvedValueOnce([{ id: 7 }]);

    const result = await service.createConversation('My Chat', 'profile-1');

    expect(mockDb.insert).toHaveBeenCalledTimes(1);
    expect(mockDb.values).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'My Chat',
        profileId: 'profile-1',
      }),
    );
    expect(result).toBe('conv-pub-123');
  });

  // --- Test 3: createConversation uses EntityType.ChatConversation = 23 ---

  it('createConversation() generates publicId via generatePublicID with EntityType.ChatConversation=23', async () => {
    mockDb.returning.mockResolvedValueOnce([{ id: 99 }]);

    await service.createConversation('Title', 'profile-1');

    expect(mockGeneratePublicID).toHaveBeenCalledWith(99, EntityType.ChatConversation);
    expect(EntityType.ChatConversation).toBe(23);
  });

  // --- Test 4: createConversation without title sets title to null ---

  it('createConversation() without title sets title to null', async () => {
    mockDb.returning.mockResolvedValueOnce([{ id: 1 }]);

    await service.createConversation();

    expect(mockDb.values).toHaveBeenCalledWith(
      expect.objectContaining({
        title: null,
      }),
    );
  });

  // --- Test 5: appendMessage inserts with all fields ---

  it('appendMessage() inserts into chat_messages with conversationId, role, content, parts, inputTokens, outputTokens', async () => {
    const msg = {
      role: 'user' as const,
      content: 'Hello',
      parts: [{ type: 'text' as const, text: 'Hello' }],
      inputTokens: 10,
      outputTokens: 0,
    };

    await service.appendMessage('conv-pub-123', msg);

    expect(mockDb.insert).toHaveBeenCalledTimes(1);
    expect(mockDb.values).toHaveBeenCalledWith(
      expect.objectContaining({
        conversationId: 42,
        role: 'user',
        content: 'Hello',
        parts: [{ type: 'text', text: 'Hello' }],
        inputTokens: 10,
        outputTokens: 0,
      }),
    );
  });

  // --- Test 6: appendMessage resolves conversationId from publicId via decodePublicID ---

  it('appendMessage() resolves conversationId from publicId by decoding via decodePublicID', async () => {
    mockDecodePublicID.mockReturnValueOnce({ dbID: 77, entityType: 23 });

    await service.appendMessage('some-pub-id', {
      role: 'assistant',
      content: 'Hi',
    });

    expect(mockDecodePublicID).toHaveBeenCalledWith('some-pub-id');
    expect(mockDb.values).toHaveBeenCalledWith(
      expect.objectContaining({
        conversationId: 77,
      }),
    );
  });

  // --- Test 7: getMessages returns StoredMessage[] ordered by createdAt asc ---

  it('getMessages() returns StoredMessage[] ordered by createdAt ascending', async () => {
    const date1 = new Date('2026-01-01T00:00:00Z');
    const date2 = new Date('2026-01-02T00:00:00Z');
    mockDb.orderBy.mockResolvedValueOnce([
      { role: 'user', content: 'first', parts: null, inputTokens: null, outputTokens: null, createdAt: date1 },
      { role: 'assistant', content: 'second', parts: null, inputTokens: 5, outputTokens: 20, createdAt: date2 },
    ]);

    const messages = await service.getMessages('conv-pub-123');

    expect(messages).toHaveLength(2);
    expect(messages[0].content).toBe('first');
    expect(messages[1].content).toBe('second');
    expect(messages[0].createdAt).toEqual(date1);
    expect(messages[1].createdAt).toEqual(date2);
  });

  // --- Test 8: getMessages maps parts from JSON column to ChatMessagePart[] ---

  it('getMessages() maps parts from JSON column to ChatMessagePart[] type', async () => {
    const parts = [{ type: 'text', text: 'hello' }];
    mockDb.orderBy.mockResolvedValueOnce([
      { role: 'user', content: 'hello', parts, inputTokens: null, outputTokens: null, createdAt: new Date() },
    ]);

    const messages = await service.getMessages('conv-pub-123');

    expect(messages[0].parts).toEqual([{ type: 'text', text: 'hello' }]);
  });

  // --- Test 9: getMessages returns empty array for nonexistent conversation ---

  it('getMessages() returns empty array for nonexistent conversation', async () => {
    mockDb.orderBy.mockResolvedValueOnce([]);

    const messages = await service.getMessages('nonexistent-id');

    expect(messages).toEqual([]);
  });

  // --- Test 10: truncateHistory keeps only last N messages ---

  it('truncateHistory(conversationId, keepLast=3) deletes oldest messages keeping only last 3', async () => {
    // The service queries for messages to keep (last 3 by id desc), then deletes the rest
    mockDb.orderBy.mockResolvedValueOnce([
      { id: 5 }, { id: 4 }, { id: 3 },  // keep these (last 3)
    ]);

    await service.truncateHistory('conv-pub-123', 3);

    expect(mockDb.delete).toHaveBeenCalledTimes(1);
    expect(mockDb.where).toHaveBeenCalled();
  });

  // --- Test 11: truncateHistory with keepLast=0 deletes all ---

  it('truncateHistory() with keepLast=0 deletes all messages in the conversation', async () => {
    // When keepLast=0, the "keep" query returns empty, so all messages get deleted
    mockDb.orderBy.mockResolvedValueOnce([]);

    await service.truncateHistory('conv-pub-123', 0);

    expect(mockDb.delete).toHaveBeenCalledTimes(1);
    expect(mockDb.where).toHaveBeenCalled();
  });

  // --- Test 12: truncateHistory with keepLast >= count deletes nothing ---

  it('truncateHistory() with keepLast >= message count deletes nothing', async () => {
    // Simulate 2 messages total, keepLast=5 → no deletion needed
    mockDb.orderBy
      .mockResolvedValueOnce([{ id: 2 }, { id: 1 }])  // messages to keep query
      .mockResolvedValueOnce([{ id: 2 }, { id: 1 }]); // total count query (if separate)

    await service.truncateHistory('conv-pub-123', 5);

    // delete should NOT be called because all messages fit within keepLast
    expect(mockDb.delete).not.toHaveBeenCalled();
  });

  // --- Test 13: zero AI library imports ---

  it('ChatHistoryService contains zero imports from "ai" or "@ai-sdk"', () => {
    const sourcePath = path.resolve(__dirname, 'chat-history.service.ts');
    const source = fs.readFileSync(sourcePath, 'utf-8');
    const lines = source
      .split('\n')
      .map((l) => l.trim())
      .filter((l) => l && !l.startsWith('//') && !l.startsWith('*'));
    const hasAiImport = lines.some(
      (l) => l.includes("from 'ai'") || l.includes('@ai-sdk'),
    );
    expect(hasAiImport).toBe(false);
  });

  // --- Test 14: listConversations returns conversations ordered by updatedAt desc ---

  it('listConversations() returns conversations ordered by updatedAt descending with title and publicId', async () => {
    const date1 = new Date('2026-01-01T00:00:00Z');
    const date2 = new Date('2026-01-02T00:00:00Z');
    mockDb.orderBy.mockResolvedValueOnce([
      { publicId: 'conv-2', title: 'Second', profileId: 'p2', createdAt: date2, updatedAt: date2 },
      { publicId: 'conv-1', title: 'First', profileId: 'p1', createdAt: date1, updatedAt: date1 },
    ]);

    const conversations = await service.listConversations();

    expect(conversations).toHaveLength(2);
    expect(conversations[0].publicId).toBe('conv-2');
    expect(conversations[0].title).toBe('Second');
    expect(conversations[1].publicId).toBe('conv-1');
  });

  // --- Additional coverage: getMessages handles null parts ---

  it('getMessages() sets parts to undefined when DB column is null', async () => {
    mockDb.orderBy.mockResolvedValueOnce([
      { role: 'system', content: 'sys', parts: null, inputTokens: null, outputTokens: null, createdAt: new Date() },
    ]);

    const messages = await service.getMessages('conv-pub-123');

    expect(messages[0].parts).toBeUndefined();
  });
});
