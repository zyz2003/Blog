/**
 * AI 写作自定义块注册表（单一数据源）。
 *
 * 列出 AI 可产出的编辑器自定义块及其语法。后端用 buildBlockSyntaxGuide 把启用
 * 块的语法拼进系统提示词；前端 GET /api/ai/writing/blocks 拉这份注册表渲染后台开关。
 *
 * 渲染链路在 frontend marked-extensions + 各 TipTap 节点的 parseDOM，本文件只管"教 AI 语法"。
 *
 * streamable: true  -> 文本类，流式中途显源码、闭合时弹成块
 * streamable: false -> 需完整数据才能渲染（Mermaid），流式期前端 mask 成普通代码块
 */
export interface AiBlock {
  id: string;
  label: string;
  /** 给 AI 看的语法说明 */
  syntax: string;
  /** 给 AI 看的具体示例 */
  example: string;
  streamable: boolean;
}

export const AI_BLOCKS: AiBlock[] = [
  {
    id: "admonition",
    label: "提示框",
    syntax: "!!!note 标题 换行 正文 换行 !!!（类型: note/info/tip/success/warning/danger）",
    example: "!!!note 注意\n这是一段提示内容\n!!!",
    streamable: true,
  },
  {
    id: "folding",
    label: "折叠块",
    syntax: ":::folding 标题 换行 正文 换行 :::（标题后可加 open 默认展开、#颜色）",
    example: ":::folding 点击展开\n折叠的正文内容\n:::",
    streamable: true,
  },
  {
    id: "hidden",
    label: "隐藏块",
    syntax: ":::hidden 换行 正文 换行 :::（可加 display=按钮文字）",
    example: ":::hidden display=查看详情\n需要点击才显示的内容\n:::",
    streamable: true,
  },
  {
    id: "tabs",
    label: "标签页",
    syntax: ":::tabs 换行 == tab 标签1 换行 内容1 换行 == tab 标签2 换行 内容2 换行 :::",
    example: ":::tabs\n== tab 第一个\n内容一\n== tab 第二个\n内容二\n:::",
    streamable: true,
  },
  {
    id: "linkcard",
    label: "链接卡片",
    syntax: '{linkcard url="地址" title="标题" sitename="站点名"}{/linkcard}',
    example: '{linkcard url="https://example.com" title="示例链接" sitename="示例站"}{/linkcard}',
    streamable: true,
  },
  {
    id: "btn",
    label: "按钮",
    syntax: '{btn url="地址" text="按钮文字"}{/btn}',
    example: '{btn url="https://example.com" text="点击访问"}{/btn}',
    streamable: true,
  },
  {
    id: "tip",
    label: "提示标签",
    syntax: '{tip text="悬停文字" content="提示内容"}{/tip}',
    example: '{tip text="悬停看提示" content="这是提示内容"}{/tip}',
    streamable: true,
  },
  {
    id: "hide",
    label: "行内隐藏",
    syntax: '{hide display="按钮文字"}内容{/hide}',
    example: '{hide display="查看"}被隐藏的内容{/hide}',
    streamable: true,
  },
  {
    id: "inline-styles",
    label: "行内样式",
    syntax: "{u}下划线{/u} {emp}着重{/emp} {wavy}波浪{/wavy} {del}删除{/del} {kbd}按键{/kbd} {psw}密码{/psw}",
    example: "快捷键 {kbd}Ctrl+C{/kbd}，{wavy}波浪文字{/wavy}",
    streamable: true,
  },
  {
    id: "mermaid",
    label: "Mermaid 图",
    syntax: "```mermaid 换行 图代码 换行 ```（支持 flowchart/sequence/class/state 等）",
    example: "```mermaid\ngraph TD\nA-->B\nB-->C\n```",
    streamable: false,
  },
];

/** 默认启用全部高价值块 */
export const DEFAULT_ENABLED_BLOCK_IDS: string[] = AI_BLOCKS.map((b) => b.id);

/**
 * 解析 ai_writing_enabled_blocks 设置项。
 * - 空/未设置/非法 -> 默认全部（安全兜底）
 * - 合法数组（含空数组）-> 过滤到已知 id（空数组=不用自定义块，仅标准 Markdown）
 */
export function resolveEnabledBlockIds(raw: string | undefined): string[] {
  if (!raw || !raw.trim()) return DEFAULT_ENABLED_BLOCK_IDS;
  try {
    const ids = JSON.parse(raw);
    if (!Array.isArray(ids)) return DEFAULT_ENABLED_BLOCK_IDS;
    const known = AI_BLOCKS.map((b) => b.id);
    return ids.filter((id): id is string => typeof id === "string" && known.includes(id));
  } catch {
    return DEFAULT_ENABLED_BLOCK_IDS;
  }
}

/**
 * 把启用块拼成一段系统提示词指南。启用列表为空或过滤后为空则返回 ""（不追加）。
 */
export function buildBlockSyntaxGuide(enabledIds: string[]): string {
  if (enabledIds.length === 0) return "";
  const enabled = AI_BLOCKS.filter((b) => enabledIds.includes(b.id));
  if (enabled.length === 0) return "";
  const items = enabled.map((b, i) => {
    const ex = b.example.split("\n").map((l) => "   " + l).join("\n");
    return `${i + 1}. ${b.label} — ${b.syntax}\n   示例:\n${ex}`;
  });
  return "# 可用自定义语法\n\n你可使用以下语法（仅在合适时使用，不要滥用）：\n\n" + items.join("\n\n");
}
