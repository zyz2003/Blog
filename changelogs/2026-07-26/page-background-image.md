# 页面背景图功能：所有前台页面支持全屏沉浸式背景图

## 目的

所有前台页面支持全屏沉浸式背景图，可配置"完整一图流"或"仅背景图"两种模式。
- `full`：全屏背景图 + 标题/副标题/打字机效果/滚动按钮（原有行为）
- `background-only`：只显示全屏背景图，不渲染文字层（新需求）

## 修改文件

### 1. `frontend/src/types/site-config.ts`

**`PageOneImageItem` 接口新增 `mode` 字段**

```diff
 export interface PageOneImageItem {
   enable?: boolean;
+  /** 显示模式：full=完整一图流（背景+标题/副标题/打字机），background-only=仅全屏背景图 */
+  mode?: "full" | "background-only";
   background?: string;
   // ... 其余字段不变
 }
```

**`page.one_image.config` 和 `oneImageConfig` 类型扩展路由键**

原来只支持 5 个页面（home/link/categories/tags/archives），现在扩展到所有前台页面：

新增路由键：`about`、`equipment`、`recentcomments`、`article-statistics`、`user-center`、`air-conditioner`、`update`

`oneImageConfig` 同步扩展。

### 2. `frontend/src/components/layout/OneImageBanner.tsx`

**`OneImageRouteKey` 和 `getRouteKey` 扩展**

```diff
-type OneImageRouteKey = "home" | "link" | "categories" | "tags" | "archives";
+type OneImageRouteKey =
+  | "home" | "link" | "categories" | "tags" | "archives"
+  | "about" | "equipment" | "recentcomments" | "article-statistics"
+  | "user-center" | "air-conditioner" | "update";
```

`getRouteKey` 新增 7 个路由映射（`/about`→`about`、`/equipment`→`equipment` 等）。

**`background-only` 模式：不渲染文字层**

```diff
   if (!isEnabled) return null;
+
+  // background-only 模式：只设置全屏背景（CSS 变量 + class 已在 useEffect 中处理），不渲染文字层
+  if (currentConfig?.mode === "background-only") return null;
+
   return (
```

原理：全屏背景图由 `useEffect` 控制（设置 `--one-image-background` CSS 变量 + `one-image-active` class），与组件 return 的 JSX 无关。`background-only` 模式下组件 return null，只保留背景效果。

### 3. `frontend/src/components/admin/settings/editors/OneImageConfigEditor.tsx`

**`ROUTE_KEYS` 扩展**

从 4 个页面扩展到 12 个，新增：`link`、`about`、`equipment`、`recentcomments`、`article-statistics`、`user-center`、`air-conditioner`、`update`

**`ROUTE_LABELS` 扩展**

| routeKey | 标签 |
|----------|------|
| `link` | 友链页 |
| `about` | 关于页 |
| `equipment` | 装备页 |
| `recentcomments` | 最近评论页 |
| `article-statistics` | 文章统计页 |
| `user-center` | 用户中心页 |
| `air-conditioner` | 小空调页 |
| `update` | 更新日志页 |

**`DEFAULT_ITEM` 新增 `mode: "full"` 默认值**

**`RouteCard` UI 修复（第二版）**

第一版存在的 UI 问题及修复：

1. **12 个卡片平铺无分组** → 按 `ROUTE_GROUPS` 分三组展示：主要页面、功能页面、其他页面，每组有小标题
2. **已启用/未启用/已配置但未启用 状态不区分** → 卡片样式区分：启用时主题色边框 + 浅色背景，未启用时灰色边框；有配置但未启用显示"未启用"黄色标签
3. **字段排列不合理，模式切换时布局跳动** → 按"基础配置"（模式+背景图）→ "移动端+媒体类型" → "full 专属"（标题/副标题/开关）分层排列，`background-only` 时整块隐藏而非逐个隐藏，避免布局跳动
4. **卡片样式偏重** → 从 `rounded-2xl` + `shadow-[0_8px_24px]` 改为 `rounded-xl` + 轻边框，更紧凑

## 未修改的文件

| 文件 | 原因 |
|------|------|
| `globals.css` | 全屏背景渲染机制（`::before` + CSS 变量）原封不动 |
| `setting-keys.ts` | 一图流配置是 JSON 整体存储，无需新 key |
| 后端 | JSON 字符串自然存取新字段，无需改动 |

## 向后兼容

- 无 `mode` 字段的老配置通过 `item.mode || "full"` 兜底为完整一图流
- 新增路由键都是可选字段，未配置时 `enable` 默认 false，不影响现有行为
- `enable=true` 且无 `mode` 等价于 `mode="full"`

## 使用方式

管理员在后台 **设置 → 页面样式 → 一图流配置** 里：
1. 展开目标页面的路由卡片
2. 开启启用开关
3. 选择显示模式："完整一图流" 或 "仅背景图"
4. 填写背景图 URL
5. 如果选"仅背景图"，标题/副标题/打字机等字段自动隐藏
