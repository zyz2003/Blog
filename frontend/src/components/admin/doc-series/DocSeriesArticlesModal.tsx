"use client";

import { useEffect, useState } from "react";
import {
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  Chip,
  Spinner,
  Link as HeroLink,
} from "@heroui/react";
import { BookOpen, ExternalLink } from "lucide-react";
import { formatDateTimeParts } from "@/utils/date";
import { docSeriesApi } from "@/lib/api/doc-series";
import type { DocSeries } from "@/types/doc-series";
import type { DocArticleItem } from "@/types/doc-series";

interface DocSeriesArticlesModalProps {
  isOpen: boolean;
  onClose: () => void;
  series: DocSeries | null;
}

/** 仅在弹窗打开且已选中系列时挂载，关闭时卸载，避免在 effect 里同步清空列表状态 */
function DocSeriesArticlesList({ series }: { series: DocSeries }) {
  const [articles, setArticles] = useState<DocArticleItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    docSeriesApi
      .getPublicSeriesWithArticles(series.id)
      .then(data => {
        if (!cancelled) setArticles(data.articles ?? []);
      })
      .catch(() => {
        if (!cancelled) setArticles([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [series.id]);

  if (loading) {
    return (
      <div className="flex justify-center py-10">
        <Spinner size="sm" label="加载文档列表..." />
      </div>
    );
  }

  if (articles.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-10 text-muted-foreground">
        <BookOpen className="w-8 h-8 mb-2 opacity-30" />
        <p className="text-sm">该系列下暂无文档</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-1">
      {articles.map((article, index) => {
        const created = formatDateTimeParts(article.created_at);
        const href = `/doc/${article.abbrlink || article.id}`;
        return (
          <div
            key={article.id}
            className="flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-muted/50 transition-colors group"
          >
            <span className="text-xs text-muted-foreground/50 tabular-nums w-5 text-right shrink-0">
              {index + 1}
            </span>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{article.title}</p>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="text-xs text-muted-foreground tabular-nums">排序: {article.doc_sort}</span>
                <span className="text-xs text-muted-foreground/40">|</span>
                <span className="text-xs text-muted-foreground tabular-nums">
                  {created.date} {created.time}
                </span>
              </div>
            </div>
            <HeroLink
              href={href}
              isExternal
              showAnchorIcon
              anchorIcon={<ExternalLink className="w-3 h-3" />}
              className="text-xs opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
              size="sm"
            >
              查看
            </HeroLink>
          </div>
        );
      })}
    </div>
  );
}

export default function DocSeriesArticlesModal({ isOpen, onClose, series }: DocSeriesArticlesModalProps) {
  return (
    <Modal isOpen={isOpen} onClose={onClose} size="2xl" scrollBehavior="inside">
      <ModalContent>
        <ModalHeader className="flex items-center gap-2 pb-2">
          <BookOpen className="w-4 h-4 text-primary shrink-0" />
          <span className="truncate">{series?.name ?? "文档系列"}</span>
          <Chip size="sm" variant="flat" color="primary" className="ml-auto shrink-0">
            {series?.doc_count ?? 0} 篇
          </Chip>
        </ModalHeader>
        <ModalBody className="pb-5">
          {isOpen && series ? <DocSeriesArticlesList key={series.id} series={series} /> : null}
        </ModalBody>
      </ModalContent>
    </Modal>
  );
}
