/*
 * @Description:
 * @Author: 安知鱼
 * @Date: 2026-02-01 18:48:54
 * @LastEditTime: 2026-02-02 19:31:13
 * @LastEditors: 安知鱼
 */
/**
 * 文章详情内容组件
 * 客户端组件，负责渲染文章详情的完整内容
 */
"use client";

import { useEffect, useMemo } from "react";
import Link from "next/link";
import { useTheme } from "next-themes";
import { FaHashtag } from "react-icons/fa6";
import { PostHeader } from "./PostHeader";
import { ArticleLeadSummary } from "./ArticleLeadSummary";
import { PostContent } from "./PostContent";
import { PostCopyright } from "./PostCopyright";
import { PostRelatedPosts } from "./PostRelatedPosts";
import { PostPagination } from "./PostPagination";
import { PostPaginationFloat } from "./PostPaginationFloat";
import { CommentSection } from "./Comment";
import { CommentBarrage } from "./CommentBarrage";
import { PostSidebar } from "./Sidebar";
import { useShallow } from "zustand/shallow";
import { useSiteConfigStore } from "@/store/site-config-store";
import { useUiStore } from "@/store/ui-store";
import { usePageStore } from "@/store/page-store";
import { setArticleMetaThemeColor, restoreMetaThemeColor } from "@/utils/theme-manager";
import { applySiteAppearanceFromConfig } from "@/utils/site-theme-colors";
import { resolvePostDefaultCoverUrl } from "@/utils/same-origin-media-url";
import type { Article, RecentArticle } from "@/types/article";
import styles from "./PostDetail.module.css";

interface PostDetailContentProps {
  article: Article;
  recentArticles?: RecentArticle[];
}

function buildArticleContentWithCustomJS(contentHTML: string, customJS?: string): string {
  if (!customJS || customJS.trim() === "") {
    return contentHTML;
  }
  const escapedCustomJS = customJS.replace(/<\/script/gi, "<\\/script");
  return `${contentHTML}\n<script data-article-custom-js="true">\n${escapedCustomJS}\n</script>`;
}

