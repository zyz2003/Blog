/**
 * AiWritingService - AI 写作核心服务（从头写 / 续写 / 改写）。
 *
 * 复用 ModelResolver 解析模型，复用 AI SDK 的 streamText 流式输出。
 * 工具通过全局 ToolRegistry 获取（类似 MCP，按设置筛选启用）。
 *
 * SSE 格式：data: "chunk"\n\n ... data: [DONE]\n\n
 */
import { Injectable, Logger } from '@nestjs/common';
import { streamText } from 'ai';
import type { Response } from 'express';
import { ModelResolver } from '../model/model-resolver.service';
import { SettingsService } from '../../settings/settings.service';
import { ToolRegistry } from '../tools/tool-registry';
import { DomainError } from '../domain-error';

const DEFAULT_SYSTEM_PROMPT =
  '你是一个专业的博客写作助手。请用中文写作，风格清晰简洁，适合技术博客。输出的内容使用 HTML 格式（段落用 <p> 标签，代码用 <pre><code> 标签）。不要输出 ```html 代码块标记，直接输出 HTML 内容。';

@Injectable()
export class AiWritingService {
  private readonly logger = new Logger(AiWritingService.name);

  constructor(
    private readonly modelResolver: ModelResolver,
    private readonly settings: SettingsService,
    private readonly toolRegistry: ToolRegistry,
  ) {}

  private getOptions() {
    const systemPrompt =
      this.settings.get('ai_writing_system_prompt') || DEFAULT_SYSTEM_PROMPT;
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

  /** 从设置读取启用的工具 ID 列表 */
  private getEnabledToolIds(): string[] | undefined {
    const raw = this.settings.get('ai_writing_enabled_tools');
    if (!raw) return undefined;
    try {
      const ids = JSON.parse(raw);
      return Array.isArray(ids) ? ids : undefined;
    } catch {
      return undefined;
    }
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
    const model = this.modelResolver.resolve(profileId);
    const enabledTools = this.getEnabledToolIds();

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
        tools: this.toolRegistry.getTools(enabledTools),
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
