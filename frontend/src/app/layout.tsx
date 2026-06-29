import type { Metadata, Viewport } from "next";
import "./globals.css";
import { Providers } from "@/providers";
import { renderCustomBodyHtml, renderCustomHeadHtml } from "@/lib/custom-html";
import {
  buildWebSiteJsonLd,
  createRobotsMetadata,
  fetchSiteConfigForSeo,
  getFaviconContentType,
  resolveMetadataBase,
  resolveSeoSiteInfo,
} from "@/lib/seo";

// Next.js 16 默认会尝试将 root layout 静态化（即使 fetch 带 cache:"no-store"，
// 也只是跳过 Data Cache，不会让整个路由 shell 转为 dynamic）。
// 自定义 HTML/CSS/JS、站点名、logo 等必须在 admin 保存后立即生效，
// 所以显式把根布局声明为 dynamic，使每次请求都重新读取最新站点配置。
export const dynamic = "force-dynamic";

/**
 * 动态生成 Metadata
 * 从后端 API 获取站点配置，实现 SEO 动态化
 */
export async function generateMetadata(): Promise<Metadata> {
  const siteConfig = await fetchSiteConfigForSeo();
  const site = resolveSeoSiteInfo(siteConfig);
  const fullTitle = site.description ? `${site.siteName} - ${site.description}` : site.siteName;

  return createMetadata({
    title: fullTitle,
    description: site.description,
    siteName: site.siteName,
    iconUrl: site.iconUrl,
    logoUrl: site.logoUrl,
    siteUrl: site.siteUrl,
  });
}

/**
 * 创建 Metadata 对象
 */
function createMetadata(config: {
  title: string;
  description: string;
  siteName: string;
  iconUrl?: string;
  logoUrl?: string;
  siteUrl?: string;
}): Metadata {
  const iconUrl = config.iconUrl || "/favicon.ico";
  const logoUrl = config.logoUrl || "/static/img/logo-192x192.png";
  const iconType = getFaviconContentType(iconUrl);
  const metadataBase = resolveMetadataBase(config.siteUrl);

  return {
    metadataBase,
    title: {
      template: `%s | ${config.siteName}`,
      default: config.title,
    },
    description: config.description,
    keywords: ["博客", "Next.js", "HeroUI", "React", "TypeScript"],
    alternates: {
      canonical: "/",
    },
    robots: createRobotsMetadata(true),
    icons: {
      icon: [{ url: iconUrl, type: iconType, sizes: "any" }],
      shortcut: [{ url: iconUrl, type: iconType, sizes: "any" }],
      apple: logoUrl,
    },
    manifest: "/manifest.json",
    openGraph: {
      type: "website",
      locale: "zh_CN",
      siteName: config.siteName,
      title: config.title,
      description: config.description,
      url: "/",
      images: logoUrl ? [logoUrl] : undefined,
    },
    twitter: {
      card: logoUrl ? "summary_large_image" : "summary",
      title: config.title,
      description: config.description,
      images: logoUrl ? [logoUrl] : undefined,
    },
  };
}

function getTrimmedString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#0a0a0a" },
  ],
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const siteConfig = await fetchSiteConfigForSeo();
  const site = resolveSeoSiteInfo(siteConfig);
  const customHeaderHtml = getTrimmedString(siteConfig?.CUSTOM_HEADER_HTML);
  const customFooterHtml = getTrimmedString(siteConfig?.CUSTOM_FOOTER_HTML);
  const customCss = getTrimmedString(siteConfig?.CUSTOM_CSS);
  const customJs = getTrimmedString(siteConfig?.CUSTOM_JS);
  const webSiteJsonLd =
    site.siteUrl && site.siteName
      ? buildWebSiteJsonLd(site.siteName, site.siteUrl, site.description)
      : null;

  return (
    <html lang="zh-CN" suppressHydrationWarning>
      <head>
        {webSiteJsonLd && (
          <script
            type="application/ld+json"
            dangerouslySetInnerHTML={{ __html: JSON.stringify(webSiteJsonLd) }}
          />
        )}
        {customCss && <style id="anheyu-custom-css" dangerouslySetInnerHTML={{ __html: customCss }} />}
        {customJs && <script id="anheyu-custom-js" dangerouslySetInnerHTML={{ __html: customJs }} />}
        {renderCustomHeadHtml(customHeaderHtml)}
      </head>
      <body className="antialiased min-h-screen flex flex-col">
        {/* 初始加载动画 - 纯 CSS + SVG，JS 加载前就显示，样式在 globals.css */}
        <div id="initial-loader" aria-label="加载中" role="status">
          <svg className="loader-spinner" viewBox="0 0 50 50" aria-hidden="true">
            <circle className="loader-bg" cx="25" cy="25" r="20" fill="none" strokeWidth="5" />
            <circle className="loader-inner" cx="25" cy="25" r="20" fill="none" strokeWidth="5" />
          </svg>
          <span className="sr-only">页面加载中</span>
        </div>
        <Providers>{children}</Providers>
        {renderCustomBodyHtml(customFooterHtml)}
      </body>
    </html>
  );
}
