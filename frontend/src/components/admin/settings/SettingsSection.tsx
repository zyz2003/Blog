/*
 * @Description:
 * @Author: 安知鱼
 * @Date: 2026-02-24 14:11:25
 * @LastEditTime: 2026-02-26 10:34:55
 * @LastEditors: 安知鱼
 */
"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

interface SettingsSectionProps {
  /** 区域标题（支持 ReactNode 以容纳徽章等富内容） */
  title: React.ReactNode;
  /** 区域描述 */
  description?: string;
  /** 副标题（折叠时也显示，用于摘要信息） */
  subtitle?: React.ReactNode;
  /** 子内容 */
  children: React.ReactNode;
  /** 额外 className */
  className?: string;
  /** 是否可折叠（默认 false，保持原行为） */
  collapsible?: boolean;
  /** 折叠状态（受控模式） */
  collapsed?: boolean;
  /** 折叠状态变更回调（受控模式） */
  onCollapsedChange?: (collapsed: boolean) => void;
  /** 默认是否折叠（非受控模式） */
  defaultCollapsed?: boolean;
}

/**
 * 设置表单区域分组组件
 * 用于将相关的设置项分组显示，采用简洁的视觉分隔
 */
export function SettingsSection({
  title,
  description,
  subtitle,
  children,
  className,
  collapsible = false,
  collapsed,
  onCollapsedChange,
  defaultCollapsed = false,
}: SettingsSectionProps) {
  const [internalCollapsed, setInternalCollapsed] = useState(defaultCollapsed);
  const isControlled = collapsed !== undefined;
  const isCollapsed = collapsible ? (isControlled ? collapsed! : internalCollapsed) : false;

  const toggleCollapsed = () => {
    const next = !isCollapsed;
    if (onCollapsedChange) onCollapsedChange(next);
    if (!isControlled) setInternalCollapsed(next);
  };

  return (
    <section
      className={cn(
        "rounded-xl border border-border/60 bg-card p-5 shadow-[0_1px_3px_rgba(0,0,0,0.04)] dark:shadow-none",
        className
      )}
    >
      <div
        className={cn(
          "border-b border-border/40",
          collapsible ? "flex items-center justify-between gap-3 cursor-pointer select-none pb-3 mb-4" : "pb-3 mb-4",
          isCollapsed && "mb-0 pb-0 border-b-0",
        )}
        onClick={collapsible ? toggleCollapsed : undefined}
      >
        <div className="min-w-0">
          <h3 className="text-[14px] font-semibold text-foreground/85 tracking-tight flex items-center gap-1.5 flex-wrap">{title}</h3>
          {subtitle && (
            <p className="text-xs text-muted-foreground mt-1 leading-relaxed truncate">{subtitle}</p>
          )}
          {description && !isCollapsed && (
            <p className="text-xs text-muted-foreground mt-1 leading-relaxed">{description}</p>
          )}
        </div>
        {collapsible && (
          <ChevronDown
            className={cn(
              "h-4 w-4 shrink-0 text-muted-foreground transition-transform",
              isCollapsed && "rotate-180",
            )}
          />
        )}
      </div>
      {!isCollapsed && <div className="space-y-5">{children}</div>}
    </section>
  );
}

interface SettingsFieldGroupProps {
  /** 子内容 */
  children: React.ReactNode;
  /** 列数 */
  cols?: 1 | 2 | 3;
  /** 额外 className */
  className?: string;
}

const colsClassMap = {
  1: "grid-cols-1",
  2: "grid-cols-1 md:grid-cols-2",
  3: "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3",
};

/**
 * 设置字段分组（用于并排显示多个字段）
 */
export function SettingsFieldGroup({ children, cols = 2, className }: SettingsFieldGroupProps) {
  return <div className={cn("grid gap-x-5 gap-y-5 min-w-0", colsClassMap[cols], className)}>{children}</div>;
}
