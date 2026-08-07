/**
 * AI 写作 Hook -- 增量渲染 + 撤销机制。
 *
 * 后端输出 Markdown（纯文本，切分不破坏结构）。前端每收到一个 chunk 就把
 * 累积的 Markdown 用 marked 渲染成 HTML，删除当前生成段重新插入，
 * 实现"所见即所得"：格式随生成实时出现，不会出现裸 HTML 标签。
 *
 * 三种模式：
 * - generate：从头写（在光标位置插入，块级）
 * - continue：续写（在文末追加，块级）
 * - rewrite：改写（替换选中文本；单段输出行内补回，不拆原段落）
 *
 * 撤销：流式前快照 editor.getHTML()，撤销时 setContent 恢复。
 */
"use client";

import { useState, useRef, useCallback } from "react";
import type { Editor } from "@tiptap/react";
import { marked } from "marked";
import { aiWritingApi } from "@/lib/api/ai-writing";
import { fixTaskListHtml } from "@/lib/marked-extensions";
import { addToast } from "@heroui/react";

export type AiWritingMode = "generate" | "continue" | "rewrite";

interface LastRequest {
  prompt?: string;
  content?: string;
  text?: string;
  instruction?: string;
}

/**
 * 流式期把 mermaid 代码块去语言标记，当普通代码块显示源码。
 * 避免半截 mermaid 代码触发图表渲染失败闪烁；[DONE] 时用真实 buffer 渲染成图表。
 */
