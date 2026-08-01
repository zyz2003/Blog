"use client";

import { Sparkles, Calendar, Clock } from "lucide-react";

interface ToolResultCardProps {
  output: unknown;
  toolName: string;
}

/** 日期格式化：2026-01-02 -> 1月2日 */
function formatDate(s: string): string {
  if (!s) return "";
  const m = s.match(/(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return s;
  return `${parseInt(m[2], 10)}月${parseInt(m[3], 10)}日`;
}

interface ArticleItem {
  title: string;
  url: string;
  snippet?: string;
  cover_url?: string;
  reading_time?: number;
  created_at?: string;
}

/**
 * 单篇文章卡片。
 * featured=true：AI 推荐主卡片（带"AI 推荐"渐变徽标 + 封面渐变叠层 + hover 上浮）。
 * featured=false：候选列表卡片（紧凑）。
 */
function ArticleCard({ a, featured = false }: { a: ArticleItem; featured?: boolean }) {
  return (
    <a
      href={a.url || "#"}
      target="_blank"
      rel="noopener noreferrer"
      className={`group/card relative flex gap-2.5 rounded-lg border border-border bg-card p-2 transition-all duration-200 hover:-translate-y-0.5 hover:border-primary hover:shadow-primary ${
        featured ? "mt-1" : ""
      }`}
    >
      {featured && (
        <span className="absolute -top-2 left-2 z-10 inline-flex items-center gap-0.5 rounded-full bg-primary px-1.5 py-0.5 text-[10px] font-medium text-primary-foreground shadow-sm">
          <Sparkles className="h-2.5 w-2.5" />
          AI 推荐
        </span>
      )}
      {a.cover_url ? (
        <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-md">
          <img
            src={a.cover_url}
            alt=""
            loading="lazy"
            className="h-full w-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/25 to-transparent" />
        </div>
      ) : null}
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-medium text-foreground">
          {a.title || "文章详情"}
        </div>
        {a.snippet && (
          <div className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">
            {a.snippet}
          </div>
        )}
        <div className="mt-1 flex items-center gap-2 text-[11px] text-muted-foreground/80">
          {a.created_at && (
            <span className="flex items-center gap-0.5">
              <Calendar className="h-2.5 w-2.5" />
              {formatDate(a.created_at)}
            </span>
          )}
          {a.reading_time ? (
            <span className="flex items-center gap-0.5">
              <Clock className="h-2.5 w-2.5" />
              {a.reading_time} 分钟
            </span>
          ) : null}
        </div>
      </div>
    </a>
  );
}

/** 文章列表卡片（search / get_recent_articles / get_articles_by_category 共用） */
function ArticleListCards({ articles }: { articles: ArticleItem[] }) {
  return (
    <div className="space-y-2">
      {articles.map((a, i) => (
        <ArticleCard key={i} a={a} />
      ))}
    </div>
  );
}

/** 分类 / 标签胶囊列表 */
function TermChips({
  items,
}: {
  items: Array<{ name: string; slug?: string; count?: number }>;
}) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {items.map((it, i) => (
        <span
          key={i}
          className="inline-flex items-center gap-1 rounded-full border border-border bg-muted/50 px-2.5 py-1 text-xs text-foreground"
        >
          {it.name}
          {it.count ? (
            <span className="text-muted-foreground/70">{it.count}</span>
          ) : null}
        </span>
      ))}
    </div>
  );
}

/**
 * 渲染工具结果为文章链接卡片 / 胶囊列表。
 * 按 output 结构分支：articles 数组 -> 文章卡片；get_article -> AI 推荐主卡片；
 * categories/tags -> 胶囊列表。
 */
export function ToolResultCard({ output, toolName }: ToolResultCardProps) {
  const data = (output ?? null) as any;

  // 文章列表类工具（search_articles / get_recent_articles / get_articles_by_category）
  if (data?.articles && Array.isArray(data.articles)) {
    if (data.articles.length === 0) {
      return (
        <div className="rounded-lg border border-border p-2 text-xs text-muted-foreground">
          未找到相关文章
        </div>
      );
    }
    return <ArticleListCards articles={data.articles} />;
  }

  // 单篇文章（get_article）- AI 推荐主卡片
  if (toolName === "get_article") {
    if (!data) return null;
    return (
      <ArticleCard
        a={{
          title: data.title,
          url: data.url,
          snippet: data.content,
          cover_url: data.cover_url,
          reading_time: data.reading_time,
          created_at: data.created_at,
        }}
        featured
      />
    );
  }

  // 分类列表（list_categories）
  if (data?.categories && Array.isArray(data.categories)) {
    if (data.categories.length === 0) return null;
    return <TermChips items={data.categories} />;
  }

  // 标签列表（list_tags）
  if (data?.tags && Array.isArray(data.tags)) {
    if (data.tags.length === 0) return null;
    return <TermChips items={data.tags} />;
  }

  // Fallback for unknown tool results
  return (
    <div className="rounded-lg border border-border p-2 text-xs text-muted-foreground">
      工具结果
    </div>
  );
}