export function PostDetailContent({ article, recentArticles = [] }: PostDetailContentProps) {
  const commentConfig = useSiteConfigStore(useShallow(state => state.siteConfig?.comment));
  const appName = useSiteConfigStore(state => state.siteConfig?.APP_NAME);
  const siteOwnerName = useSiteConfigStore(state => state.siteConfig?.frontDesk?.siteOwner?.name);
  const postDefaultCover = useSiteConfigStore(state => state.siteConfig?.post?.default?.default_cover);
  const articleShowRelated = useSiteConfigStore(state => state.siteConfig?.article?.showRelated);
  const gravatarUrl = useSiteConfigStore(state => state.siteConfig?.GRAVATAR_URL);
  const defaultGravatarType = useSiteConfigStore(state => state.siteConfig?.DEFAULT_GRAVATAR_TYPE);
  const setPageTitle = usePageStore(state => state.setPageTitle);
  const isCommentBarrageVisible = useUiStore(state => state.isCommentBarrageVisible);
  const isCommentEnabled =
    commentConfig?.enable === undefined || commentConfig?.enable === true || commentConfig?.enable === "true";
  const isCommentBarrageEnabledBySite =
    commentConfig?.barrage_enable === undefined ||
    commentConfig?.barrage_enable === true ||
    commentConfig?.barrage_enable === "true";
  const clearPageTitle = usePageStore(state => state.clearPageTitle);

  // 进入文章页面时立即跳到顶部（不带缓动）
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "instant" });
  }, [article.id]);

  // 设置文章标题到 Header
  useEffect(() => {
    setPageTitle(article.title);
    return () => {
      clearPageTitle();
    };
  }, [article.title, setPageTitle, clearPageTitle]);

  // 站点配置加载完 + 主题模式确定后，再应用文章主色，避免被 SiteThemeColorsSync 全局同步覆盖
  const isLoaded = useSiteConfigStore(state => state.isLoaded);
  const { resolvedTheme } = useTheme();

  // 设置文章主题色（如果有）- 覆盖全局 --primary 并更新 meta theme-color
  useEffect(() => {
    if (!isLoaded || !resolvedTheme) return;
    if (!article.primary_color) return;

    const root = document.documentElement;
    root.style.setProperty("--primary", article.primary_color);
    root.style.setProperty("--article-primary-color", article.primary_color);
    if (/^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/.test(article.primary_color)) {
      root.style.setProperty("--primary-op", `${article.primary_color}23`);
      root.style.setProperty("--primary-op-deep", `${article.primary_color}dd`);
      root.style.setProperty("--primary-op-light", `${article.primary_color}0d`);
    }
    setArticleMetaThemeColor(article.primary_color);

    return () => {
      // 离开文章：恢复全局主题色（重新应用站点外观，避免文章色残留）
      const siteConfig = useSiteConfigStore.getState().siteConfig;
      applySiteAppearanceFromConfig(siteConfig, resolvedTheme === "dark");
      root.style.removeProperty("--article-primary-color");
      restoreMetaThemeColor();
    };
  }, [article.primary_color, isLoaded, resolvedTheme]);

  const siteName = appName || "安知鱼";
  const ownerName = siteOwnerName || "安知鱼";
  const defaultCover = useMemo(() => resolvePostDefaultCoverUrl(postDefaultCover), [postDefaultCover]);
  const customJS = article.extra_config?.custom_js;
  const hasCustomJS = !!customJS && customJS.trim() !== "";
  const isRelatedEnabled = articleShowRelated !== false && articleShowRelated !== "false";
  const contentWithCustomJS = useMemo(
    () => buildArticleContentWithCustomJS(article.content_html, customJS),
    [article.content_html, customJS]
  );

  return (
    <div className={styles.postDetailContainer}>
      {/* 文章头部 */}
      <PostHeader article={article} defaultCoverUrl={defaultCover} />

      {/* 主内容区域 */}
      <div className={styles.layout}>
        <main className={styles.postContentInner}>
          <div className={styles.postDetailContent}>
            {/* 文章摘要 */}
            <ArticleLeadSummary article={article} />

            {/* 文章内容 */}
            <PostContent
              content={contentWithCustomJS}
              enableScripts={hasCustomJS}
              articleInfo={{
                isReprint: article.is_reprint,
                copyrightAuthor: article.copyright_author,
                copyrightUrl: article.copyright_url,
              }}
            />

            {/* 版权信息 */}
            <PostCopyright article={article} />

            {/* 版权下方标签（仅左侧标签集合，无右侧入口） */}
            {article.post_tags.length > 0 && (
              <div className={styles.postTagBar} aria-label="文章标签">
                {article.post_tags.map(tag => (
                  <Link
                    key={tag.id}
                    href={`/tags/${tag.slug || encodeURIComponent(tag.name)}`}
                    className={styles.postTagItem}
                  >
                    <FaHashtag className={styles.postTagIcon} aria-hidden="true" />
                    <span className={styles.postTagName}>{tag.name}</span>
                    <span className={styles.postTagCount}>{tag.count}</span>
                  </Link>
                ))}
              </div>
            )}

            {/* 喜欢这篇文章的人也看了（版权后、评论前） */}
            {isRelatedEnabled && (
              <PostRelatedPosts
                articles={article.related_articles}
                currentArticleId={article.id}
                defaultCover={defaultCover}
              />
            )}

            {/* 上一篇/下一篇（屏宽 < 1400px 时在版权下方显示） */}
            <div className={styles.paginationInlineWrap}>
              <PostPagination
                prevArticle={article.prev_article}
                nextArticle={article.next_article}
              />
            </div>

            {/* 评论区 */}
            <CommentSection targetTitle={article.title} className={styles.commentSection} />
          </div>
        </main>

        {/* 文章详情侧边栏 */}
        <PostSidebar article={article} recentArticles={recentArticles} />
      </div>

      {/* 底部栏 */}
      <div className={styles.footerBar}>
        <div className={styles.footerLogo}>{siteName}</div>
        <div className={styles.footerDescription}>来自 {ownerName} 最新设计与科技的文章</div>
        <Link href="/archives" className={styles.footerLink}>
          查看全部
        </Link>
      </div>

      {/* 右下角：上一篇/下一篇浮动卡片 + 热评弹幕（受系统设置与用户开关双重控制） */}
      <PostPaginationFloat
        prevArticle={article.prev_article}
        nextArticle={article.next_article}
        commentBarrageEnabled={
          isCommentEnabled && isCommentBarrageEnabledBySite && isCommentBarrageVisible
        }
      />
      {isCommentEnabled && isCommentBarrageEnabledBySite && isCommentBarrageVisible && (
        <CommentBarrage
          gravatarUrl={gravatarUrl || "https://cravatar.cn/"}
          defaultGravatarType={defaultGravatarType || "mp"}
          masterTag={commentConfig?.master_tag || "博主"}
        />
      )}
    </div>
  );
}

export default PostDetailContent;
