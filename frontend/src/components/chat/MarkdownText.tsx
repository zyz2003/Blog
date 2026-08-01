"use client";

import { memo, useMemo } from "react";
import { marked } from "marked";
import DOMPurify from "dompurify";

// GFM + 换行成 <br>，贴合聊天场景
marked.setOptions({ breaks: true, gfm: true });

/**
 * 将 markdown 文本渲染为已净化的 HTML。
 * - marked 解析 -> DOMPurify 净化（防 XSS）-> 给 <a> 统一加 target=_blank
 * - SSR 期间返回空（无 window），由外层回退显示纯文本，避免 hydration 不一致
 * - 流式时每次 text 变化同步重算（marked 足够快）
 */
function renderMarkdown(text: string): string {
  if (typeof window === "undefined") return "";
  const raw = marked.parse(text ?? "", { async: false }) as string;
  const clean = DOMPurify.sanitize(raw);
  // 净化后再加 target/rel，确保只作用于合法 <a>
  return clean.replace(/<a /g, '<a target="_blank" rel="noopener noreferrer" ');
}

function MarkdownTextImpl({ text }: { text: string }) {
  const html = useMemo(() => renderMarkdown(text), [text]);

  if (!html) {
    // SSR 或空文本：纯文本兜底，保留换行
    return <span className="whitespace-pre-wrap">{text}</span>;
  }

  return (
    <span
      className="chat-md"
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}

export const MarkdownText = memo(MarkdownTextImpl);
