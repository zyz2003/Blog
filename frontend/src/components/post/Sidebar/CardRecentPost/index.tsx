/**
 * 最近文章组件
 * 显示最近发布的文章列表
 */
"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { formatDate } from "@/utils/date";
import { toSameOriginMediaUrl } from "@/utils/same-origin-media-url";
import type { RecentArticle } from "@/types/article";
import styles from "./CardRecentPost.module.css";

interface CardRecentPostProps {
  articles: RecentArticle[];
  currentArticleId?: number | string;
  defaultCover?: string;
  maxCount?: number;
}

/**
 * 解析侧边栏最近文章条目的封面地址：无有效封面时用默认图，否则做本站媒体同源压缩。
 */
function resolveRecentPostCoverSrc(coverUrl: string | undefined, defaultCover: string): string {
  const trimmed = coverUrl?.trim();
  if (!trimmed) {
    return defaultCover;
  }
  return toSameOriginMediaUrl(trimmed);
}

interface RecentPostCoverImageProps {
  coverUrl?: string;
  defaultCover: string;
  alt: string;
}

/**
 * 最近文章缩略图：空/无效封面用默认图，加载失败时回退到默认图。
 */
function RecentPostCoverImage({ coverUrl, defaultCover, alt }: RecentPostCoverImageProps) {
  const [loadFailed, setLoadFailed] = useState(false);

  const src = useMemo(() => {
    if (loadFailed) {
      return defaultCover;
    }
    return resolveRecentPostCoverSrc(coverUrl, defaultCover);
  }, [coverUrl, defaultCover, loadFailed]);

  return (
    <Image
      src={src}
      alt={alt}
      width={64}
      height={64}
      className={styles.coverImage}
      onError={() => setLoadFailed(true)}
    />
  );
}

export function CardRecentPost({
  articles,
  currentArticleId,
  defaultCover = "/images/default-cover.webp",
  maxCount = 5,
}: CardRecentPostProps) {
  // 过滤掉当前文章并限制数量
  const filteredArticles = articles.filter(article => article.id !== currentArticleId).slice(0, maxCount);

  // 获取文章链接
  const getArticleLink = (article: RecentArticle) => {
    if (article.is_doc) {
      return `/doc/${article.id}`;
    }
    return `/posts/${article.abbrlink || article.id}`;
  };

  if (filteredArticles.length === 0) {
    return null;
  }

  return (
    <div className={styles.cardRecentPost}>
      <div className={styles.cardTitle}>最近发布</div>

      <div className={styles.articleList}>
        {filteredArticles.map(article => (
          <Link key={article.id} href={getArticleLink(article)} className={styles.articleItem}>
            <div className={styles.cover}>
              <RecentPostCoverImage coverUrl={article.cover_url} defaultCover={defaultCover} alt={article.title} />
            </div>
            <div className={styles.info}>
              <h4 className={styles.title}>{article.title}</h4>
              <span className={styles.date}>{formatDate(article.created_at)}</span>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}

export default CardRecentPost;
