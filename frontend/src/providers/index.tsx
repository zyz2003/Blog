/*
 * @Description:
 * @Author: 安知鱼
 * @Date: 2026-01-30 16:54:59
 * @LastEditTime: 2026-02-04 10:51:16
 * @LastEditors: 安知鱼
 */
"use client";

import { ThemeProvider as NextThemesProvider } from "next-themes";
import type { ReactNode } from "react";
import { useEffect } from "react";
import { useSiteConfigStore } from "@/store/site-config-store";
import { subscribeSiteConfigUpdates } from "@/store/site-config-store";
import { useAuthStore } from "@/store/auth-store";
import { tokenManager } from "@/lib/api/client";
import { HeroUIProviderWrapper } from "./heroui-provider";
import { QueryProvider } from "./query-provider";
import { GlobalLoading } from "@/components/common/GlobalLoading";
import { DefaultThemeSync } from "./DefaultThemeSync";
import { SiteThemeColorsSync } from "./SiteThemeColorsSync";
import { ReducedMotionSync } from "./ReducedMotionSync";
import { VisitStatisticsTracker } from "./visit-statistics-tracker";

interface ProvidersProps {
  children: ReactNode;
}

const SSR_CRITICAL_SETTING_KEYS = new Set([
  "APP_NAME",
  "SUB_TITLE",
  "SITE_URL",
  "SITE_KEYWORDS",
  "SITE_DESCRIPTION",
  "FRONT_DESK_SITE_OWNER_NAME",
  "ICON_URL",
  "LOGO_URL",
  "LOGO_URL_192x192",
  "CUSTOM_HEADER_HTML",
  "CUSTOM_FOOTER_HTML",
  "CUSTOM_CSS",
  "CUSTOM_JS",
]);

/**
 * Auth Token 初始化器
 * 将 Zustand authStore 与 API Client 的 TokenManager 集成
 */
function AuthTokenInitializer({ children }: { children: ReactNode }) {
  const accessToken = useAuthStore(state => state.accessToken);
  const refreshToken = useAuthStore(state => state.refreshToken);
  const updateAccessToken = useAuthStore(state => state.updateAccessToken);
  const logout = useAuthStore(state => state.logout);
  const hasHydrated = useAuthStore(state => state._hasHydrated);

  useEffect(() => {
    // 等待 Zustand 水合完成后再初始化
    if (!hasHydrated) return;

    // 设置 token getter - 从 Zustand store 获取
    tokenManager.setTokenGetter(() => accessToken);
    tokenManager.setRefreshTokenGetter(() => refreshToken);

    // 设置 token clearer - 调用 Zustand logout
    tokenManager.setTokenClearer(() => logout());

    // 设置 token updater - 刷新 token 后更新 Zustand
    tokenManager.setTokenUpdater((token, expires) => updateAccessToken(token, expires));
  }, [hasHydrated, accessToken, refreshToken, updateAccessToken, logout]);

  // 监听 401 未授权事件
  useEffect(() => {
    const handleUnauthorized = () => {
      logout();
      // 可以在这里显示登录弹窗或跳转到登录页
      console.warn("[Auth] 登录已过期，请重新登录");
    };

    window.addEventListener("auth:unauthorized", handleUnauthorized);
    return () => {
      window.removeEventListener("auth:unauthorized", handleUnauthorized);
    };
  }, [logout]);

  return <>{children}</>;
}

/**
 * 站点配置加载器
 */
function SiteConfigLoader({ children }: { children: ReactNode }) {
  const fetchSiteConfig = useSiteConfigStore(state => state.fetchSiteConfig);

  useEffect(() => {
    fetchSiteConfig();
  }, [fetchSiteConfig]);

  return <>{children}</>;
}

function SiteConfigSyncListener() {
  useEffect(() => {
    return subscribeSiteConfigUpdates(async ({ updatedKeys }) => {
      const shouldReload =
        !updatedKeys?.length || updatedKeys.some(key => SSR_CRITICAL_SETTING_KEYS.has(key));

      if (shouldReload) {
        window.location.reload();
        return;
      }

      await useSiteConfigStore.getState().forceRefreshFromServer();
    });
  }, []);

  return null;
}

export function Providers({ children }: ProvidersProps) {
  return (
    <QueryProvider>
      <NextThemesProvider attribute="class" defaultTheme="system" enableSystem={true} disableTransitionOnChange={false}>
        <HeroUIProviderWrapper>
          <AuthTokenInitializer>
            <SiteConfigLoader>
              <SiteConfigSyncListener />
              <DefaultThemeSync />
              <SiteThemeColorsSync />
              <ReducedMotionSync />
              <GlobalLoading />
              <VisitStatisticsTracker />
              {children}
            </SiteConfigLoader>
          </AuthTokenInitializer>
        </HeroUIProviderWrapper>
      </NextThemesProvider>
    </QueryProvider>
  );
}
