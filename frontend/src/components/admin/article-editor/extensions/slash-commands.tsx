"use client";

import { Extension } from "@tiptap/core";
import Suggestion, { type SuggestionOptions, type SuggestionProps } from "@tiptap/suggestion";
import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useMemo,
  useState,
  useCallback,
  useRef,
} from "react";
import { createRoot, type Root } from "react-dom/client";
import tippy, { type Instance as TippyInstance } from "tippy.js";
import type { Editor, Range } from "@tiptap/core";
import {
  Heading1,
  Heading2,
  Heading3,
  Pilcrow,
  List,
  ListOrdered,
  ListChecks,
  Quote,
  Code,
  Minus,
  ImageIcon,
  Table,
  GitBranch,
  Sigma,
  FoldVertical,
  Columns3,
  CreditCard,
  MessageSquareWarning,
  EyeOff,
  Music,
  MousePointerClick,
  GalleryHorizontalEnd,
  Video,
  Coins,
  Lock,
  UserCheck,
  Sparkles,
  StickyNote,
  Lightbulb,
  TriangleAlert,
  ShieldAlert,
  type LucideIcon,
} from "lucide-react";

// ========================================
// 命令项定义
// ========================================

interface SlashCommandItem {
  title: string;
  description: string;
  icon: LucideIcon;
  group: string;
  aliases?: string[];
  action: (editor: Editor, range: Range) => void;
}

// 缓存命令列表，避免每次搜索都重新创建数组
const commandItemsCache = new Map<boolean, SlashCommandItem[]>();

/**
 * 获取所有可用的 Slash 命令列表（带缓存）
 * 分为文本、列表、插入、高级、PRO 五组
 */
