import { Inject, Injectable, Logger } from '@nestjs/common';
import { generateText } from 'ai';
import { SettingsService } from '../../settings/settings.service';
import { articles } from '../../database/schemas/article.schema';
import { DRIZZLE } from '../../database/database.module';
import { eq } from 'drizzle-orm';
import { decodePublicID, EntityType } from '../../common/utils/sqids.util';
import { ArticleAiPort } from '../ports/ai.port';
import { ModelResolver } from '../model/model-resolver.service';
import { htmlToPlainText } from './html-to-text';
import { DomainError } from '../domain-error';

@Injectable()
export class SummaryAdapter implements ArticleAiPort {
  private readonly logger = new Logger(SummaryAdapter.name);

  constructor(
    @Inject(DRIZZLE) private db: any,
    private modelResolver: ModelResolver,
    private settings: SettingsService,
  ) {}

  async summarizeArticle(publicId: string): Promise<{ summary: string }> {
    // 1. Decode public ID -> database ID
    const { dbID, entityType } = decodePublicID(publicId);
    if (entityType !== EntityType.Article) {
      throw new DomainError('无效的文章 ID');
    }

    // 2. Fetch article content from database
    const rows = await this.db
      .select({ contentHtml: articles.contentHtml, title: articles.title })
      .from(articles)
      .where(eq(articles.id, dbID))
      .limit(1);

    if (!rows?.length || !rows[0].contentHtml) {
      throw new DomainError('文章不存在或无正文内容');
    }

    const { contentHtml, title } = rows[0];

    // 3. Read AI summary system prompt from settings
    const systemPrompt =
      this.settings.get('ai_summary_system_prompt') ||
      '请用中文为以下文章生成一段200字以内的摘要，突出文章核心内容和要点。';

    // 4. Convert HTML to plain text and truncate
    const plainText = htmlToPlainText(contentHtml);
    const truncated = plainText.slice(0, 4000);

    if (!truncated.trim()) {
      throw new DomainError('文章正文为空，无法生成摘要');
    }

    // 5. Resolve the summary-specific model profile
    const summaryProfileId = this.settings.get('ai_summary_profile_id') || undefined;
    let model;
    try {
      model = this.modelResolver.resolve(summaryProfileId);
    } catch (error) {
      // ModelResolver throws DomainError for '未配置可用的 AI 模型'
      throw error instanceof DomainError
        ? error
        : new DomainError('AI 模型配置异常，请检查设置');
    }

    // 6. Call LLM via AI SDK 7 generateText
    try {
      const { text } = await generateText({
        model,
        instructions: systemPrompt, // AI SDK 7: instructions (NOT system)
        messages: [
          {
            role: 'user',
            content: `文章标题：${title}\n\n文章正文：\n${truncated}`,
          },
        ],
        temperature: 0.3,
        maxOutputTokens: 4000, // 调大：开思考模式后 reasoning 占用部分 token，需留足摘要输出空间
        timeout: { totalMs: 30000 },
      });

      if (!text) {
        throw new DomainError('AI 服务返回了空结果，请重试');
      }

      this.logger.log(
        `文章 ${publicId} AI 摘要生成成功 (${text.length} 字)`,
      );
      return { summary: text };
    } catch (error: any) {
      // Re-throw our own domain errors as-is
      if (error instanceof DomainError) {
        throw error;
      }
      // Wrap LLM errors — no API key leakage
      this.logger.error(
        `AI 摘要生成失败: ${error.message}`,
        error.stack,
      );
      throw new DomainError('AI 摘要生成失败，请稍后重试');
    }
  }
}
