"use client";

import { memo, useMemo, useEffect, useRef } from "react";
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
  const ref = useRef<HTMLSpanElement>(null);

  // 代码块后处理：注入语言标签 + 复制按钮（零依赖，DOM 操作）
  // 从 marked 默认输出的 <code class="language-XXX"> 提取语言，避免自定义 renderer 的版本差异
  useEffect(() => {
    const root = ref.current;
    if (!root) return;
    const pres = root.querySelectorAll<HTMLPreElement>("pre");
    pres.forEach(pre => {
      if (pre.querySelector(".chat-code-copy")) return; // 已注入（流式重用同一节点）
      const code = pre.querySelector("code");
      const langMatch = code?.className.match(/language-([\w-]+)/);
      const lang = langMatch?.[1];
      if (lang) {
        const span = document.createElement("span");
        span.className = "chat-code-lang";
        span.textContent = lang;
        pre.appendChild(span);
      }
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "chat-code-copy";
      btn.textContent = "复制";
      btn.setAttribute("aria-label", "复制代码");
      btn.addEventListener("click", async () => {
        const codeEl = pre.querySelector("code");
        try {
          await navigator.clipboard.writeText(codeEl?.textContent ?? "");
          btn.textContent = "已复制";
          btn.classList.add("chat-copied");
          setTimeout(() => {
            btn.textContent = "复制";
            btn.classList.remove("chat-copied");
          }, 1600);
        } catch {
          /* clipboard unavailable */
        }
      });
      pre.appendChild(btn);
    });
  }, [html]);

  if (!html) {
    // SSR 或空文本：纯文本兜底，保留换行
    return <span className="whitespace-pre-wrap">{text}</span>;
  }

  return (
    <span
      ref={ref}
      className="chat-md"
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}

export const MarkdownText = memo(MarkdownTextImpl);