function maskMermaid(buffer: string): string {
  return buffer.replace(/```mermaid\b/g, "```");
}

/**
 * 单段落 HTML 去掉 <p> 包裹，返回内联内容。
 * 用于 rewrite：单段改写结果行内补回原段落，避免把短语改写拆成独立段落。
 * 多块（多 <p> 或其他块级）原样返回。
 */
function unwrapSingleParagraph(html: string): string {
  const closeTag = "</p>";
  if (
    html.startsWith("<p>") &&
    html.endsWith(closeTag) &&
    html.indexOf(closeTag) === html.length - closeTag.length
  ) {
    return html.slice(3, -closeTag.length);
  }
  return html;
}

export function useAiWriting(editor: Editor | null) {
  const [isGenerating, setIsGenerating] = useState(false);
  const [showToolbar, setShowToolbar] = useState(false);
  const [mode, setMode] = useState<AiWritingMode>("generate");

  const snapshotRef = useRef<string>("");
  const lastRequestRef = useRef<LastRequest>({});

  // 增量渲染状态
  const bufferRef = useRef<string>("");        // 累积的 Markdown
  const startPosRef = useRef<number>(0);       // 本轮插入起点
  const endPosRef = useRef<number>(0);         // 当前已渲染段终点
  const rafRef = useRef<number | null>(null);  // rAF 句柄（合并渲染）
  const inlineRef = useRef<boolean>(false);    // rewrite 时单段去包

  /**
   * 立即把 buffer 渲染成 HTML 并替换 [start, end] 段。
   * isFinal=true 用真实 buffer（Mermaid 渲染成图表）；false 流式期 mask Mermaid
   * 成普通代码块显示源码，避免半截图表渲染失败闪烁。
   */
  const renderNow = useCallback((isFinal: boolean) => {
    if (!editor || editor.isDestroyed) return;
    const start = startPosRef.current;
    const end = endPosRef.current;
    if (start < 0 || end < start) return;
    const parseBuffer = isFinal ? bufferRef.current : maskMermaid(bufferRef.current);
    let html = fixTaskListHtml(
      marked.parse(parseBuffer, { async: false }) as string,
    );
    if (inlineRef.current) html = unwrapSingleParagraph(html);
    editor
      .chain()
      .deleteRange({ from: start, to: end })
      .insertContentAt(start, html)
      .scrollIntoView()
      .run();
    // insertContentAt(updateSelection) 把光标停在内容末尾，据此更新终点
    endPosRef.current = editor.state.selection.to;
  }, [editor]);

  /** rAF 合并：每帧最多渲染一次，避免快模型多 chunk 抖动 */
  const scheduleRender = useCallback(() => {
    if (rafRef.current != null) return;
    rafRef.current = requestAnimationFrame(() => {
      rafRef.current = null;
      renderNow(false);
    });
  }, [renderNow]);

  const cancelRaf = useCallback(() => {
    if (rafRef.current != null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
  }, []);

  /** 从头写 */
  const generate = useCallback(
    async (prompt: string) => {
      if (!editor) return;
      snapshotRef.current = editor.getHTML();
      lastRequestRef.current = { prompt };
      setMode("generate");
      inlineRef.current = false;
      setIsGenerating(true);
      setShowToolbar(false);

      cancelRaf();
      bufferRef.current = "";
      startPosRef.current = editor.state.selection.from;
      endPosRef.current = startPosRef.current;

      await aiWritingApi.generate(prompt, {
        onChunk: (chunk) => {
          bufferRef.current += chunk;
          scheduleRender();
        },
        onDone: () => {
          cancelRaf();
          renderNow(true);
          setIsGenerating(false);
          setShowToolbar(true);
        },
        onError: (err) => {
          cancelRaf();
          renderNow(false);
          setIsGenerating(false);
          addToast({ title: "AI 写作失败", description: err.message, color: "danger" });
        },
      });
    },
    [editor, cancelRaf, scheduleRender, renderNow],
  );

  /** 续写 */
  const continueWriting = useCallback(async () => {
    if (!editor) return;
    const content = editor.getHTML();
    snapshotRef.current = content;
    lastRequestRef.current = { content };
    setMode("continue");
    inlineRef.current = false;
    setIsGenerating(true);
    setShowToolbar(false);

    editor.commands.focus("end");
    cancelRaf();
    bufferRef.current = "";
    // 文末块边界：追加新段落，不会拆最后一段
    startPosRef.current = editor.state.doc.content.size;
    endPosRef.current = startPosRef.current;

    await aiWritingApi.continue(content, {
      onChunk: (chunk) => {
        bufferRef.current += chunk;
        scheduleRender();
      },
      onDone: () => {
        cancelRaf();
        renderNow(true);
        setIsGenerating(false);
        setShowToolbar(true);
      },
      onError: (err) => {
        cancelRaf();
        renderNow(false);
        setIsGenerating(false);
        addToast({ title: "AI 续写失败", description: err.message, color: "danger" });
      },
    });
  }, [editor, cancelRaf, scheduleRender, renderNow]);

  /** 改写选中文本 */
  const rewrite = useCallback(
    async (text: string, instruction: string) => {
      if (!editor || !text) return;
      snapshotRef.current = editor.getHTML();
      lastRequestRef.current = { text, instruction };
      setMode("rewrite");
      inlineRef.current = true;
      setIsGenerating(true);
      setShowToolbar(false);

      editor.commands.deleteSelection();
      cancelRaf();
      bufferRef.current = "";
      startPosRef.current = editor.state.selection.from;
      endPosRef.current = startPosRef.current;

      await aiWritingApi.rewrite(text, instruction, {
        onChunk: (chunk) => {
          bufferRef.current += chunk;
          scheduleRender();
        },
        onDone: () => {
          cancelRaf();
          renderNow(true);
          setIsGenerating(false);
          setShowToolbar(true);
        },
        onError: (err) => {
          cancelRaf();
          renderNow(false);
          setIsGenerating(false);
          addToast({ title: "AI 改写失败", description: err.message, color: "danger" });
        },
      });
    },
    [editor, cancelRaf, scheduleRender, renderNow],
  );

  /** 接受 AI 生成的内容 */
  const accept = useCallback(() => {
    cancelRaf();
    setShowToolbar(false);
  }, [cancelRaf]);

  /** 撤销 AI 生成的内容 */
  const undo = useCallback(() => {
    if (!editor) return;
    cancelRaf();
    editor.commands.setContent(snapshotRef.current);
    setShowToolbar(false);
  }, [editor, cancelRaf]);

  /** 重新生成 */
  const regenerate = useCallback(async () => {
    if (!editor) return;
    cancelRaf();
    editor.commands.setContent(snapshotRef.current);
    setShowToolbar(false);

    const { prompt, content, text, instruction } = lastRequestRef.current;
    if (prompt) await generate(prompt);
    else if (content) await continueWriting();
    else if (text && instruction) await rewrite(text, instruction);
  }, [editor, cancelRaf, generate, continueWriting, rewrite]);

  /** 获取选中的文本（用于判断是否可改写） */
  const getSelectedText = useCallback((): string => {
    if (!editor) return "";
    const { from, to } = editor.state.selection;
    if (from === to) return "";
    return editor.state.doc.textBetween(from, to, " ");
  }, [editor]);

  return {
    isGenerating,
    showToolbar,
    mode,
    generate,
    continueWriting,
    rewrite,
    accept,
    undo,
    regenerate,
    getSelectedText,
  };
}
