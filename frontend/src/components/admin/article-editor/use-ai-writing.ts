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

/**
 * 修正 marked 输出中 ProseMirror 不接受的内容：
 * - 空 <td></td>/<th></th> -> 填 <p></p>（tableCell/tableHeader 要求至少一个块子节点）
 * - 空 <li></li> -> 填 <p></p>（listItem 要求至少一个块子节点）
 */
function sanitizeForProseMirror(html: string): string {
  return html
    .replace(/<(td|th)>\s*<\/\1>/g, "<$1><p></p></$1>")
    .replace(/<li>\s*<\/li>/g, "<li><p></p></li>");
}

/**
 * Markdown 格式清洗（程序约束层）：在 marked.parse 之前修复 AI 输出的格式问题。
 * 重心在格式正确性，确保渲染到 TipTap 不出错、不丢内容。
 *
 * 格式修复（按优先级）：
 * 1. 标题 # 后无空格 -> 补空格（#Title -> # Title）
 * 2. 水平线统一为 ---（* * * / ___ 等变体归一）
 * 3. 块级元素前后补空行（标题/代码围栏/表格/列表 前后缺空行时补）
 * 4. 未闭合代码围栏 -> 补闭合 ```
 * 5. Mermaid 节点标签特殊字符 -> 自动加引号
 * 6. （次要）剥离 AI 寒暄前缀
 */
