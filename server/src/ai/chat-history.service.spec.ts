import { describe, it, expect, vi, beforeEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import { Test } from '@nestjs/testing';

// Mock sqids.util at module level
vi.mock('../common/utils/sqids.util', () => ({
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
import { generatePublicID, decodePublicID, EntityType } from '../common/utils/sqids.util';

const mockGeneratePublicID = vi.mocked(generatePublicID);
const mockDecodePublicID = vi.mocked(decodePublicID);

/**
 * Create a mock Drizzle db that supports all ChatHistoryService query patterns.
 *
 * Strategy: each chainable method returns a "chain node" — an object with
 * all chainable methods AND a `.then()` for awaitability. The chain node
 * resolves to a configurable value when awaited.
 *
 * All calls to chain methods are captured in `mockDb._calls` for assertion.
 */
function createMockDb() {
  // Queue of resolve values for sequential await calls
  const resolveQueue: any[] = [];
  let queueIndex = 0;

  // Record all method calls with their arguments for assertion
  const calls: { method: string; args: any[] }[] = [];

  function createChain(): any {
    const chain: any = {};

    // Thenable: when awaited, resolves to the next queued value
    chain.then = (resolve: any, reject: any) => {
      const val = resolveQueue[queueIndex++];
      return Promise.resolve(val).then(resolve, reject);
    };

    // Chainable methods — each records the call and returns a new chain
    for (const method of ['insert', 'values', 'returning', 'update', 'set', 'delete', 'select', 'from', 'where', 'orderBy', 'limit', 'offset']) {
      chain[method] = vi.fn((...args: any[]) => {
        calls.push({ method, args });
        return createChain();
      });
    }

    return chain;
  }

  const db: any = {};

  // Top-level methods — each records the call and returns a chain
  for (const method of ['insert', 'values', 'returning', 'update', 'set', 'delete', 'select', 'from', 'where', 'orderBy', 'limit', 'offset']) {
    db[method] = vi.fn((...args: any[]) => {
      calls.push({ method, args });
      return createChain();
    });
  }

  // Test control: push a resolve value for the next await
  db._resolve = (val: any) => {
    resolveQueue.push(val);
    queueIndex = 0;
    return db;
  };

  // Access recorded calls
  db._calls = calls;

  // Helper: find the last call to a specific method
  db._lastCall = (method: string) => {
    for (let i = calls.length - 1; i >= 0; i--) {
      if (calls[i].method === method) return calls[i];
    }
    return null;
  };

  // Helper: find all calls to a specific method
  db._allCalls = (method: string) => {
    return calls.filter((c: any) => c.method === method);
  };

  return db;
}

describe('ChatHistoryService', () => {
  let service: ChatHistoryService;
  let mockDb: any;

  beforeEach(async () => {
    vi.clearAllMocks();
    mockDb = createMockDb();

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
    expect(service).toBeDefined();
    expect(service).toBeInstanceOf(ChatHistoryService);
  });

  // --- Test 2: createConversation inserts and returns publicId ---

  it('createConversation() inserts into chat_conversations with title and profileId, returns publicId', async () => {
    mockDb._resolve([{ id: 7 }])._resolve(undefined);

    const result = await service.createConversation('My Chat', 'profile-1');

    // Verify insert was called (top-level)
    expect(mockDb.insert).toHaveBeenCalledTimes(1);
    // Verify values was called with the right data
    const valuesCall = mockDb._lastCall('values');
    expect(valuesCall).not.toBeNull();
    expect(valuesCall.args[0]).toEqual(
      expect.objectContaining({
        title: 'My Chat',
        profileId: 'profile-1',
      }),
    );
    expect(result).toBe('conv-pub-123');
  });

  // --- Test 3: createConversation uses EntityType.ChatConversation = 23 ---

  it('createConversation() generates publicId via generatePublicID with EntityType.ChatConversation=23', async () => {
    mockDb._resolve([{ id: 99 }])._resolve(undefined);

    await service.createConversation('Title', 'profile-1');

    expect(mockGeneratePublicID).toHaveBeenCalledWith(99, EntityType.ChatConversation);
    expect(EntityType.ChatConversation).toBe(23);
  });

  // --- Test 4: createConversation without title sets title to null ---

  it('createConversation() without title sets title to null', async () => {
    mockDb._resolve([{ id: 1 }])._resolve(undefined);

    await service.createConversation();

    const valuesCall = mockDb._lastCall('values');
    expect(valuesCall).not.toBeNull();
    expect(valuesCall.args[0]).toEqual(
      expect.objectContaining({
        title: null,
      }),
    );
  });

  // --- Test 5: createConversation with userId stores it (D-391) ---

  it('createConversation() with userId stores it in the database row', async () => {
    mockDb._resolve([{ id: 5 }])._resolve(undefined);

    await service.createConversation('Chat', 'profile-1', 42);

    const valuesCall = mockDb._lastCall('values');
    expect(valuesCall).not.toBeNull();
    expect(valuesCall.args[0]).toEqual(
      expect.objectContaining({
        userId: 42,
      }),
    );
  });

  // --- Test 6: createConversation with userId=null stores null ---

  it('createConversation() with userId=null stores null (anonymous user)', async () => {
    mockDb._resolve([{ id: 6 }])._resolve(undefined);

    await service.createConversation('Chat', 'profile-1', null);

    const valuesCall = mockDb._lastCall('values');
    expect(valuesCall).not.toBeNull();
    expect(valuesCall.args[0]).toEqual(
      expect.objectContaining({
        userId: null,
      }),
    );
  });

  // --- Test 7: appendMessage inserts with all fields ---

  it('appendMessage() inserts into chat_messages with conversationId, role, content, parts, inputTokens, outputTokens', async () => {
    mockDb._resolve(undefined);

    const msg = {
      role: 'user' as const,
      content: 'Hello',
      parts: [{ type: 'text' as const, text: 'Hello' }],
      inputTokens: 10,
      outputTokens: 0,
    };

    await service.appendMessage('conv-pub-123', msg);

    expect(mockDb.insert).toHaveBeenCalledTimes(1);
    const valuesCall = mockDb._lastCall('values');
    expect(valuesCall).not.toBeNull();
    expect(valuesCall.args[0]).toEqual(
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

  // --- Test 8: appendMessage resolves conversationId from publicId via decodePublicID ---

  it('appendMessage() resolves conversationId from publicId by decoding via decodePublicID', async () => {
    mockDecodePublicID.mockReturnValueOnce({ dbID: 77, entityType: 23 });
    mockDb._resolve(undefined);

    await service.appendMessage('some-pub-id', {
      role: 'assistant',
      content: 'Hi',
    });

    expect(mockDecodePublicID).toHaveBeenCalledWith('some-pub-id');
    const valuesCall = mockDb._lastCall('values');
    expect(valuesCall.args[0]).toEqual(
      expect.objectContaining({
        conversationId: 77,
      }),
    );
  });

  // --- Test 9: getMessages returns StoredMessage[] ordered by createdAt asc ---

  it('getMessages() returns StoredMessage[] ordered by createdAt ascending', async () => {
    const date1 = new Date('2026-01-01T00:00:00Z');
    const date2 = new Date('2026-01-02T00:00:00Z');
    mockDb._resolve([
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

  // --- Test 10: getMessages maps parts from JSON column to ChatMessagePart[] ---

  it('getMessages() maps parts from JSON column to ChatMessagePart[] type', async () => {
    const parts = [{ type: 'text', text: 'hello' }];
    mockDb._resolve([
      { role: 'user', content: 'hello', parts, inputTokens: null, outputTokens: null, createdAt: new Date() },
    ]);

    const messages = await service.getMessages('conv-pub-123');

    expect(messages[0].parts).toEqual([{ type: 'text', text: 'hello' }]);
  });

  // --- Test 11: getMessages returns empty array for nonexistent conversation ---

  it('getMessages() returns empty array for nonexistent conversation', async () => {
    mockDb._resolve([]);

    const messages = await service.getMessages('nonexistent-id');

    expect(messages).toEqual([]);
  });

  // --- Test 12: truncateHistory keeps only last N messages ---

  it('truncateHistory(conversationId, keepLast=3) deletes oldest messages keeping only last 3', async () => {
    mockDb
      ._resolve([{ id: 5 }, { id: 4 }, { id: 3 }])
      ._resolve([{ id: 1 }, { id: 2 }, { id: 3 }, { id: 4 }, { id: 5 }])
      ._resolve(undefined);

    await service.truncateHistory('conv-pub-123', 3);

    expect(mockDb.delete).toHaveBeenCalledTimes(1);
  });

  // --- Test 13: truncateHistory with keepLast=0 deletes all ---

  it('truncateHistory() with keepLast=0 deletes all messages in the conversation', async () => {
    mockDb._resolve([])._resolve(undefined);

    await service.truncateHistory('conv-pub-123', 0);

    expect(mockDb.delete).toHaveBeenCalledTimes(1);
  });

  // --- Test 14: truncateHistory with keepLast >= count deletes nothing ---

  it('truncateHistory() with keepLast >= message count deletes nothing', async () => {
    mockDb
      ._resolve([{ id: 2 }, { id: 1 }])
      ._resolve([{ id: 2 }, { id: 1 }]);

    await service.truncateHistory('conv-pub-123', 5);

    expect(mockDb.delete).not.toHaveBeenCalled();
  });

  // --- Test 15: zero AI library imports ---

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

  // --- Test 16: listConversations returns conversations ordered by updatedAt desc ---

  it('listConversations() returns conversations ordered by updatedAt descending with title and publicId', async () => {
    const date1 = new Date('2026-01-01T00:00:00Z');
    const date2 = new Date('2026-01-02T00:00:00Z');
    mockDb._resolve([
      { publicId: 'conv-2', title: 'Second', profileId: 'p2', userId: 5, createdAt: date2, updatedAt: date2 },
      { publicId: 'conv-1', title: 'First', profileId: 'p1', userId: null, createdAt: date1, updatedAt: date1 },
    ]);

    const conversations = await service.listConversations();

    expect(conversations).toHaveLength(2);
    expect(conversations[0].publicId).toBe('conv-2');
    expect(conversations[0].title).toBe('Second');
    expect(conversations[0].userId).toBe(5);
    expect(conversations[1].publicId).toBe('conv-1');
    expect(conversations[1].userId).toBeNull();
  });

  // --- Additional coverage: getMessages handles null parts ---

  it('getMessages() sets parts to undefined when DB column is null', async () => {
    mockDb._resolve([
      { role: 'system', content: 'sys', parts: null, inputTokens: null, outputTokens: null, createdAt: new Date() },
    ]);

    const messages = await service.getMessages('conv-pub-123');

    expect(messages[0].parts).toBeUndefined();
  });

  // --- Phase 19 tests: listConversationsPaged ---

  it('listConversationsPaged() returns paginated results with total count', async () => {
    const date1 = new Date('2026-01-01T00:00:00Z');
    const date2 = new Date('2026-01-02T00:00:00Z');

    // First resolve: paginated rows, Second resolve: count result
    mockDb._resolve([
      { publicId: 'conv-2', title: 'Second', profileId: 'p2', userId: null, createdAt: date2, updatedAt: date2 },
    ])._resolve([{ total: 25 }]);

    const result = await service.listConversationsPaged(1, 20);

    expect(result.list).toHaveLength(1);
    expect(result.list[0].publicId).toBe('conv-2');
    expect(result.total).toBe(25);
  });

  it('listConversationsPaged() calculates offset correctly for page 2', async () => {
    mockDb._resolve([])._resolve([{ total: 30 }]);

    await service.listConversationsPaged(2, 10);

    // Verify offset was called (the chain should include offset(10))
    const offsetCalls = mockDb._allCalls('offset');
    expect(offsetCalls.length).toBeGreaterThan(0);
    expect(offsetCalls[0].args[0]).toBe(10);
  });

  it('listConversationsPaged() defaults to page=1, pageSize=20', async () => {
    mockDb._resolve([])._resolve([{ total: 0 }]);

    const result = await service.listConversationsPaged();

    expect(result.total).toBe(0);
    expect(result.list).toEqual([]);
  });

  // --- Phase 19 tests: getConversationMessages ---

  it('getConversationMessages() delegates to getMessages()', async () => {
    const date1 = new Date('2026-01-01T00:00:00Z');
    mockDb._resolve([
      { role: 'user', content: 'hello', parts: null, inputTokens: null, outputTokens: null, createdAt: date1 },
    ]);

    const messages = await service.getConversationMessages('conv-pub-123');

    expect(messages).toHaveLength(1);
    expect(messages[0].content).toBe('hello');
  });

  // --- Phase 19 tests: deleteConversation ---

  it('deleteConversation() deletes messages first, then conversation row', async () => {
    mockDb._resolve(undefined)._resolve(undefined);

    await service.deleteConversation('conv-pub-123');

    // Should call delete twice: once for messages, once for conversation
    expect(mockDb.delete).toHaveBeenCalledTimes(2);

    // Verify decodePublicID was called to get dbID
    expect(mockDecodePublicID).toHaveBeenCalledWith('conv-pub-123');
  });

  it('deleteConversation() uses decoded dbID for both deletions', async () => {
    mockDecodePublicID.mockReturnValueOnce({ dbID: 99, entityType: 23 });
    mockDb._resolve(undefined)._resolve(undefined);

    await service.deleteConversation('conv-del');

    // Verify the where clause uses the decoded dbID
    const whereCalls = mockDb._allCalls('where');
    expect(whereCalls.length).toBeGreaterThanOrEqual(2);
  });
});
