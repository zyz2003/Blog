"use client";

import { useTheme } from "next-themes";
import { useEffect } from "react";
import { useSiteConfigStore } from "@/store/site-config-store";

/**
 * 按时间自动切换深色/浅色模式。
 *
 * 当站点配置 DEFAULT_THEME_MODE = "auto" 时生效。
 * 每分钟检查当前时间，在配置的时间点自动切换：
 *   - 浅色时段：lightHour ~ darkHour
 *   - 深色时段：darkHour ~ lightHour（跨天）
 *
 * 选了"自动"就是全自动，用户想手动控制请在后台改为 light/dark。
 */
export function AutoThemeSwitcher() {
  const { setTheme } = useTheme();
  const siteConfig = useSiteConfigStore(state => state.siteConfig);
  const isLoaded = useSiteConfigStore(state => state.isLoaded);

  useEffect(() => {
    if (!isLoaded || typeof window === "undefined") return;

    const mode = siteConfig?.DEFAULT_THEME_MODE;
    if (mode !== "auto") return;

    const themeAuto = (siteConfig as Record<string, any>)?.theme?.auto;
    const lightHour = parseInt(themeAuto?.light_hour || "8", 10);
    const darkHour = parseInt(themeAuto?.dark_hour || "20", 10);

    const check = () => {
      const hour = new Date().getHours();
      // lightHour < darkHour（如 8 < 20）：深色 = hour >= 20 || hour < 8
      // lightHour > darkHour（如 20 > 8，反转配置）：深色 = hour >= 8 && hour < 20 的反面
      const shouldBeDark =
        lightHour < darkHour
          ? hour >= darkHour || hour < lightHour
          : hour >= darkHour && hour < lightHour;
      setTheme(shouldBeDark ? "dark" : "light");
    };

    check();
    const interval = setInterval(check, 60000); // 每分钟检查一次

    return () => clearInterval(interval);
  }, [isLoaded, siteConfig, setTheme]);

  return null;
}
