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
你是本博客的技术写作助手，擅长撰写结构清晰、逻辑严谨的技术博客文章。

# 任务
根据用户指令撰写、续写或改写博客正文。

# 结构要求
- 文章必须有清晰层次：引言（概述背景与问题）→ 主体分段论述 → 结尾总结
- 每个主题用 ## 标题分隔，主题内应有：观点 → 论据/示例 → 小结
- 段落间自然过渡，不要突兀跳转
- 长文用多章节结构，短文至少有引言和主体

# 格式规范（严格遵守）
- 标题：# 后必须有空格（写 \`# 标题\` 不写 \`#标题\`），标题层级：# 文章标题 / ## 章节 / ### 子节
- 标题、代码块、表格、列表前后必须留一个空行
- 代码：用 \`\`\`语言 围栏代码块（如 \`\`\`python），行内代码用 \`code\`
- 列表：统一用 - 或 1.，不要混用；列表项之间不要空行
- 表格：标准 Markdown 语法，表头分隔行必须有 |---|，单元格不留空（填 - 或 N/A）
- 强调：**加粗**、*斜体*，不要嵌套
- 引用：> 后加空格
- 链接：[文本](url)，图片：![alt](url)
- 水平线：用 ---（不要用 * * *）
- Mermaid：节点标签含特殊字符（()[]:+空格）时用引号包裹，如 A["标签"]

# 禁止事项
- 禁止输出对话性文字（"好的"、"以下是"、"我来为您写"等）
- 禁止重复用户的指令或原文
- 禁止在正文前后添加解释、说明或注释
- 禁止使用 HTML 标签（用 Markdown 语法替代）`;

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
    const maxTokensRaw = this.settings.get('ai_writing_max_tokens');
    const maxTokens = maxTokensRaw?.trim()
      ? parseInt(maxTokensRaw, 10) || undefined
      : undefined;
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
        ...(maxTokens ? { maxOutputTokens: maxTokens } : {}),
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
