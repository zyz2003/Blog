"use client";

import { useSyncExternalStore } from "react";
import { FaHashtag } from "react-icons/fa6";
import { useTags } from "@/hooks/queries";
import { cn } from "@/lib/utils";
import styles from "./TagBar.module.css";

// 客户端挂载检测（避免 hydration mismatch）
const subscribe = () => () => {};
const getSnapshot = () => true;
const getServerSnapshot = () => false;

interface TagBarProps {
  selectedTag: string;
  onTagChange: (tagName: string) => void;
}

export function TagBar({ selectedTag, onTagChange }: TagBarProps) {
  const { data: tags = [], isLoading } = useTags("count");
  const mounted = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  // 服务端渲染和首次 hydration 时渲染稳定占位，避免标签云加载后挤压文章列表
  if (!mounted || isLoading) {
    return (
      <div className={styles.tagBarContainer} aria-busy="true">
        {Array.from({ length: 12 }).map((_, index) => (
          <span key={index} className={styles.tagSkeleton} />
        ))}
      </div>
    );
  }

  if (tags.length === 0) return null;

  const handleTagClick = (e: React.MouseEvent, tagName: string) => {
    e.preventDefault();
    onTagChange(tagName);
  };

  return (
    <div className={styles.tagBarContainer}>
      {tags.map(tag => (
        <a
          key={tag.id}
          href={`/tags/${tag.slug || encodeURIComponent(tag.name)}/`}
          onClick={e => handleTagClick(e, tag.name)}
          className={cn(styles.tagItem, selectedTag === tag.name && styles.selected)}
        >
          <FaHashtag className={styles.tagPunctuation} aria-hidden="true" />
          <span className={styles.tagName}>{tag.name}</span>
          <span className={styles.tagCount}>{tag.count}</span>
        </a>
      ))}
    </div>
  );
}
