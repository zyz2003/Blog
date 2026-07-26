"use client";

import * as React from "react";
import { Input, Switch, Select, SelectItem } from "@heroui/react";
import { cn } from "@/lib/utils";
import type { PageOneImageItem } from "@/types/site-config";

// ─── 路由配置 ─────────────────────────────────────────────────────

const ROUTE_KEYS = [
  "home",
  "categories",
  "tags",
  "archives",
  "link",
  "about",
  "equipment",
  "recentcomments",
  "article-statistics",
  "user-center",
  "air-conditioner",
  "update",
] as const;

const ROUTE_LABELS: Record<(typeof ROUTE_KEYS)[number], string> = {
  home: "首页",
  categories: "分类页",
  tags: "标签页",
  archives: "归档页",
  link: "友链页",
  about: "关于页",
  equipment: "装备页",
  recentcomments: "最近评论页",
  "article-statistics": "文章统计页",
  "user-center": "用户中心页",
  "air-conditioner": "小空调页",
  update: "更新日志页",
};

/** 路由分组，方便 UI 按组展示 */
const ROUTE_GROUPS: { label: string; keys: readonly (typeof ROUTE_KEYS)[number][] }[] = [
  { label: "主要页面", keys: ["home", "archives", "categories", "tags"] },
  { label: "功能页面", keys: ["link", "about", "equipment", "recentcomments", "article-statistics", "user-center"] },
  { label: "其他页面", keys: ["air-conditioner", "update"] },
];

// ─── 默认值 ─────────────────────────────────────────────────────

const DEFAULT_ITEM: PageOneImageItem = {
  enable: false,
  mode: "full",
  background: "",
  mediaType: "image",
  mainTitle: "安和鱼",
  subTitle: "生活明朗，万物可爱",
  typingEffect: false,
  hitokoto: false,
  videoAutoplay: true,
  videoLoop: true,
  videoMuted: true,
  mobileBackground: "",
  mobileMediaType: "image",
  mobileVideoAutoplay: true,
  mobileVideoLoop: true,
  mobileVideoMuted: true,
};

// ─── 工具函数 ─────────────────────────────────────────────────────

function hasContent(item: PageOneImageItem): boolean {
  return !!(item.background || item.mobileBackground || item.enable);
}

// ─── 主组件 ──────────────────────────────────────────────────────

export interface OneImageConfigEditorProps {
  label?: string;
  description?: string;
  value?: string;
  onValueChange?: (value: string) => void;
  className?: string;
}

function parseConfig(value: string | undefined): Record<string, PageOneImageItem> {
  const result: Record<string, PageOneImageItem> = {};
  for (const key of ROUTE_KEYS) {
    result[key] = { ...DEFAULT_ITEM };
  }
  if (!value?.trim()) return result;
  try {
    const parsed = JSON.parse(value);
    if (typeof parsed !== "object" || parsed === null) return result;
    for (const key of ROUTE_KEYS) {
      const raw = parsed[key];
      result[key] = raw && typeof raw === "object" ? { ...DEFAULT_ITEM, ...raw } : { ...DEFAULT_ITEM };
    }
    return result;
  } catch {
    return result;
  }
}

function serializeConfig(config: Record<string, PageOneImageItem>): string {
  return JSON.stringify(config, null, 2);
}

export function OneImageConfigEditor({
  label,
  description,
  value,
  onValueChange,
  className,
}: OneImageConfigEditorProps) {
  const config = React.useMemo(() => parseConfig(value), [value]);

  const updateRoute = React.useCallback(
    (route: (typeof ROUTE_KEYS)[number], item: PageOneImageItem) => {
      const next = { ...config, [route]: item };
      onValueChange?.(serializeConfig(next));
    },
    [config, onValueChange]
  );

  const ensureRoute = (route: (typeof ROUTE_KEYS)[number]) => config[route] ?? { ...DEFAULT_ITEM };

  return (
    <div className={cn("flex flex-col gap-4", className)}>
      {label && <label className="text-sm font-semibold tracking-tight text-foreground/80">{label}</label>}
      {ROUTE_GROUPS.map(group => (
        <div key={group.label} className="space-y-2">
          <p className="text-xs font-medium text-muted-foreground/80 tracking-wide uppercase">{group.label}</p>
          <div className="flex flex-col gap-2">
            {group.keys.map(route => (
              <RouteCard
                key={route}
                route={route}
                label={ROUTE_LABELS[route]}
                item={ensureRoute(route)}
                onUpdate={item => updateRoute(route, item)}
              />
            ))}
          </div>
        </div>
      ))}
      {description && <p className="text-xs leading-relaxed text-muted-foreground">{description}</p>}
    </div>
  );
}

// ─── 输入框样式 ──────────────────────────────────────────────────

const inputWrapper = cn(
  "h-9 min-h-9 rounded-xl border border-border/60 bg-card shadow-none!",
  "data-[hover=true]:bg-card dark:data-[hover=true]:bg-muted data-[hover=true]:border-border/80",
  "group-data-[focus=true]:bg-card dark:group-data-[focus=true]:bg-muted group-data-[focus=true]:border-primary/65",
  "group-data-[focus=true]:ring-2 group-data-[focus=true]:ring-primary/15 transition-all duration-200"
);

// ─── RouteCard 组件 ──────────────────────────────────────────────

