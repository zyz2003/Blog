"use client";

import type { Editor } from "@tiptap/react";
import { cn } from "@/lib/utils";
import {
  Bold,
  Italic,
  Underline,
  List,
  ListOrdered,
  Heading2,
  Quote,
  Code,
  ImageIcon,
  Link,
  Plus,
  ChevronUp,
} from "lucide-react";
import { useState } from "react";

interface MobileToolbarProps {
  editor: Editor | null;
}

/**
 * 移动端底部固定工具栏（社区版，不含 AI 按钮）
 * 768px 以下显示，触摸目标 44px
 */
export function MobileToolbar({ editor }: MobileToolbarProps) {
  const [showMore, setShowMore] = useState(false);

  if (!editor) return null;

  return (
    <div className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-card border-t border-border safe-area-pb">
      {showMore && (
        <div className="flex items-center gap-1 px-2 py-2 border-b border-border overflow-x-auto scrollbar-hide">
          <MobileBtn
            onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
            isActive={editor.isActive("heading", { level: 2 })}
          >
            <Heading2 className="w-5 h-5" />
          </MobileBtn>
          <MobileBtn
            onClick={() => editor.chain().focus().toggleBlockquote().run()}
            isActive={editor.isActive("blockquote")}
          >
            <Quote className="w-5 h-5" />
          </MobileBtn>
          <MobileBtn
            onClick={() => editor.chain().focus().toggleCodeBlock().run()}
            isActive={editor.isActive("codeBlock")}
          >
            <Code className="w-5 h-5" />
          </MobileBtn>
          <MobileBtn
            onClick={() => editor.chain().focus().toggleBulletList().run()}
            isActive={editor.isActive("bulletList")}
          >
            <List className="w-5 h-5" />
          </MobileBtn>
          <MobileBtn
            onClick={() => editor.chain().focus().toggleOrderedList().run()}
            isActive={editor.isActive("orderedList")}
          >
            <ListOrdered className="w-5 h-5" />
          </MobileBtn>
          <MobileBtn
            onClick={() => {
              editor.chain().focus().extendMarkRange("link").run();
            }}
            isActive={editor.isActive("link")}
          >
            <Link className="w-5 h-5" />
          </MobileBtn>
          <MobileBtn
            onClick={() => {
              const input = document.createElement("input");
              input.type = "file";
              input.accept = "image/*";
              input.onchange = () => {
                const file = input.files?.[0];
                if (file) {
                  editor.chain().focus().run();
                }
              };
              input.click();
            }}
          >
            <ImageIcon className="w-5 h-5" />
          </MobileBtn>
        </div>
      )}

      <div className="flex items-center gap-1 px-2 py-1.5">
        <MobileBtn
          onClick={() => editor.chain().focus().toggleBold().run()}
          isActive={editor.isActive("bold")}
        >
          <Bold className="w-5 h-5" />
        </MobileBtn>
        <MobileBtn
          onClick={() => editor.chain().focus().toggleItalic().run()}
          isActive={editor.isActive("italic")}
        >
          <Italic className="w-5 h-5" />
        </MobileBtn>
        <MobileBtn
          onClick={() => editor.chain().focus().toggleUnderline().run()}
          isActive={editor.isActive("underline")}
        >
          <Underline className="w-5 h-5" />
        </MobileBtn>

        <MobileBtn onClick={() => setShowMore(!showMore)} isActive={showMore}>
          <ChevronUp className={cn("w-5 h-5 transition-transform", showMore && "rotate-180")} />
        </MobileBtn>

        <MobileBtn
          onClick={() => {
            editor.chain().focus().insertContent("/").run();
          }}
        >
          <Plus className="w-5 h-5" />
        </MobileBtn>
      </div>
    </div>
  );
}

function MobileBtn({
  onClick,
  isActive = false,
  className,
  label,
  children,
}: {
  onClick: () => void;
  isActive?: boolean;
  className?: string;
  label?: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      aria-pressed={isActive || undefined}
      className={cn(
        "inline-flex items-center justify-center w-11 h-11 rounded-lg transition-colors",
        "active:bg-muted/80 touch-manipulation",
        isActive ? "bg-secondary text-foreground" : "text-muted-foreground",
        className
      )}
    >
      {children}
    </button>
  );
}
