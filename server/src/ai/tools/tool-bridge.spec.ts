/**
 * tool-bridge.spec.ts — unit tests for toAiSdkTools conversion.
 *
 * Verifies that framework-agnostic ToolDef[] is correctly converted
 * to AI SDK ToolSet objects with proper names, descriptions, and execute delegation.
 */
import { describe, it, expect, vi } from 'vitest';
import { z } from 'zod';
import { toAiSdkTools } from './tool-bridge';
import type { ToolDef, ToolContext } from './tool-def';
import { articleTools } from './article-tools';

function createMockContext(): ToolContext {
  return {
    db: {},
    settings: { get: vi.fn() } as any,
    getService: vi.fn(),
  };
}

describe('toAiSdkTools', () => {
  const ctx = createMockContext();

  it('returns an object with keys matching tool names for a single ToolDef', () => {
    const singleTool: ToolDef = {
      name: 'test_tool',
      description: 'A test tool',
      inputSchema: z.object({ query: z.string() }),
      execute: vi.fn().mockResolvedValue({ result: 'ok' }),
    };

    const tools = toAiSdkTools([singleTool], ctx);

    expect(Object.keys(tools)).toHaveLength(1);
    expect(tools).toHaveProperty('test_tool');
  });

  it('returns object with keys matching article tool names (search_articles, get_article)', () => {
    const tools = toAiSdkTools(articleTools, ctx);

    expect(Object.keys(tools)).toHaveLength(2);
    expect(tools).toHaveProperty('search_articles');
    expect(tools).toHaveProperty('get_article');
  });

  it('each converted tool has description matching the original ToolDef', () => {
    const mockTool: ToolDef = {
      name: 'mock_tool',
      description: 'Mock description for testing',
      inputSchema: z.object({ input: z.string() }),
      execute: vi.fn().mockResolvedValue({}),
    };

    const tools = toAiSdkTools([mockTool], ctx);

    // AI SDK tool() stores description on the tool object
    expect(tools.mock_tool.description).toBe('Mock description for testing');
  });

  it('execute on converted tool delegates to original ToolDef.execute with (input, ctx)', async () => {
    const mockExecute = vi.fn().mockResolvedValue({ data: 'result' });
    const mockTool: ToolDef = {
      name: 'delegating_tool',
      description: 'Delegates execution',
      inputSchema: z.object({ x: z.number() }),
      execute: mockExecute,
    };

    const tools = toAiSdkTools([mockTool], ctx);
    const input = { x: 42 };

    // Call the execute function on the converted tool
    const result = await tools.delegating_tool.execute(input);

    // Verify the original execute was called with (input, ctx)
    expect(mockExecute).toHaveBeenCalledTimes(1);
    expect(mockExecute).toHaveBeenCalledWith(input, ctx);
    expect(result).toEqual({ data: 'result' });
  });
});
