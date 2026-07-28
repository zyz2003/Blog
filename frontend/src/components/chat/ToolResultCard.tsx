"use client";

interface ToolResultCardProps {
  output: unknown;
  toolName: string;
}

/**
 * Renders tool results as article link cards.
 * For search_articles: renders a list of article cards (title + snippet + url).
 * For get_article: renders a single article card.
 */
export function ToolResultCard({ output, toolName }: ToolResultCardProps) {
  if (toolName === "search_articles") {
    const data = output as { articles?: { title: string; snippet: string; url: string }[] } | null;
    if (!data?.articles?.length) return null;

    return (
      <div className="space-y-2">
        {data.articles.map((article, i) => (
          <a
            key={i}
            href={article.url}
            target="_blank"
            rel="noopener noreferrer"
            className="block rounded-lg border border-neutral-200 p-2 transition-colors hover:bg-neutral-50 dark:border-neutral-600 dark:hover:bg-neutral-700"
          >
            <div className="text-sm font-medium text-neutral-800 dark:text-neutral-200">
              {article.title}
            </div>
            <div className="mt-1 text-xs text-neutral-500 line-clamp-2 dark:text-neutral-400">
              {article.snippet}
            </div>
          </a>
        ))}
      </div>
    );
  }

  if (toolName === "get_article") {
    const data = output as { title?: string; content?: string; url?: string } | null;
    if (!data) return null;

    return (
      <a
        href={data.url || "#"}
        target="_blank"
        rel="noopener noreferrer"
        className="block rounded-lg border border-neutral-200 p-2 transition-colors hover:bg-neutral-50 dark:border-neutral-600 dark:hover:bg-neutral-700"
      >
        <div className="text-sm font-medium text-neutral-800 dark:text-neutral-200">
          {data.title || "文章详情"}
        </div>
        {data.content && (
          <div className="mt-1 text-xs text-neutral-500 line-clamp-3 dark:text-neutral-400">
            {data.content.slice(0, 150)}...
          </div>
        )}
      </a>
    );
  }

  // Fallback for unknown tool results
  return (
    <div className="rounded-lg border border-neutral-200 p-2 text-xs text-neutral-500 dark:border-neutral-600 dark:text-neutral-400">
      工具结果
    </div>
  );
}
