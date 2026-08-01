"use client";

import { useCallback, useMemo, useState } from "react";
import { FormInput } from "@/components/ui/form-input";
import { FormSwitch } from "@/components/ui/form-switch";
import { FormCodeEditor } from "@/components/ui/form-code-editor";
import { FormSelect, FormSelectItem } from "@/components/ui/form-select";
import { OneImageConfigEditor } from "./editors/OneImageConfigEditor";
import { SettingsSection } from "./SettingsSection";
import { Spinner } from "@/components/ui/spinner";
import {
  KEY_ENABLE_EXTERNAL_LINK_WARNING,
  KEY_DISABLE_RIGHT_MENU,
  KEY_CUSTOM_HEADER_HTML,
  KEY_CUSTOM_FOOTER_HTML,
  KEY_CUSTOM_CSS,
  KEY_CUSTOM_JS,
  KEY_CUSTOM_POST_TOP_HTML,
  KEY_CUSTOM_POST_BOTTOM_HTML,
  KEY_PAGE_ONE_IMAGE_CONFIG,
  KEY_HITOKOTO_API,
  KEY_TYPING_SPEED,
  KEY_TYPING_DELETE_SPEED,
  KEY_TYPING_HOLD_TIME,
  KEY_TYPING_GAP_TIME,
  KEY_SITE_FONT,
  KEY_SITE_FONT_CUSTOM_LIST,
} from "@/lib/settings/setting-keys";

interface CustomFontItem {
  name: string;
  cssUrl: string;
}

function parseCustomFontList(raw: string | undefined): CustomFontItem[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (item: unknown): item is CustomFontItem =>
        typeof item === "object" && item !== null && typeof (item as CustomFontItem).name === "string" && typeof (item as CustomFontItem).cssUrl === "string",
    );
  } catch {
    return [];
  }
}

interface PageStyleFormProps {
  values: Record<string, string>;
  onChange: (key: string, value: string) => void;
  loading?: boolean;
}

