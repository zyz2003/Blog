"use client";

import { useMemo } from "react";
import dynamic from "next/dynamic";
import { useSiteConfigStore } from "@/store/site-config-store";
import { AuthorInfoCard } from "./AuthorInfoCard";
import { CardWechat } from "./CardWechat";
import { CustomSidebarBlocks } from "./CustomSidebarBlocks";
import { StickyCards } from "./StickyCards";
import styles from "./Sidebar.module.css";

const CardClock = dynamic(() => import("./CardClock").then(m => m.CardClock), {
  ssr: false,
});

export function Sidebar() {
  const siteConfig = useSiteConfigStore(state => state.siteConfig);

  // 作者信息卡片配置
  const authorInfoConfig = useMemo(() => {
    if (!siteConfig?.sidebar?.author?.enable) return null;
    return {
      description: siteConfig.sidebar.author.description || "",
      statusImg: siteConfig.sidebar.author.statusImg || "",
      skills: siteConfig.sidebar.author.skills || [],
      social: siteConfig.sidebar.author.social || {},
      userAvatar: siteConfig.USER_AVATAR || "",
      ownerName: siteConfig.frontDesk?.siteOwner?.name || "",
      subTitle: siteConfig.SUB_TITLE || "",
    };
  }, [siteConfig]);

  // 微信公众号卡片配置
  const wechatConfig = useMemo(() => {
    if (!siteConfig?.sidebar?.wechat?.enable) return null;
    return {
      face: siteConfig.sidebar.wechat.face || "",
      backFace: siteConfig.sidebar.wechat.backFace || "",
      blurBackground: siteConfig.sidebar.wechat.blurBackground || "",
      link: siteConfig.sidebar.wechat.link,
    };
  }, [siteConfig]);

  // 天气时钟配置（key 不下发前端，由后端 /api/public/weather/now 代理）
  const clockConfig = useMemo(() => {
    const w = siteConfig?.sidebar?.weather;
    if (!w?.enable) return null;
    return {
      loading: w.loading || "",
      defaultRectangle: w.default_rectangle === true || (w.default_rectangle as unknown) === "true",
      rectangle: w.rectangle || "112.6534116,27.96920845",
    };
  }, [siteConfig]);

  return (
    <aside className={styles.asideContent}>
      {authorInfoConfig && <AuthorInfoCard config={authorInfoConfig} />}
      {wechatConfig && <CardWechat config={wechatConfig} />}
      <CustomSidebarBlocks />
      {clockConfig && <CardClock config={clockConfig} />}
      <StickyCards />
    </aside>
  );
}
