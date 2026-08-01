"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Bot } from "lucide-react";
import type { Article } from "@/types/article";
import { useSiteConfigStore } from "@/store/site-config-store";
import styles from "./PostDetail.module.css";

/** 将 HTML 摘要转为纯文本（打字机基于纯文本逐字输出） */
function htmlToPlainText(html: string): string {
  if (typeof document === "undefined") {
    return html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
  }
  const doc = new DOMParser().parseFromString(html, "text/html");
  return (doc.body.textContent || "").replace(/\s+/g, " ").trim();
}

export function ArticleLeadSummary({ article }: { article: Article }) {
  const siteConfig = useSiteConfigStore(state => state.siteConfig);
  const gptName = siteConfig.ai_summary_gpt_name || "文章摘要";

  // 取第一条非空摘要
  const fullText = useMemo(() => {
    const raw = (article.summaries || []).map(s => s.trim()).filter(Boolean)[0];
    if (!raw) return "";
    // 摘要可能是 HTML，转为纯文本用于打字机输出
    return htmlToPlainText(raw);
  }, [article.summaries]);

  const [displayText, setDisplayText] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [shouldRender, setShouldRender] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const typingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const startedRef = useRef(false);

  // 打字机效果：逐字打出，打完即停（不倒序收回、不循环）
  const typeWriter = useCallback(
    (text: string) => {
      if (typingTimerRef.current) {
        clearTimeout(typingTimerRef.current);
        typingTimerRef.current = null;
      }
      let index = 0;
      setIsTyping(true);
      setDisplayText("");

      const tick = () => {
        if (index <= text.length) {
          setDisplayText(text.slice(0, index));
          index += 1;
          typingTimerRef.current = setTimeout(tick, 50);
        } else {
          // 打完即停，保留全文，不再回退
          setIsTyping(false);
          typingTimerRef.current = null;
        }
      };
      tick();
    },
    []
  );

  // 进入视口才触发打字机
  useEffect(() => {
    if (!fullText || startedRef.current) return;
    const el = containerRef.current;
    if (!el) return;

    // 兜底：IntersectionObserver 不支持时直接触发
    if (typeof IntersectionObserver === "undefined") {
      startedRef.current = true;
      setShouldRender(true);
      typeWriter(fullText);
      return;
    }

    const observer = new IntersectionObserver(
      entries => {
        for (const entry of entries) {
          if (entry.isIntersecting && !startedRef.current) {
            startedRef.current = true;
            setShouldRender(true);
            typeWriter(fullText);
            observer.disconnect();
            break;
          }
        }
      },
      { threshold: 0.2 }
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [fullText, typeWriter]);

  // 清理定时器
  useEffect(() => {
    return () => {
      if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
    };
  }, []);

  if (!fullText) return null;

  return (
    <div className={styles.articleLead} ref={containerRef} role="region" aria-label="文章摘要">
      <div className={styles.articleLeadTitle}>
        <Bot className={styles.articleLeadIcon} aria-hidden="true" />
        <span className={styles.articleLeadTitleText}>{gptName}</span>
        {isTyping && <span className={styles.articleLeadStatus}>正在生成…</span>}
      </div>
      <div className={styles.articleLeadText}>
        <span>{displayText}</span>
        {isTyping && <span className={styles.articleLeadCursor}>|</span>}
      </div>
    </div>
  );
}