export function PageStyleForm({ values, onChange, loading }: PageStyleFormProps) {
  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Spinner />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* 页面功能 */}
      <SettingsSection title="页面功能">
        <FormSwitch
          label="外部链接跳转提醒"
          description="开启后，点击外部链接时会显示中间提示页面，提醒用户即将跳转到外部网站，倒计时 5 秒后自动跳转。支持「本次会话不再提示」选项。"
          checked={values[KEY_ENABLE_EXTERNAL_LINK_WARNING] === "true"}
          onCheckedChange={v => onChange(KEY_ENABLE_EXTERNAL_LINK_WARNING, String(v))}
        />

        <FormSwitch
          label="关闭右键菜单"
          description="开启后，全站不再显示本站自定义右键菜单，访客右键时使用浏览器原生菜单。关闭后保留本站右键菜单和访客本地快捷键偏好。"
          checked={values[KEY_DISABLE_RIGHT_MENU] === "true"}
          onCheckedChange={v => onChange(KEY_DISABLE_RIGHT_MENU, String(v))}
        />
      </SettingsSection>

      {/* 一图流配置 */}
      <SettingsSection title="一图流配置">
        <OneImageConfigEditor
          label="一图流配置"
          value={values[KEY_PAGE_ONE_IMAGE_CONFIG]}
          onValueChange={v => onChange(KEY_PAGE_ONE_IMAGE_CONFIG, v)}
          description="按页面（首页/分类/标签/归档）配置一图流启用、背景、媒体类型与视频选项"
        />

        <FormInput
          label="一言 API"
          placeholder="https://v1.hitokoto.cn"
          value={values[KEY_HITOKOTO_API]}
          onValueChange={v => onChange(KEY_HITOKOTO_API, v)}
          description="一言（Hitokoto）API 地址"
        />

        <div>
          <p className="text-xs text-muted-foreground mb-2">打字机节奏（毫秒，留空使用默认值）</p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <FormInput
              label="打字速度"
              placeholder="100"
              value={values[KEY_TYPING_SPEED]}
              onValueChange={v => onChange(KEY_TYPING_SPEED, v)}
            />
            <FormInput
              label="删除速度"
              placeholder="50"
              value={values[KEY_TYPING_DELETE_SPEED]}
              onValueChange={v => onChange(KEY_TYPING_DELETE_SPEED, v)}
            />
            <FormInput
              label="打完停留"
              placeholder="1500"
              value={values[KEY_TYPING_HOLD_TIME]}
              onValueChange={v => onChange(KEY_TYPING_HOLD_TIME, v)}
            />
            <FormInput
              label="删完停留"
              placeholder="500"
              value={values[KEY_TYPING_GAP_TIME]}
              onValueChange={v => onChange(KEY_TYPING_GAP_TIME, v)}
            />
          </div>
        </div>
      </SettingsSection>

      {/* 字体配置 */}
      <FontConfigSection values={values} onChange={onChange} />

      {/* 自定义代码注入 */}
      <SettingsSection title="自定义代码注入">
        <FormCodeEditor
          label="头部 HTML"
          value={values[KEY_CUSTOM_HEADER_HTML]}
          onValueChange={v => onChange(KEY_CUSTOM_HEADER_HTML, v)}
          language="html"
          description="注入到 <head> 标签内的自定义 HTML 代码，支持 <script>、<link>、<meta> 等标签。如需引入外部 JS 文件，请在此处添加 <script src='...'></script>"
        />

        <FormCodeEditor
          label="底部 HTML"
          value={values[KEY_CUSTOM_FOOTER_HTML]}
          onValueChange={v => onChange(KEY_CUSTOM_FOOTER_HTML, v)}
          language="html"
          description="注入到 <body> 底部的自定义 HTML 代码，支持 <script>、<div> 等标签。如需引入外部 JS 文件，也可在此处添加 <script src='...'></script>"
        />

        <FormCodeEditor
          label="自定义 CSS"
          value={values[KEY_CUSTOM_CSS]}
          onValueChange={v => onChange(KEY_CUSTOM_CSS, v)}
          language="css"
          description="全站生效的自定义 CSS 样式，直接填写 CSS 代码即可，无需包裹 <style> 标签"
        />

        <FormCodeEditor
          label="自定义 JavaScript"
          value={values[KEY_CUSTOM_JS]}
          onValueChange={v => onChange(KEY_CUSTOM_JS, v)}
          language="javascript"
          description="全站生效的自定义 JavaScript 代码，直接填写 JS 代码即可，无需包裹 <script> 标签。如需引入外部 JS 文件请使用上方的「头部 HTML」或「底部 HTML」"
        />

        <FormCodeEditor
          label="文章顶部 HTML"
          value={values[KEY_CUSTOM_POST_TOP_HTML]}
          onValueChange={v => onChange(KEY_CUSTOM_POST_TOP_HTML, v)}
          language="html"
          description="注入到每篇文章顶部的自定义 HTML 代码"
        />

        <FormCodeEditor
          label="文章底部 HTML"
          value={values[KEY_CUSTOM_POST_BOTTOM_HTML]}
          onValueChange={v => onChange(KEY_CUSTOM_POST_BOTTOM_HTML, v)}
          language="html"
          description="注入到每篇文章底部的自定义 HTML 代码"
        />
      </SettingsSection>
    </div>
  );
}

/** 自定义字体 key 前缀，用于区分自定义字体选项 */
const CUSTOM_FONT_KEY_PREFIX = "custom:";

/** 系统字体选项 */
const SYSTEM_FONT_OPTIONS = [
  { key: "system", label: "系统默认" },
  { key: "pingfang-sc", label: "PingFang SC（系统默认）" },
  { key: "microsoft-yahei", label: "Microsoft YaHei（系统默认）" },
  { key: "harmonyos-sans", label: "HarmonyOS Sans（系统默认）" },
  { key: "noto-sans-sc", label: "Noto Sans SC（系统默认）" },
  { key: "simhei", label: "SimHei（系统默认）" },
  { key: "simsun", label: "SimSun（系统默认）" },
  { key: "kaiti", label: "KaiTi（系统默认）" },
  { key: "stheiti", label: "STHeiti（系统默认）" },
  { key: "stsong", label: "STSong（系统默认）" },
];

