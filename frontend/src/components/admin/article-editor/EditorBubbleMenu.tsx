"use client";

import { BubbleMenu } from "@tiptap/react/menus";
import type { Editor } from "@tiptap/react";
import {
  Bold,
  Italic,
  Underline,
  Strikethrough,
  Link,
  Highlighter,
  Code,
  AlignLeft,
  AlignCenter,
  AlignRight,
} from "lucide-react";
import { useState, useCallback } from "react";
import { cn } from "@/lib/utils";

interface EditorBubbleMenuProps {
  editor: Editor;
}

/**
 * 浮动工具栏：选中文本时出现
 * 社区版：不含 AI 润色按钮
 */
export function EditorBubbleMenu({ editor }: EditorBubbleMenuProps) {
  const [showLinkInput, setShowLinkInput] = useState(false);
  const [linkUrl, setLinkUrl] = useState("");

  const handleLinkSubmit = useCallback(() => {
    if (!linkUrl.trim()) {
      editor.chain().focus().extendMarkRange("link").unsetLink().run();
    } else {
      editor
        .chain()
        .focus()
        .extendMarkRange("link")
        .setLink({ href: linkUrl, target: "_blank", rel: "noopener noreferrer" })
        .run();
    }
    setShowLinkInput(false);
    setLinkUrl("");
  }, [editor, linkUrl]);

  const openLinkInput = useCallback(() => {
    const attrs = editor.getAttributes("link");
    setLinkUrl(attrs.href || "");
    setShowLinkInput(true);
  }, [editor]);

  return (
    <BubbleMenu
      editor={editor}
      options={{
        placement: "top",
        offset: 8,
      }}
      shouldShow={({ editor: e, state }) => {
        const { from, to, empty } = state.selection;
        if (empty) return false;
        if (e.isActive("codeBlock") || e.isActive("image")) return false;
        const text = state.doc.textBetween(from, to, "");
        return text.length > 0;
      }}
    >
      <div className="flex items-center gap-0.5 bg-card border border-border rounded-lg shadow-lg px-1.5 py-1">
        {showLinkInput ? (
          <div className="flex items-center gap-1.5">
            <input
              type="url"
              value={linkUrl}
              onChange={(e) => setLinkUrl(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleLinkSubmit();
                if (e.key === "Escape") setShowLinkInput(false);
              }}
              placeholder="输入链接地址..."
              className="w-48 h-7 px-2 text-xs bg-muted border border-border/60 rounded-md outline-none focus:border-primary"
              autoFocus
            />
            <BubbleButton onClick={handleLinkSubmit} title="确认">
              <span className="text-xs font-medium text-primary px-1">确认</span>
            </BubbleButton>
          </div>
        ) : (
          <>
            <BubbleButton
              onClick={() => editor.chain().focus().toggleBold().run()}
              isActive={editor.isActive("bold")}
              title="加粗"
            >
              <Bold className="w-3.5 h-3.5" />
            </BubbleButton>
            <BubbleButton
              onClick={() => editor.chain().focus().toggleItalic().run()}
              isActive={editor.isActive("italic")}
              title="斜体"
            >
              <Italic className="w-3.5 h-3.5" />
            </BubbleButton>
            <BubbleButton
              onClick={() => editor.chain().focus().toggleUnderline().run()}
              isActive={editor.isActive("underline")}
              title="下划线"
            >
              <Underline className="w-3.5 h-3.5" />
            </BubbleButton>
            <BubbleButton
              onClick={() => editor.chain().focus().toggleStrike().run()}
              isActive={editor.isActive("strike")}
              title="删除线"
            >
              <Strikethrough className="w-3.5 h-3.5" />
            </BubbleButton>

            <BubbleDivider />

            <BubbleButton
              onClick={() => editor.chain().focus().toggleCode().run()}
              isActive={editor.isActive("code")}
              title="行内代码"
            >
              <Code className="w-3.5 h-3.5" />
            </BubbleButton>
            <BubbleButton
              onClick={() => editor.chain().focus().toggleHighlight({ color: "#fef08a" }).run()}
              isActive={editor.isActive("highlight")}
              title="高亮"
            >
              <Highlighter className="w-3.5 h-3.5" />
            </BubbleButton>
            <BubbleButton onClick={openLinkInput} isActive={editor.isActive("link")} title="链接">
              <Link className="w-3.5 h-3.5" />
            </BubbleButton>

            <BubbleDivider />

            <BubbleButton
              onClick={() => editor.chain().focus().setTextAlign("left").run()}
              isActive={editor.isActive({ textAlign: "left" })}
              title="左对齐"
            >
              <AlignLeft className="w-3.5 h-3.5" />
            </BubbleButton>
            <BubbleButton
              onClick={() => editor.chain().focus().setTextAlign("center").run()}
              isActive={editor.isActive({ textAlign: "center" })}
              title="居中"
            >
              <AlignCenter className="w-3.5 h-3.5" />
            </BubbleButton>
            <BubbleButton
              onClick={() => editor.chain().focus().setTextAlign("right").run()}
              isActive={editor.isActive({ textAlign: "right" })}
              title="右对齐"
            >
              <AlignRight className="w-3.5 h-3.5" />
            </BubbleButton>
          </>
        )}
      </div>
    </BubbleMenu>
  );
}

function BubbleButton({
  onClick,
  isActive = false,
  title,
  children,
}: {
  onClick: () => void;
  isActive?: boolean;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={title}
      aria-pressed={isActive}
      className={cn(
        "inline-flex items-center justify-center w-7 h-7 rounded-md transition-colors",
        "hover:bg-muted",
        isActive && "bg-secondary text-foreground"
      )}
    >
      {children}
    </button>
  );
}

function BubbleDivider() {
  return <div className="w-px h-4 bg-border mx-0.5 shrink-0" />;
}
