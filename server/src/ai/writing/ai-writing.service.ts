/**
 * AiWritingService - AI 写作核心服务（从头写 / 续写 / 改写）。
 *
 * 复用 ModelResolver 解析模型，复用 AI SDK 的 streamText 流式输出。
 * 工具通过全局 ToolRegistry 获取（类似 MCP，按设置筛选启用）。
 *
 * SSE 格式：data: "chunk"\n\n ... data: [DONE]\n\n
 */
import { Injectable, Logger, Inject } from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import { streamText } from 'ai';
import type { Response } from 'express';
import { ModelResolver } from '../model/model-resolver.service';
import { SettingsService } from '../../settings/settings.service';
import { DRIZZLE } from '../../database/database.module';
import {
  ToolRegistry,
  resolveEnabledToolIds,
} from '../tools/tool-registry';
import type { ToolContext, ServiceIdentifier } from '../tools/tool-def';
import { DomainError } from '../domain-error';
import { resolveEnabledBlockIds, buildBlockSyntaxGuide } from './block-registry';

const DEFAULT_SYSTEM_PROMPT = `# 角色
你是本博客的 AI 写作助手，擅长撰写技术博客文章。

# 任务
根据用户指令撰写、续写或改写博客正文。

# 输出格式
- 直接输出 Markdown 正文，不要输出任何说明性文字、前后缀或解释
- 标题用 #，代码用 \`\`\`语言 围栏代码块，行内代码用 \`code\`
- 强调用 **加粗** 或 *斜体*，列表用 - 或 1.，引用用 >，链接用 [文本](url)，图片用 ![alt](url)

# 约束
- 用中文写作，风格清晰简洁，适合技术博客
- 只输出正文内容，不要重复用户的指令或原文`;

@Injectable()
export class AiWritingService {
  private readonly logger = new Logger(AiWritingService.name);
  private readonly toolCtx: ToolContext;

  constructor(
    private readonly modelResolver: ModelResolver,
    private readonly settings: SettingsService,
    private readonly toolRegistry: ToolRegistry,
    @Inject(DRIZZLE) private db: unknown,
    private moduleRef: ModuleRef,
  ) {
    this.toolCtx = {
      db: this.db,
      settings: this.settings,
      getService: <T>(token: ServiceIdentifier) =>
        this.moduleRef.get<T>(token as any, { strict: false }),
    };
  }

  private getOptions() {
    const basePrompt =
      this.settings.get('ai_writing_system_prompt') || DEFAULT_SYSTEM_PROMPT;
    // 追加启用的自定义块语法指南（教 AI 使用提示框/折叠/Mermaid 等）
    const enabledBlockIds = resolveEnabledBlockIds(
      this.settings.get('ai_writing_enabled_blocks'),
    );
    const blockGuide = buildBlockSyntaxGuide(enabledBlockIds);
    const systemPrompt = blockGuide
      ? `${basePrompt}\n\n${blockGuide}`
      : basePrompt;
    const maxTokens = parseInt(
      this.settings.get('ai_writing_max_tokens') || '2000',
      10,
    );
    const temperature = parseFloat(
      this.settings.get('ai_writing_temperature') || '0.7',
    );
    const profileId = this.settings.get('ai_writing_profile_id') || undefined;
    return { systemPrompt, maxTokens, temperature, profileId };
  }

  /**
   * 将 streamText 的 textStream 以 SSE 格式写入 HTTP response。
   */
  private async streamToResponse(
    res: Response,
    systemPrompt: string,
    userPrompt: string,
    maxTokens: number,
    temperature: number,
    profileId?: string,
  ): Promise<void> {
    const model = this.modelResolver.resolve(profileId, 'writing');
    // 写作：空 = 不用工具（默认关闭）；显式 '[ids]' 才启用
    const enabledToolIds = resolveEnabledToolIds(
      this.settings.get('ai_writing_enabled_tools'),
      this.toolRegistry.listToolIds(),
      false,
    );

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');

    try {
      const result = streamText({
        model,
        system: systemPrompt,
        prompt: userPrompt,
        maxOutputTokens: maxTokens,
        temperature,
        tools: this.toolRegistry.getTools(enabledToolIds, this.toolCtx),
      });

      for await (const chunk of result.textStream) {
        res.write(`data: ${JSON.stringify(chunk)}\n\n`);
      }
      res.write('data: [DONE]\n\n');
      res.end();
    } catch (error) {
      this.logger.error('AI writing stream error', error);
      if (!res.headersSent) {
        res
          .status(500)
          .json({ code: 500, message: 'AI 写作失败', data: null });
      } else {
        res.end();
      }
    }
  }

  /** 从头写：根据用户提示词生成文章 */
  async generate(prompt: string, res: Response): Promise<void> {
    const { systemPrompt, maxTokens, temperature, profileId } = this.getOptions();
    await this.streamToResponse(
      res,
      systemPrompt,
      `请根据以下要求写一篇文章：\n\n${prompt}`,
      maxTokens,
      temperature,
      profileId,
    );
  }

  /** 续写：根据当前内容续写 */
  async continue(content: string, res: Response): Promise<void> {
    const { systemPrompt, maxTokens, temperature, profileId } = this.getOptions();
    await this.streamToResponse(
      res,
      systemPrompt,
      `请续写以下内容，保持风格和语气一致，自然衔接。只输出续写的内容，不要重复已有内容：\n\n${content}`,
      maxTokens,
      temperature,
      profileId,
    );
  }

  /** 改写：根据指令改写选中文本 */
  async rewrite(
    text: string,
    instruction: string,
    res: Response,
  ): Promise<void> {
    const { systemPrompt, maxTokens, temperature, profileId } = this.getOptions();
    await this.streamToResponse(
      res,
      systemPrompt,
      `请根据以下指令改写文本，只输出改写后的结果，不要输出其他内容：\n\n指令：${instruction}\n\n原文：${text}`,
      maxTokens,
      temperature,
      profileId,
    );
  }
}