function FontConfigSection({ values, onChange }: PageStyleFormProps) {
  const customFontList = useMemo(
    () => parseCustomFontList(values[KEY_SITE_FONT_CUSTOM_LIST]),
    [values[KEY_SITE_FONT_CUSTOM_LIST]],
  );

  // 新增自定义字体的临时输入
  const [newName, setNewName] = useState("");
  const [newCssUrl, setNewCssUrl] = useState("");

  const currentFontKey = values[KEY_SITE_FONT] || "system";

  const handleAddCustomFont = useCallback(() => {
    const name = newName.trim();
    const cssUrl = newCssUrl.trim();
    if (!name || !cssUrl) return;
    const updated = [...customFontList, { name, cssUrl }];
    onChange(KEY_SITE_FONT_CUSTOM_LIST, JSON.stringify(updated));
    setNewName("");
    setNewCssUrl("");
  }, [newName, newCssUrl, customFontList, onChange]);

  const handleRemoveCustomFont = useCallback(
    (index: number) => {
      const updated = customFontList.filter((_, i) => i !== index);
      onChange(KEY_SITE_FONT_CUSTOM_LIST, JSON.stringify(updated));
      // 如果删除的是当前选中的字体，回退到系统默认
      const removedKey = `${CUSTOM_FONT_KEY_PREFIX}${index}`;
      if (currentFontKey === removedKey) {
        onChange(KEY_SITE_FONT, "system");
      }
    },
    [customFontList, currentFontKey, onChange],
  );

  return (
    <SettingsSection title="字体配置">
      <FormSelect
        label="全站字体"
        description="系统默认字体无需加载额外资源（性能最优），选择后会优先使用该字体并回退到系统字体栈"
        value={currentFontKey}
        onValueChange={v => onChange(KEY_SITE_FONT, v)}
      >
        {[
          ...SYSTEM_FONT_OPTIONS.map(opt => ({ key: opt.key, label: opt.label })),
          ...customFontList.map((font, index) => ({ key: `${CUSTOM_FONT_KEY_PREFIX}${index}`, label: font.name })),
        ].map(opt => (
          <FormSelectItem key={opt.key}>{opt.label}</FormSelectItem>
        ))}
      </FormSelect>

      {/* 自定义字体列表管理 */}
      <div className="space-y-3">
        <p className="text-xs text-muted-foreground">
          管理自定义字体（需 CDN 切片 CSS 地址，添加后可在上方下拉中选择）
        </p>

        {customFontList.length > 0 && (
          <div className="space-y-2">
            {customFontList.map((font, index) => (
              <div
                key={index}
                className="flex items-center gap-2 rounded-md border border-border bg-muted/30 px-3 py-2 text-sm"
              >
                <div className="flex-1 min-w-0">
                  <span className="font-medium">{font.name}</span>
                  <span className="text-muted-foreground ml-2 truncate inline-block max-w-[300px] align-bottom">
                    {font.cssUrl}
                  </span>
                </div>
                <button
                  type="button"
                  className="shrink-0 text-muted-foreground hover:text-destructive transition-colors"
                  onClick={() => handleRemoveCustomFont(index)}
                  title="删除此字体"
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
        )}

        {/* 添加新自定义字体 */}
        <div className="flex items-end gap-2">
          <div className="flex-1 min-w-0">
            <FormInput
              label="字体名称"
              placeholder="如 zihunbaigetianxingti"
              value={newName}
              onValueChange={setNewName}
            />
          </div>
          <div className="flex-[2] min-w-0">
            <FormInput
              label="CSS 地址"
              placeholder="https://cdn.jsdmirror.com/.../index.css"
              value={newCssUrl}
              onValueChange={setNewCssUrl}
            />
          </div>
          <button
            type="button"
            className="shrink-0 h-9 px-3 rounded-md bg-primary text-primary-foreground text-sm font-medium disabled:opacity-50"
            disabled={!newName.trim() || !newCssUrl.trim()}
            onClick={handleAddCustomFont}
          >
            添加
          </button>
        </div>
      </div>
    </SettingsSection>
  );
}
