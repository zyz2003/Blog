"use client";

import { useEffect, useRef } from "react";
import { useSiteConfigStore } from "@/store/site-config-store";

/** 系统默认字体栈（兜底） */
const SYSTEM_FONT_STACK =
  '-apple-system, BlinkMacSystemFont, "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", "Helvetica Neue", Helvetica, Arial, sans-serif';

/** 自定义字体 key 前缀 */
const CUSTOM_FONT_KEY_PREFIX = "custom:";

/**
 * 字体 key → font-family 映射（系统字体不需要 CDN）
 */
const FONT_MAP: Record<string, string> = {
  "system": "",
  "pingfang-sc": '"PingFang SC"',
  "microsoft-yahei": '"Microsoft YaHei"',
  "harmonyos-sans": '"HarmonyOS Sans"',
  "noto-sans-sc": '"Noto Sans SC"',
  "simhei": '"SimHei"',
  "simsun": '"SimSun"',
  "kaiti": '"KaiTi"',
  "stheiti": '"STHeiti"',
  "stsong": '"STSong"',
};

const FONT_LINK_ID = "custom-font-stylesheet";

interface CustomFontItem {
  name: string;
  cssUrl: string;
}

/**
 * 字体加载器：根据后台配置动态设置 font-family 或加载 CDN 字体切片 CSS。
 * - system / 系统字体 → 不加载 CDN，只调整 font-family 优先级
 * - custom:N → 从自定义字体列表中读取第 N 项，动态插入 <link>
 */
export function FontLoader() {
  const siteConfig = useSiteConfigStore(state => state.siteConfig);
  const prevFontKeyRef = useRef<string | null>(null);

  useEffect(() => {
    const fontKey = siteConfig?.site?.font || "system";
    // 避免重复执行相同字体 key
    if (fontKey === prevFontKeyRef.current) return;
    prevFontKeyRef.current = fontKey;

    // 清理旧的字体 link
    const oldLink = document.getElementById(FONT_LINK_ID);
    if (oldLink) oldLink.remove();

    // 纯系统默认 → 清除自定义字体变量
    if (fontKey === "system") {
      document.documentElement.style.removeProperty("--custom-body-font");
      return;
    }

    // 自定义字体列表项 (custom:0, custom:1, ...)
    if (fontKey.startsWith(CUSTOM_FONT_KEY_PREFIX)) {
      const index = parseInt(fontKey.slice(CUSTOM_FONT_KEY_PREFIX.length), 10);
      const customList = siteConfig?.site?.font_custom_list;
      const font = Array.isArray(customList) ? customList[index] : undefined;

      if (!font || !font.name || !font.cssUrl) {
        document.documentElement.style.removeProperty("--custom-body-font");
        return;
      }

      const link = document.createElement("link");
      link.id = FONT_LINK_ID;
      link.rel = "stylesheet";
      link.href = font.cssUrl;
      document.head.appendChild(link);

      document.documentElement.style.setProperty(
        "--custom-body-font",
        `"${font.name}", ${SYSTEM_FONT_STACK}`,
      );
      return;
    }

    // 系统字体预设
    const family = FONT_MAP[fontKey];
    if (family === undefined) {
      document.documentElement.style.removeProperty("--custom-body-font");
      return;
    }

    if (family === "") {
      // "system" 选项
      document.documentElement.style.removeProperty("--custom-body-font");
      return;
    }

    // 系统字体：只设 font-family，不加载 CDN
    document.documentElement.style.setProperty(
      "--custom-body-font",
      `${family}, ${SYSTEM_FONT_STACK}`,
    );
  }, [siteConfig?.site?.font, siteConfig?.site?.font_custom_list]);

  return null;
}
