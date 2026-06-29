/*
 * @Description:
 * @Author: 安知鱼
 * @Date: 2026-01-31 14:55:41
 * @LastEditTime: 2026-01-31 17:19:44
 * @LastEditors: 安知鱼
 */
import type { Metadata } from "next";
import { HomePageContent } from "@/components/home";
import { buildPageMetadata, fetchSiteConfigForSeo, resolveSeoSiteInfo } from "@/lib/seo";

export async function generateMetadata(): Promise<Metadata> {
  const siteConfig = await fetchSiteConfigForSeo();
  const site = resolveSeoSiteInfo(siteConfig);
  const homepageTitle = site.description ? `${site.siteName} - ${site.description}` : site.siteName;

  return buildPageMetadata({
    title: homepageTitle,
    path: "/",
    absoluteTitle: true,
    siteConfig,
  });
}

export default function HomePage() {
  return (
    <main className="relative">
      {/* 噪点纹理 - 全局覆盖 */}
      <div className="noise-overlay" />

      {/* 首页内容（带 Framer Motion 动画） */}
      <HomePageContent />
    </main>
  );
}
