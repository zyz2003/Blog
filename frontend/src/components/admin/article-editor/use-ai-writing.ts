/**
 * AI 写作 Hook -- 流式插入 + 撤销机制。
 *
 * 所见即所得：AI 生成的内容直接流式插入编辑器。
 * 便捷撤销：流式前快照 editor.getHTML()，撤销时 setContent 恢复。
 *
 * 三种模式：
 * - generate：从头写（在光标位置插入）
 * - continue：续写（在末尾追加）
 * - rewrite：改写（替换选中文本）
 */
"use client";

import { useState, useRef, useCallback } from "react";
import type { Editor } from "@tiptap/react";
import { aiWritingApi } from "@/lib/api/ai-writing";
import { addToast } from "@heroui/react";

export type AiWritingMode = "generate" | "continue" | "rewrite";

interface LastRequest {
  prompt?: string;
  content?: string;
  text?: string;
  instruction?: string;
}

export function useAiWriting(editor: Editor | null) {
  const [isGenerating, setIsGenerating] = useState(false);
  const [showToolbar, setShowToolbar] = useState(false);
  const [mode, setMode] = useState<AiWritingMode>("generate");

  const snapshotRef = useRef<string>("");
  const lastRequestRef = useRef<LastRequest>({});

  /** 从头写 */
  const generate = useCallback(
    async (prompt: string) => {
      if (!editor) return;
      snapshotRef.current = editor.getHTML();
      lastRequestRef.current = { prompt };
      setMode("generate");
      setIsGenerating(true);
      setShowToolbar(false);

      await aiWritingApi.generate(prompt, {
        onChunk: (chunk) => editor.commands.insertContent(chunk),
        onDone: () => {
          setIsGenerating(false);
          setShowToolbar(true);
        },
        onError: (err) => {
          setIsGenerating(false);
          addToast({ title: "AI 写作失败", description: err.message, color: "danger" });
        },
      });
    },
    [editor],
  );

  /** 续写 */
  const continueWriting = useCallback(async () => {
    if (!editor) return;
    const content = editor.getHTML();
    snapshotRef.current = content;
    lastRequestRef.current = { content };
    setMode("continue");
    setIsGenerating(true);
    setShowToolbar(false);

    editor.commands.focus("end");

    await aiWritingApi.continue(content, {
      onChunk: (chunk) => editor.commands.insertContent(chunk),
      onDone: () => {
        setIsGenerating(false);
        setShowToolbar(true);
      },
      onError: (err) => {
        setIsGenerating(false);
        addToast({ title: "AI 续写失败", description: err.message, color: "danger" });
      },
    });
  }, [editor]);

  /** 改写选中文本 */
  const rewrite = useCallback(
    async (text: string, instruction: string) => {
      if (!editor || !text) return;
      snapshotRef.current = editor.getHTML();
      lastRequestRef.current = { text, instruction };
      setMode("rewrite");
      setIsGenerating(true);
      setShowToolbar(false);

      // 删除选中文本，在光标位置插入改写后的内容
      editor.commands.deleteSelection();

      await aiWritingApi.rewrite(text, instruction, {
        onChunk: (chunk) => editor.commands.insertContent(chunk),
        onDone: () => {
          setIsGenerating(false);
          setShowToolbar(true);
        },
        onError: (err) => {
          setIsGenerating(false);
          addToast({ title: "AI 改写失败", description: err.message, color: "danger" });
        },
      });
    },
    [editor],
  );

  /** 接受 AI 生成的内容 */
  const accept = useCallback(() => {
    setShowToolbar(false);
  }, []);

  /** 撤销 AI 生成的内容 */
  const undo = useCallback(() => {
    if (!editor) return;
    editor.commands.setContent(snapshotRef.current);
    setShowToolbar(false);
  }, [editor]);

  /** 重新生成 */
  const regenerate = useCallback(async () => {
    if (!editor) return;
    editor.commands.setContent(snapshotRef.current);
    setShowToolbar(false);

    const { prompt, content, text, instruction } = lastRequestRef.current;
    if (prompt) await generate(prompt);
    else if (content) await continueWriting();
    else if (text && instruction) await rewrite(text, instruction);
  }, [editor, generate, continueWriting, rewrite]);

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
