"use client";

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

/** 文章列表卡片（search / get_recent_articles / get_articles_by_category 共用） */
function ArticleListCards({
  articles,
}: {
  articles: Array<{
    title: string;
    url: string;
    snippet?: string;
    cover_url?: string;
    reading_time?: number;
    created_at?: string;
  }>;
}) {
  return (
    <div className="space-y-2">
      {articles.map((a, i) => (
        <a
          key={i}
          href={a.url}
          target="_blank"
          rel="noopener noreferrer"
          className="flex gap-2.5 rounded-lg border border-border p-2 transition-colors hover:bg-muted"
        >
          {a.cover_url ? (
            <img
              src={a.cover_url}
              alt=""
              loading="lazy"
              className="h-12 w-12 shrink-0 rounded-md object-cover"
            />
          ) : null}
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm font-medium text-foreground">
              {a.title}
            </div>
            {a.snippet && (
              <div className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">
                {a.snippet}
              </div>
            )}
            <div className="mt-1 flex items-center gap-2 text-[11px] text-muted-foreground/80">
              {a.created_at && <span>{formatDate(a.created_at)}</span>}
              {a.reading_time ? <span>· ⏱ {a.reading_time} 分钟</span> : null}
            </div>
          </div>
        </a>
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
 * 按 output 结构分支：articles 数组 -> 文章卡片；content -> 单文章；
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

  // 单篇文章（get_article）- 卡片样式（封面 + 标题 + 摘要 + meta）
  if (toolName === "get_article") {
    if (!data) return null;
    return (
      <a
        href={data.url || "#"}
        target="_blank"
        rel="noopener noreferrer"
        className="flex gap-2.5 rounded-lg border border-border p-2 transition-colors hover:bg-muted"
      >
        {data.cover_url ? (
          <img
            src={data.cover_url}
            alt=""
            loading="lazy"
            className="h-12 w-12 shrink-0 rounded-md object-cover"
          />
        ) : null}
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-medium text-foreground">
            {data.title || "文章详情"}
          </div>
          {data.content && (
            <div className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">
              {data.content}
            </div>
          )}
          <div className="mt-1 flex items-center gap-2 text-[11px] text-muted-foreground/80">
            {data.created_at && <span>{formatDate(data.created_at)}</span>}
            {data.reading_time ? <span>· ⏱ {data.reading_time} 分钟</span> : null}
          </div>
        </div>
      </a>
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