function getSlashCommandItems(hasAIWriting: boolean): SlashCommandItem[] {
  const cached = commandItemsCache.get(hasAIWriting);
  if (cached) return cached;
  const cmds = (editor: Editor) =>
    editor.commands as Record<string, (...args: unknown[]) => boolean>;

  const items: SlashCommandItem[] = [
    // 文本
    {
      title: "正文",
      description: "普通段落文本",
      icon: Pilcrow,
      group: "文本",
      aliases: ["paragraph", "text", "p"],
      action: (editor, range) => {
        editor.chain().focus().deleteRange(range).setParagraph().run();
      },
    },
    {
      title: "标题 1",
      description: "大标题",
      icon: Heading1,
      group: "文本",
      aliases: ["h1", "heading1"],
      action: (editor, range) => {
        editor.chain().focus().deleteRange(range).setHeading({ level: 1 }).run();
      },
    },
    {
      title: "标题 2",
      description: "中标题",
      icon: Heading2,
      group: "文本",
      aliases: ["h2", "heading2"],
      action: (editor, range) => {
        editor.chain().focus().deleteRange(range).setHeading({ level: 2 }).run();
      },
    },
    {
      title: "标题 3",
      description: "小标题",
      icon: Heading3,
      group: "文本",
      aliases: ["h3", "heading3"],
      action: (editor, range) => {
        editor.chain().focus().deleteRange(range).setHeading({ level: 3 }).run();
      },
    },
    {
      title: "引用",
      description: "块引用文本",
      icon: Quote,
      group: "文本",
      aliases: ["blockquote", "quote"],
      action: (editor, range) => {
        editor.chain().focus().deleteRange(range).toggleBlockquote().run();
      },
    },

    // 列表
    {
      title: "无序列表",
      description: "创建无序列表",
      icon: List,
      group: "列表",
      aliases: ["bullet", "ul", "unordered"],
      action: (editor, range) => {
        editor.chain().focus().deleteRange(range).toggleBulletList().run();
      },
    },
    {
      title: "有序列表",
      description: "创建有序列表",
      icon: ListOrdered,
      group: "列表",
      aliases: ["numbered", "ol", "ordered"],
      action: (editor, range) => {
        editor.chain().focus().deleteRange(range).toggleOrderedList().run();
      },
    },
    {
      title: "任务列表",
      description: "创建待办清单",
      icon: ListChecks,
      group: "列表",
      aliases: ["todo", "task", "checklist"],
      action: (editor, range) => {
        editor.chain().focus().deleteRange(range).toggleTaskList().run();
      },
    },

    // 插入
    {
      title: "图片",
      description: "插入图片",
      icon: ImageIcon,
      group: "插入",
      aliases: ["image", "img", "photo"],
      action: (editor, range) => {
        editor.chain().focus().deleteRange(range).run();
        editor
          .chain()
          .insertContent({ type: "image", attrs: { src: "", alt: "" } })
          .run();
      },
    },
    {
      title: "代码块",
      description: "插入代码块",
      icon: Code,
      group: "插入",
      aliases: ["code", "codeblock", "pre"],
      action: (editor, range) => {
        editor.chain().focus().deleteRange(range).toggleCodeBlock().run();
      },
    },
    {
      title: "表格",
      description: "插入 3x3 表格",
      icon: Table,
      group: "插入",
      aliases: ["table", "grid"],
      action: (editor, range) => {
        editor
          .chain()
          .focus()
          .deleteRange(range)
          .insertTable({ rows: 3, cols: 3, withHeaderRow: true })
          .run();
      },
    },
    {
      title: "分割线",
      description: "插入水平分割线",
      icon: Minus,
      group: "插入",
      aliases: ["hr", "divider", "separator"],
      action: (editor, range) => {
        editor.chain().focus().deleteRange(range).setHorizontalRule().run();
      },
    },
    {
      title: "数学公式",
      description: "插入 KaTeX 数学公式",
      icon: Sigma,
      group: "插入",
      aliases: ["math", "katex", "formula", "latex"],
      action: (editor, range) => {
        editor.chain().focus().deleteRange(range).run();
        cmds(editor).insertMathBlock?.("E = mc^2");
      },
    },
    {
      title: "Mermaid 图表",
      description: "插入 Mermaid 流程图",
      icon: GitBranch,
      group: "插入",
      aliases: ["mermaid", "diagram", "flowchart"],
      action: (editor, range) => {
        editor.chain().focus().deleteRange(range).run();
        cmds(editor).insertMermaidBlock?.();
      },
    },

    // 高级
    {
      title: "折叠块",
      description: "可展开/折叠的内容块",
      icon: FoldVertical,
      group: "高级",
      aliases: ["fold", "collapse", "details", "accordion"],
      action: (editor, range) => {
        editor.chain().focus().deleteRange(range).run();
        cmds(editor).insertFoldingBlock?.();
      },
    },
    {
      title: "Tab 面板",
      description: "多标签页内容面板",
      icon: Columns3,
      group: "高级",
      aliases: ["tabs", "tab"],
      action: (editor, range) => {
        editor.chain().focus().deleteRange(range).run();
        cmds(editor).insertTabsBlock?.();
      },
    },
    {
      title: "链接卡片",
      description: "带预览的链接卡片",
      icon: CreditCard,
      group: "高级",
      aliases: ["linkcard", "card", "bookmark"],
      action: (editor, range) => {
        editor.chain().focus().deleteRange(range).run();
        cmds(editor).insertLinkCard?.();
      },
    },
    {
      title: "行内提示",
      description: "行内提示/注释（hover 弹出）",
      icon: MessageSquareWarning,
      group: "高级",
      aliases: ["callout", "tooltip"],
      action: (editor, range) => {
        editor.chain().focus().deleteRange(range).run();
        cmds(editor).insertCallout?.();
      },
    },
    {
      title: "注释框",
      description: "蓝色提示框（Note）",
      icon: StickyNote,
      group: "高级",
      aliases: ["note", "admonition"],
      action: (editor, range) => {
        editor.chain().focus().deleteRange(range).run();
        cmds(editor).insertAdmonition?.("note");
      },
    },
    {
      title: "提示框",
      description: "绿色提示框（Tip）",
      icon: Lightbulb,
      group: "高级",
      aliases: ["tip", "hint"],
      action: (editor, range) => {
        editor.chain().focus().deleteRange(range).run();
        cmds(editor).insertAdmonition?.("tip");
      },
    },
    {
      title: "警告框",
      description: "黄色警告框（Warning）",
      icon: TriangleAlert,
      group: "高级",
      aliases: ["warning", "caution"],
      action: (editor, range) => {
        editor.chain().focus().deleteRange(range).run();
        cmds(editor).insertAdmonition?.("warning");
      },
    },
    {
      title: "危险框",
      description: "红色危险框（Danger）",
      icon: ShieldAlert,
      group: "高级",
      aliases: ["danger", "error", "alert"],
      action: (editor, range) => {
        editor.chain().focus().deleteRange(range).run();
        cmds(editor).insertAdmonition?.("danger");
      },
    },
    {
      title: "隐藏内容",
      description: "默认隐藏的内容块",
      icon: EyeOff,
      group: "高级",
      aliases: ["hidden", "spoiler"],
      action: (editor, range) => {
        editor.chain().focus().deleteRange(range).run();
        cmds(editor).insertHiddenBlock?.();
      },
    },
    {
      title: "音乐播放器",
      description: "嵌入音乐播放器",
      icon: Music,
      group: "高级",
      aliases: ["music", "audio", "player"],
      action: (editor, range) => {
        editor.chain().focus().deleteRange(range).run();
        cmds(editor).insertMusicBlock?.();
      },
    },
    {
      title: "按钮",
      description: "可点击按钮",
      icon: MousePointerClick,
      group: "高级",
      aliases: ["button", "btn"],
      action: (editor, range) => {
        editor.chain().focus().deleteRange(range).run();
        cmds(editor).insertButton?.();
      },
    },
    {
      title: "图片画廊",
      description: "多图画廊展示",
      icon: GalleryHorizontalEnd,
      group: "高级",
      aliases: ["gallery", "images"],
      action: (editor, range) => {
        editor.chain().focus().deleteRange(range).run();
        cmds(editor).insertGallery?.();
      },
    },
    {
      title: "视频画廊",
      description: "多视频展示",
      icon: Video,
      group: "高级",
      aliases: ["videogallery", "videos"],
      action: (editor, range) => {
        editor.chain().focus().deleteRange(range).run();
        cmds(editor).insertVideoGallery?.();
      },
    },

    // PRO
    {
      title: "付费内容",
      description: "需付费才可查看",
      icon: Coins,
      group: "PRO",
      aliases: ["paid", "paywall"],
      action: (editor, range) => {
        editor.chain().focus().deleteRange(range).run();
        cmds(editor).insertPaidContent?.();
      },
    },
    {
      title: "密码保护",
      description: "需输入密码才可查看",
      icon: Lock,
      group: "PRO",
      aliases: ["password", "protected"],
      action: (editor, range) => {
        editor.chain().focus().deleteRange(range).run();
        cmds(editor).insertPasswordContent?.();
      },
    },
    {
      title: "登录可见",
      description: "需登录才可查看",
      icon: UserCheck,
      group: "PRO",
      aliases: ["login", "auth"],
      action: (editor, range) => {
        editor.chain().focus().deleteRange(range).run();
        cmds(editor).insertLoginRequiredContent?.();
      },
    },
  ];

  if (hasAIWriting) {
    items.push({
      title: "AI 写作",
      description: "使用 AI 辅助写作",
      icon: Sparkles,
      group: "AI",
      aliases: ["ai", "write", "generate"],
      action: (editor, range) => {
        editor.chain().focus().deleteRange(range).run();
      },
    });
  }

  commandItemsCache.set(hasAIWriting, items);
  return items;
}

