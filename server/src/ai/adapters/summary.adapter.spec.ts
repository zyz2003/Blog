import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Test } from '@nestjs/testing';
import { SummaryAdapter } from './summary.adapter';
import { ModelResolver } from '../model/model-resolver.service';
import { SettingsService } from '../../settings/settings.service';

// Mock sqids.util at module level so decodePublicID doesn't need real encoder
vi.mock('../../common/utils/sqids.util', () => ({
  decodePublicID: vi.fn().mockReturnValue({ dbID: 1, entityType: 8 }),
  EntityType: { Article: 8, File: 2 },
}));

// Mock the AI SDK generateText function
vi.mock('ai', () => ({
  generateText: vi.fn(),
}));

import { generateText } from 'ai';
import { decodePublicID, EntityType } from '../../common/utils/sqids.util';

const mockGenerateText = vi.mocked(generateText);
const mockDecodePublicID = vi.mocked(decodePublicID);

describe('SummaryAdapter', () => {
  let adapter: SummaryAdapter;
  let mockDb: any;
  let mockSettings: any;
  let mockModelResolver: any;

  beforeEach(async () => {
    vi.clearAllMocks();

    // Reset decodePublicID to default mock
    mockDecodePublicID.mockReturnValue({ dbID: 1, entityType: EntityType.Article });

    // Mock database that returns an article
    mockDb = {
      select: vi.fn().mockReturnThis(),
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue([
        {
          contentHtml: '<p>Hello world</p>',
          title: 'Test Article',
        },
      ]),
    };

    // Mock settings
    mockSettings = {
      get: vi.fn((key: string) => {
        const map: Record<string, string | undefined> = {
          ai_summary_system_prompt: '请生成摘要',
          ai_summary_profile_id: undefined,
        };
        return map[key];
      }),
    };

    // Mock ModelResolver
    const mockModel = { modelId: 'test-model' };
    mockModelResolver = {
      resolve: vi.fn().mockReturnValue(mockModel),
    };

    // Mock generateText to return a summary
    mockGenerateText.mockResolvedValue({ text: '这是一段摘要' });

    const module = await Test.createTestingModule({
      providers: [
        SummaryAdapter,
        { provide: 'DRIZZLE', useValue: mockDb },
        { provide: ModelResolver, useValue: mockModelResolver },
        { provide: SettingsService, useValue: mockSettings },
      ],
    }).compile();

    adapter = module.get(SummaryAdapter);
  });

  describe('summarizeArticle', () => {
    it('calls generateText with instructions (not system) and maxOutputTokens', async () => {
      const result = await adapter.summarizeArticle('abcd1234');

      // Verify generateText was called with AI SDK 7 parameters
      expect(mockGenerateText).toHaveBeenCalledTimes(1);
      const callArgs = mockGenerateText.mock.calls[0][0] as any;
      expect(callArgs).toHaveProperty('instructions');
      expect(callArgs).not.toHaveProperty('system');
      expect(callArgs).toHaveProperty('maxOutputTokens');
      expect(callArgs).not.toHaveProperty('maxTokens');
      expect(callArgs.maxOutputTokens).toBe(500);
      expect(callArgs.instructions).toBe('请生成摘要');
      expect(callArgs.temperature).toBe(0.3);
      expect(callArgs.timeout).toEqual({ totalMs: 30000 });

      // Verify result
      expect(result).toEqual({ summary: '这是一段摘要' });
    });

    it('throws "文章不存在或无正文内容" for missing article', async () => {
      // Mock DB returning no rows
      mockDb.limit.mockResolvedValueOnce([]);

      await expect(adapter.summarizeArticle('abcd1234')).rejects.toThrow(
        '文章不存在或无正文内容',
      );
    });

    it('throws "文章不存在或无正文内容" for article with empty contentHtml', async () => {
      mockDb.limit.mockResolvedValueOnce([{ contentHtml: null, title: 'Test' }]);

      await expect(adapter.summarizeArticle('abcd1234')).rejects.toThrow(
        '文章不存在或无正文内容',
      );
    });

    it('throws "无效的文章 ID" for non-article entity type', async () => {
      mockDecodePublicID.mockReturnValueOnce({ dbID: 1, entityType: EntityType.File });

      await expect(adapter.summarizeArticle('abcd1234')).rejects.toThrow(
        '无效的文章 ID',
      );
    });

    it('throws "AI 服务返回了空结果" when generateText returns empty text', async () => {
      mockGenerateText.mockResolvedValueOnce({ text: '' });

      await expect(adapter.summarizeArticle('abcd1234')).rejects.toThrow(
        'AI 服务返回了空结果，请重试',
      );
    });

    it('throws "AI 服务返回了空结果" when generateText returns undefined text', async () => {
      mockGenerateText.mockResolvedValueOnce({ text: undefined });

      await expect(adapter.summarizeArticle('abcd1234')).rejects.toThrow(
        'AI 服务返回了空结果，请重试',
      );
    });

    it('wraps LLM errors with generic message (no API key leakage)', async () => {
      mockGenerateText.mockRejectedValueOnce(new Error('API key sk-abc123 is invalid'));

      await expect(adapter.summarizeArticle('abcd1234')).rejects.toThrow(
        'AI 摘要生成失败，请稍后重试',
      );
    });

    it('uses default system prompt when ai_summary_system_prompt is not set', async () => {
      mockSettings.get = vi.fn((key: string) => {
        const map: Record<string, string | undefined> = {
          ai_summary_system_prompt: undefined,
          ai_summary_profile_id: undefined,
        };
        return map[key];
      });

      await adapter.summarizeArticle('abcd1234');

      const callArgs = mockGenerateText.mock.calls[0][0] as any;
      expect(callArgs.instructions).toContain('请用中文为以下文章生成一段200字以内的摘要');
    });

    it('passes ai_summary_profile_id to ModelResolver.resolve', async () => {
      mockSettings.get = vi.fn((key: string) => {
        const map: Record<string, string | undefined> = {
          ai_summary_system_prompt: '请生成摘要',
          ai_summary_profile_id: 'profile-42',
        };
        return map[key];
      });

      await adapter.summarizeArticle('abcd1234');

      expect(mockModelResolver.resolve).toHaveBeenCalledWith('profile-42');
    });

    it('passes undefined to ModelResolver.resolve when ai_summary_profile_id is empty', async () => {
      mockSettings.get = vi.fn((key: string) => {
        const map: Record<string, string | undefined> = {
          ai_summary_system_prompt: '请生成摘要',
          ai_summary_profile_id: '',
        };
        return map[key];
      });

      await adapter.summarizeArticle('abcd1234');

      expect(mockModelResolver.resolve).toHaveBeenCalledWith(undefined);
    });

    it('throws "文章正文为空" when htmlToPlainText produces empty output', async () => {
      // Article with only script/style tags — htmlToPlainText returns empty
      mockDb.limit.mockResolvedValueOnce([
        { contentHtml: '<script>var x=1;</script>', title: 'Test' },
      ]);

      await expect(adapter.summarizeArticle('abcd1234')).rejects.toThrow(
        '文章正文为空，无法生成摘要',
      );
    });
  });
});
