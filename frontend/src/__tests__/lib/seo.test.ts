import { describe, expect, it } from "vitest";
import { buildPageMetadata, getFaviconContentType, resolveSeoSiteInfo } from "@/lib/seo";

describe("buildPageMetadata canonical policy", () => {
  it("noindex 页面默认不输出 canonical", async () => {
    const metadata = await buildPageMetadata({
      title: "登录",
      description: "登录页面",
      path: "/login",
      noindex: true,
      siteConfig: {
        APP_NAME: "安和鱼",
        SUB_TITLE: "生活明朗，万物可爱",
      },
    });

    expect(metadata.alternates).toBeUndefined();
    expect(metadata.robots).toMatchObject({
      index: false,
      follow: false,
    });
  });

  it("显式 includeCanonical=true 时 noindex 页面仍可输出 canonical", async () => {
    const metadata = await buildPageMetadata({
      title: "登录",
      description: "登录页面",
      path: "/login",
      noindex: true,
      includeCanonical: true,
      siteConfig: {
        APP_NAME: "安和鱼",
        SUB_TITLE: "生活明朗，万物可爱",
      },
    });

    expect(metadata.alternates).toMatchObject({
      canonical: "/login",
    });
  });
});

describe("buildPageMetadata homepage title", () => {
  it("首页使用站点名称和副标题作为绝对 title", async () => {
    const metadata = await buildPageMetadata({
      title: "安和鱼 - 生活明朗，万物可爱",
      path: "/",
      absoluteTitle: true,
      siteConfig: {
        APP_NAME: "安和鱼",
        SUB_TITLE: "生活明朗，万物可爱",
      },
    });

    expect(metadata.title).toEqual({ absolute: "安和鱼 - 生活明朗，万物可爱" });
    expect(metadata.openGraph?.title).toBe("安和鱼 - 生活明朗，万物可爱");
    expect(metadata.twitter?.title).toBe("安和鱼 - 生活明朗，万物可爱");
  });
});

describe("resolveSeoSiteInfo favicon URL", () => {
  it("preserves png favicon URLs and adds a cache-busting version", () => {
    const site = resolveSeoSiteInfo({
      ICON_URL: "https://blog.anheyu.com/api/f/ey9w6t/1782018466528632460.png",
    });

    expect(site.iconUrl).toBe("https://blog.anheyu.com/api/f/ey9w6t/1782018466528632460.png?v=1782018466528632460");
  });

  it("removes historical ArticleImage suffixes from favicon URLs", () => {
    const site = resolveSeoSiteInfo({
      ICON_URL: "/api/f/ey9w6t/1782018466528632460.png/ArticleImage",
    });

    expect(site.iconUrl).toBe("/api/f/ey9w6t/1782018466528632460.png?v=1782018466528632460");
  });
});

describe("getFaviconContentType", () => {
  it("detects icon MIME types after cache-busting query params are added", () => {
    expect(getFaviconContentType("/favicon.ico?v=custom")).toBe("image/x-icon");
    expect(getFaviconContentType("/logo.svg?v=custom")).toBe("image/svg+xml");
    expect(getFaviconContentType("/logo.png?v=custom")).toBe("image/png");
  });
});