function RouteCard({
  label,
  item,
  onUpdate,
}: {
  route: string;
  label: string;
  item: PageOneImageItem;
  onUpdate: (item: PageOneImageItem) => void;
}) {
  const [expanded, setExpanded] = React.useState(false);
  const update = (patch: Partial<PageOneImageItem>) => onUpdate({ ...item, ...patch });
  const isBackgroundOnly = item.mode === "background-only";
  const effectiveMode = item.mode || "full";
  const configured = hasContent(item);

  return (
    <div className={cn(
      "overflow-hidden rounded-xl border transition-all duration-200",
      item.enable
        ? "border-primary/30 bg-primary/[0.02] shadow-[0_2px_8px_-4px_rgba(var(--color-primary),0.15)]"
        : "border-border/50 bg-background/95"
    )}>
      <button
        type="button"
        className="flex w-full items-center gap-2 px-3 py-2 text-left transition-colors hover:bg-muted/30"
        onClick={() => setExpanded(e => !e)}
      >
        <svg
          className={cn(
            "w-3.5 h-3.5 text-muted-foreground transition-transform duration-200 shrink-0",
            expanded && "rotate-90"
          )}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
        </svg>
        <span className="text-sm font-medium text-foreground/85">{label}</span>
        {/* 状态标签 */}
        {item.enable ? (
          <span className={cn(
            "rounded-full px-1.5 py-px text-[10px] font-medium",
            isBackgroundOnly
              ? "bg-primary/10 text-primary"
              : "bg-primary/10 text-primary"
          )}>
            {isBackgroundOnly ? "背景图" : "一图流"}
          </span>
        ) : configured ? (
          <span className="rounded-full px-1.5 py-px text-[10px] font-medium bg-warning/10 text-warning-600 dark:text-warning-400">
            未启用
          </span>
        ) : null}
        <div className="ml-auto flex items-center gap-2">
          <Switch
            size="sm"
            isSelected={!!item.enable}
            onValueChange={v => update({ enable: v })}
            onClick={e => e.stopPropagation()}
            aria-label={`启用${label}背景`}
            classNames={{ wrapper: "group-data-[selected=true]:bg-primary" }}
          />
        </div>
      </button>
      {expanded && (
        <div className="space-y-3 border-t border-border/40 bg-muted/20 px-3 py-3">
          {/* 基础配置行：模式 + 背景图 */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            <Select
              label="显示模式"
              labelPlacement="outside"
              size="sm"
              selectedKeys={[effectiveMode]}
              onSelectionChange={keys => {
                const k = Array.from(keys)[0];
                if (k) update({ mode: k as "full" | "background-only" });
              }}
              classNames={{ trigger: inputWrapper }}
            >
              <SelectItem key="full">完整一图流</SelectItem>
              <SelectItem key="background-only">仅背景图</SelectItem>
            </Select>
            <Input
              label="背景图 URL"
              labelPlacement="outside"
              size="sm"
              value={item.background ?? ""}
              onValueChange={v => update({ background: v })}
              placeholder="https://..."
              classNames={{ inputWrapper }}
            />
          </div>

          {/* 移动端 + 媒体类型 */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            <Input
              label="移动端背景 URL"
              labelPlacement="outside"
              size="sm"
              value={item.mobileBackground ?? ""}
              onValueChange={v => update({ mobileBackground: v })}
              placeholder="留空则使用桌面背景"
              classNames={{ inputWrapper }}
            />
            <Select
              label="媒体类型"
              labelPlacement="outside"
              size="sm"
              selectedKeys={[item.mediaType ?? "image"]}
              onSelectionChange={keys => {
                const k = Array.from(keys)[0];
                if (k) update({ mediaType: k as "image" | "video" });
              }}
              classNames={{ trigger: inputWrapper }}
            >
              <SelectItem key="image">图片</SelectItem>
              <SelectItem key="video">视频</SelectItem>
            </Select>
          </div>

          {/* full 模式专属字段 */}
          {!isBackgroundOnly && (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <Input
                  label="主标题"
                  labelPlacement="outside"
                  size="sm"
                  value={item.mainTitle ?? ""}
                  onValueChange={v => update({ mainTitle: v })}
                  placeholder="主标题"
                  classNames={{ inputWrapper }}
                />
                <Input
                  label="副标题"
                  labelPlacement="outside"
                  size="sm"
                  value={item.subTitle ?? ""}
                  onValueChange={v => update({ subTitle: v })}
                  placeholder="副标题"
                  classNames={{ inputWrapper }}
                />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <Select
                  label="移动端媒体类型"
                  labelPlacement="outside"
                  size="sm"
                  selectedKeys={[item.mobileMediaType ?? "image"]}
                  onSelectionChange={keys => {
                    const k = Array.from(keys)[0];
                    if (k) update({ mobileMediaType: k as "image" | "video" });
                  }}
                  classNames={{ trigger: inputWrapper }}
                >
                  <SelectItem key="image">图片</SelectItem>
                  <SelectItem key="video">视频</SelectItem>
                </Select>
              </div>
              <div className="flex flex-wrap gap-x-5 gap-y-2">
                <div className="flex items-center gap-1.5">
                  <Switch size="sm" isSelected={!!item.typingEffect} onValueChange={v => update({ typingEffect: v })} />
                  <span className="text-xs text-foreground/70">打字机效果</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <Switch size="sm" isSelected={!!item.hitokoto} onValueChange={v => update({ hitokoto: v })} />
                  <span className="text-xs text-foreground/70">一言</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <Switch
                    size="sm"
                    isSelected={item.videoAutoplay !== false}
                    onValueChange={v => update({ videoAutoplay: v })}
                  />
                  <span className="text-xs text-foreground/70">视频自动播放</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <Switch size="sm" isSelected={item.videoLoop !== false} onValueChange={v => update({ videoLoop: v })} />
                  <span className="text-xs text-foreground/70">视频循环</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <Switch size="sm" isSelected={item.videoMuted !== false} onValueChange={v => update({ videoMuted: v })} />
                  <span className="text-xs text-foreground/70">视频静音</span>
                </div>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
