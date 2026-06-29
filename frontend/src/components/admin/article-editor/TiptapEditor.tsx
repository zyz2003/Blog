"use client";

import { EditorContent } from "@tiptap/react";
import type { Editor } from "@tiptap/react";
import { EditorBubbleMenu } from "./EditorBubbleMenu";
import "./editor-styles/index.scss";
import "@/components/post/PostContent/code-highlight.css";

interface TiptapEditorProps {
  /** Tiptap editor 实例 */
  editor: Editor | null;
}

/**
 * Tiptap 编辑器渲染组件
 * 包含 BubbleMenu 浮动工具栏
 */
export function TiptapEditor({ editor }: TiptapEditorProps) {
  if (!editor) {
    return (
      <div className="flex items-center justify-center min-h-[500px]">
        <div className="animate-pulse text-muted-foreground">加载编辑器中...</div>
      </div>
    );
  }

  return (
    <>
      <EditorBubbleMenu editor={editor} />
      <EditorContent editor={editor} />
    </>
  );
}