// ========================================
// Slash 命令列表 React 组件
// ========================================

interface CommandListRef {
  onKeyDown: (props: { event: KeyboardEvent }) => boolean;
}

interface CommandListProps {
  items: SlashCommandItem[];
  command: (item: SlashCommandItem) => void;
}

interface GroupedItem {
  item: SlashCommandItem;
  flatIdx: number;
}

interface ItemGroup {
  name: string;
  items: GroupedItem[];
}

const CommandList = forwardRef<CommandListRef, CommandListProps>(
  ({ items, command }, ref) => {
    const [selectedIndex, setSelectedIndex] = useState(0);
    const scrollContainerRef = useRef<HTMLDivElement>(null);

    const groupedItems = useMemo<ItemGroup[]>(() => {
      const groups: ItemGroup[] = [];
      const groupMap = new Map<string, GroupedItem[]>();
      let idx = 0;
      for (const item of items) {
        if (!groupMap.has(item.group)) {
          const arr: GroupedItem[] = [];
          groupMap.set(item.group, arr);
          groups.push({ name: item.group, items: arr });
        }
        groupMap.get(item.group)!.push({ item, flatIdx: idx++ });
      }
      return groups;
    }, [items]);

    const selectItem = useCallback(
      (index: number) => {
        const item = items[index];
        if (item) command(item);
      },
      [items, command]
    );

    const getSafeIndex = useCallback(
      () => (items.length > 0 ? Math.min(selectedIndex, items.length - 1) : 0),
      [items.length, selectedIndex]
    );

    useImperativeHandle(ref, () => ({
      onKeyDown: ({ event }: { event: KeyboardEvent }) => {
        if (event.key === "ArrowUp") {
          setSelectedIndex((prev) => (prev - 1 + items.length) % items.length);
          return true;
        }
        if (event.key === "ArrowDown") {
          setSelectedIndex((prev) => (prev + 1) % items.length);
          return true;
        }
        if (event.key === "Enter") {
          selectItem(getSafeIndex());
          return true;
        }
        return false;
      },
    }), [items.length, selectItem, getSafeIndex]);

    const safeIndex = getSafeIndex();

    useEffect(() => {
      const container = scrollContainerRef.current;
      if (!container) return;
      const selectedEl = container.querySelector(`[data-index="${safeIndex}"]`);
      if (selectedEl) {
        selectedEl.scrollIntoView({ block: "nearest" });
      }
    }, [safeIndex]);

    if (items.length === 0) {
      return (
        <div className="bg-card border border-border rounded-lg shadow-lg p-3 min-w-[280px]">
          <span className="text-sm text-muted-foreground">无匹配命令</span>
        </div>
      );
    }

    return (
      <div
        ref={scrollContainerRef}
        role="listbox"
        aria-label="命令菜单"
        className="bg-card border border-border rounded-lg shadow-lg overflow-y-auto max-h-[320px] min-w-[280px] p-1"
      >
        {groupedItems.map(({ name: groupName, items: groupItems }) => (
          <div key={groupName} role="group" aria-label={groupName}>
            <div className="px-3 py-1.5 text-[10px] font-semibold text-muted-foreground/60 uppercase tracking-wider" aria-hidden="true">
              {groupName}
            </div>
            {groupItems.map(({ item, flatIdx }) => {
              const Icon = item.icon;
              const isSelected = flatIdx === safeIndex;
              return (
                <button
                  key={item.title}
                  type="button"
                  role="option"
                  aria-selected={isSelected}
                  data-index={flatIdx}
                  className={`w-full flex items-center gap-3 px-3 py-2 rounded-md text-left transition-colors ${
                    isSelected
                      ? "bg-secondary text-foreground"
                      : "hover:bg-muted/50 text-foreground"
                  }`}
                  onClick={() => selectItem(flatIdx)}
                  onMouseEnter={() => setSelectedIndex(flatIdx)}
                >
                  <div className="w-8 h-8 rounded-md bg-muted flex items-center justify-center shrink-0">
                    <Icon className="w-4 h-4 text-muted-foreground" />
                  </div>
                  <div className="flex flex-col min-w-0">
                    <span className="text-sm font-medium truncate">{item.title}</span>
                    <span className="text-xs text-muted-foreground truncate">
                      {item.description}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        ))}
      </div>
    );
  }
);

CommandList.displayName = "CommandList";

// ========================================
// Suggestion 渲染器（Tippy.js 弹出层）
// ========================================

type SuggestionRendererProps = SuggestionProps<SlashCommandItem>;

function createSuggestionRenderer() {
  return () => {
    let reactRoot: Root | null = null;
    let popup: TippyInstance | null = null;
    let component: CommandListRef | null = null;

    return {
      onStart: (props: SuggestionRendererProps) => {
        const container = document.createElement("div");
        container.className = "slash-command-popup";
        reactRoot = createRoot(container);

        reactRoot.render(
          <CommandList
            ref={(ref) => {
              component = ref;
            }}
            items={props.items}
            command={props.command}
          />
        );

        popup = tippy(document.body, {
          getReferenceClientRect: props.clientRect as () => DOMRect,
          appendTo: () => document.body,
          content: container,
          showOnCreate: true,
          interactive: true,
          trigger: "manual",
          placement: "bottom-start",
          maxWidth: "none",
          offset: [0, 8],
          popperOptions: {
            modifiers: [
              { name: "flip", options: { fallbackPlacements: ["top-start"] } },
            ],
          },
        });
      },

      onUpdate: (props: SuggestionRendererProps) => {
        if (!reactRoot) return;

        reactRoot.render(
          <CommandList
            ref={(ref) => {
              component = ref;
            }}
            items={props.items}
            command={props.command}
          />
        );

        if (popup && props.clientRect) {
          popup.setProps({
            getReferenceClientRect: props.clientRect as () => DOMRect,
          });
        }
      },

      onKeyDown: (props: { event: KeyboardEvent }) => {
        if (props.event.key === "Escape") {
          popup?.hide();
          return true;
        }
        return component?.onKeyDown(props) ?? false;
      },

      onExit: () => {
        popup?.destroy();
        setTimeout(() => {
          reactRoot?.unmount();
          reactRoot = null;
        }, 0);
        component = null;
      },
    };
  };
}

// ========================================
// Slash Commands 扩展
// ========================================

export interface SlashCommandsOptions {
  suggestion: Partial<SuggestionOptions<SlashCommandItem>>;
  hasAIWriting: boolean;
  onAIWriting?: () => void;
}

export const SlashCommands = Extension.create<SlashCommandsOptions>({
  name: "slashCommands",

  addOptions() {
    return {
      hasAIWriting: false,
      onAIWriting: undefined,
      suggestion: {},
    };
  },

  addProseMirrorPlugins() {
    const { hasAIWriting, onAIWriting } = this.options;

    return [
      Suggestion<SlashCommandItem>({
        editor: this.editor,
        char: "/",
        startOfLine: false,
        items: ({ query }) => {
          const allItems = getSlashCommandItems(hasAIWriting);
          if (!query) return allItems;

          const lowerQuery = query.toLowerCase();
          return allItems.filter((item) => {
            const titleMatch = item.title.toLowerCase().includes(lowerQuery);
            const descMatch = item.description.toLowerCase().includes(lowerQuery);
            const aliasMatch = item.aliases?.some((a) =>
              a.toLowerCase().includes(lowerQuery)
            );
            return titleMatch || descMatch || aliasMatch;
          });
        },
        render: createSuggestionRenderer(),
        command: ({ editor, range, props: item }) => {
          if (item.title === "AI 写作" && onAIWriting) {
            editor.chain().focus().deleteRange(range).run();
            onAIWriting();
            return;
          }
          item.action(editor, range);
        },
        ...this.options.suggestion,
      }),
    ];
  },
});