function sanitizeMarkdown(md: string): string {
  // 1. 标题 # 后无空格 -> 补空格
  md = md.replace(/^(#{1,6})([^\s#])/gm, "$1 $2");

  // 2. 水平线变体统一为 ---
  md = md.replace(/^\s*(\*\s*){3,}$|^\s*(_\s*){3,}$/gm, "---");

  // 3. 块级元素前后补空行（标题行前缺空行时补）
  md = md.replace(/([^\n])\n(#{1,6}\s)/g, "$1\n\n$2");
  // 代码围栏前缺空行
  md = md.replace(/([^\n])\n(```)/g, "$1\n\n$2");
  // 表格行前缺空行（| 开头的行前面是非空行且非表格行）
  md = md.replace(/([^\n|])\n(\|[^\n]+)/g, "$1\n\n$2");

  // 4. 未闭合代码围栏 -> 补闭合
  const fenceCount = (md.match(/```/g) || []).length;
  if (fenceCount % 2 !== 0) md += "\n```";

  // 5. Mermaid 节点标签自动加引号（含 ()/: 特殊字符的 [标签] -> ["标签"]）
  md = md.replace(/(```mermaid\n)([\s\S]*?)(```)/g, (_m, open, code, close) => {
    const fixed = code.replace(
      /([A-Za-z]\w*)\[([^\]"]+[():][^\]"]*)\]/g,
      (m2: string, node: string, label: string) =>
        label.startsWith('"') ? m2 : `${node}["${label}"]`,
    );
    return open + fixed + close;
  });

  // 6. （次要）剥离 AI 寒暄前缀
  md = md.replace(
    /^(好的[，,]?|以下是|当然[，,]?|我来|下面|这是一篇?|没问题[，,]?)[^\n]*\n+/i,
    "",
  );

  return md;
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
  const timerRef = useRef<number | null>(null);  // 节流定时器
  const lastRenderRef = useRef<number>(0);     // 上次渲染时间戳
  const inlineRef = useRef<boolean>(false);    // rewrite 时单段去包

  /**
   * 立即把 buffer 渲染成 HTML 并替换 [start, end] 段。
   * 始终用真实 buffer（不 mask mermaid：mask 会把 ```mermaid 改成无语言围栏，
   * 导致 enhanced-code-block 默认 "plaintext" 语言，其 renderHTML 的 div.code-lang
   * 泄漏进 turndown 产生 PLAINTEXT 文本污染）。
   * mermaid 流式中途可能短暂显示"渲染失败"，最终渲染时弹出图表（可接受的折中）。
   */
  const renderNow = useCallback((isFinal: boolean) => {
    if (!editor || editor.isDestroyed) return;
    const start = startPosRef.current;
    const end = endPosRef.current;
    if (start < 0 || end < start) return;
    try {
      // 程序约束层：sanitizeMarkdown 修复 AI 输出的常见问题
      const sanitized = sanitizeMarkdown(bufferRef.current);
      let html = fixTaskListHtml(
        marked.parse(sanitized, { async: false }) as string,
      );
      html = sanitizeForProseMirror(html);
      if (inlineRef.current) html = unwrapSingleParagraph(html);
      const chain = editor
        .chain()
        .deleteRange({ from: start, to: end })
        .insertContentAt(start, html);
      // 中间帧跳过 scrollIntoView（省 5-10ms），只在最终渲染时滚动
      if (isFinal) chain.scrollIntoView();
      const ok = chain.run();
      // 只有链成功才更新终点（失败时保持旧位置，下个 chunk 重试）
      if (ok) {
        endPosRef.current = editor.state.selection.to;
      }
    } catch (err) {
      console.warn("AI writing render skipped:", err);
    }
  }, [editor]);

  /**
   * 时间节流渲染（80ms）。
   *
   * 关键：不能用 rAF/setTimeout（macrotask）调度渲染 -- reader.read() 的 while
   * 循环不断产生 microtask，macrotask 永远插不进来 -> 渲染积压到流结束才执行
   * -> "突然出现"。改为在 onChunk 里同步检查时间，够 80ms 就立即渲染（阻塞
   * reader 循环，但只阻塞 ~10-30ms，剩余 50ms 给浏览器.repaint）。
   * 另设 fallback timer：模型暂停时（microtask 排空）补一次渲染。
   */
  const scheduleRender = useCallback(() => {
    const now = Date.now();
    if (now - lastRenderRef.current >= 80) {
      // 距上次渲染 >= 80ms，立即同步渲染
      lastRenderRef.current = now;
      renderNow(false);
    } else if (timerRef.current == null) {
      // 不够 80ms，设一个 fallback timer（模型暂停时触发）
      timerRef.current = window.setTimeout(() => {
        timerRef.current = null;
        lastRenderRef.current = Date.now();
        renderNow(false);
      }, 80);
    }
  }, [renderNow]);

  const cancelTimer = useCallback(() => {
    if (timerRef.current != null) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
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

      cancelTimer();
      bufferRef.current = "";
      startPosRef.current = editor.state.selection.from;
      endPosRef.current = startPosRef.current;

      await aiWritingApi.generate(prompt, {
        onChunk: (chunk) => {
          bufferRef.current += chunk;
          scheduleRender();
        },
        onDone: () => {
          cancelTimer();
          renderNow(true);
          setIsGenerating(false);
          setShowToolbar(true);
        },
        onError: (err) => {
          cancelTimer();
          renderNow(false);
          setIsGenerating(false);
          addToast({ title: "AI 写作失败", description: err.message, color: "danger" });
        },
      });
    },
    [editor, cancelTimer, scheduleRender, renderNow],
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
    cancelTimer();
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
        cancelTimer();
        renderNow(true);
        setIsGenerating(false);
        setShowToolbar(true);
      },
      onError: (err) => {
        cancelTimer();
        renderNow(false);
        setIsGenerating(false);
        addToast({ title: "AI 续写失败", description: err.message, color: "danger" });
      },
    });
  }, [editor, cancelTimer, scheduleRender, renderNow]);

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
      cancelTimer();
      bufferRef.current = "";
      startPosRef.current = editor.state.selection.from;
      endPosRef.current = startPosRef.current;

      await aiWritingApi.rewrite(text, instruction, {
        onChunk: (chunk) => {
          bufferRef.current += chunk;
          scheduleRender();
        },
        onDone: () => {
          cancelTimer();
          renderNow(true);
          setIsGenerating(false);
          setShowToolbar(true);
        },
        onError: (err) => {
          cancelTimer();
          renderNow(false);
          setIsGenerating(false);
          addToast({ title: "AI 改写失败", description: err.message, color: "danger" });
        },
      });
    },
    [editor, cancelTimer, scheduleRender, renderNow],
  );

  /** 接受 AI 生成的内容 */
  const accept = useCallback(() => {
    cancelTimer();
    setShowToolbar(false);
  }, [cancelTimer]);

  /** 撤销 AI 生成的内容 */
  const undo = useCallback(() => {
    if (!editor) return;
    cancelTimer();
    editor.commands.setContent(snapshotRef.current);
    setShowToolbar(false);
  }, [editor, cancelTimer]);

  /** 重新生成 */
  const regenerate = useCallback(async () => {
    if (!editor) return;
    cancelTimer();
    editor.commands.setContent(snapshotRef.current);
    setShowToolbar(false);

    const { prompt, content, text, instruction } = lastRequestRef.current;
    if (prompt) await generate(prompt);
    else if (content) await continueWriting();
    else if (text && instruction) await rewrite(text, instruction);
  }, [editor, cancelTimer, generate, continueWriting, rewrite]);

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
