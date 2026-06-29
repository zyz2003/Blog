export const RIGHT_MENU_RANDOM_PATH = "/random-post";

export interface RightMenuImageContext {
  src: string;
  filename?: string;
}

export interface RightMenuContext {
  textSelected: boolean;
  textInPostDetail: boolean;
  image: RightMenuImageContext | null;
  clickOnMusicPlayer: boolean;
  musicIsPlaying: boolean;
  hasCommentSection: boolean;
  commentBarrageVisible: boolean;
  darkMode: boolean;
}

export interface RightMenuItem {
  id:
    | "history-back"
    | "history-forward"
    | "refresh-page"
    | "scroll-top"
    | "copy-selected-text"
    | "quote-to-comment"
    | "search-local"
    | "search-baidu"
    | "open-image"
    | "copy-image-url"
    | "download-image"
    | "random-post"
    | "categories"
    | "tags"
    | "toggle-play-pause"
    | "previous-song"
    | "next-song"
    | "copy-song-name"
    | "copy-url"
    | "toggle-theme"
    | "toggle-comment-barrage";
  icon: `fa6-solid:${string}`;
  label?: string;
}

export interface RightMenuSection {
  id: "navigation" | "text" | "image" | "browse" | "music" | "common";
  compact?: boolean;
  items: RightMenuItem[];
}

const IMAGE_EXTENSIONS = /\.(avif|bmp|gif|jpe?g|png|svg|webp)$/i;

function sanitizeFilenamePart(value: string): string {
  return value.replace(/[<>:"/\\|?*\x00-\x1f]/g, "-").trim().slice(0, 120);
}

function getUrlPathname(value: string): string {
  try {
    return new URL(value, window.location.href).pathname;
  } catch {
    return value.split(/[?#]/, 1)[0] || "";
  }
}

function getImageExtension(src: string): string {
  const pathname = getUrlPathname(src);
  const match = pathname.match(IMAGE_EXTENSIONS);
  return match?.[1]?.toLowerCase() ?? "jpg";
}

function getUrlFilename(src: string): string {
  const pathname = getUrlPathname(src);
  const rawName = decodeURIComponent(pathname.split("/").filter(Boolean).pop() ?? "");
  return sanitizeFilenamePart(rawName) || `image.${getImageExtension(src)}`;
}

function getImageFilename(src: string, label?: string | null): string {
  const cleanLabel = label ? sanitizeFilenamePart(label) : "";
  if (!cleanLabel) {
    return getUrlFilename(src);
  }

  if (IMAGE_EXTENSIONS.test(cleanLabel)) {
    return cleanLabel;
  }

  return `${cleanLabel}.${getImageExtension(src)}`;
}

function getDataImageSrc(element: HTMLElement): string {
  return (
    element.getAttribute("data-src") ||
    element.getAttribute("data-original") ||
    element.getAttribute("data-lazy-src") ||
    element.getAttribute("data-image-src") ||
    ""
  );
}

function isImageUrl(value: string): boolean {
  if (!value) return false;
  if (value.startsWith("data:image/")) return true;
  return IMAGE_EXTENSIONS.test(getUrlPathname(value));
}

export function resolveImageContext(target: EventTarget | null): RightMenuImageContext | null {
  if (!(target instanceof HTMLElement)) {
    return null;
  }

  const image = target.closest("img");
  if (image instanceof HTMLImageElement) {
    const src = image.currentSrc || image.src || getDataImageSrc(image);
    if (!src) return null;

    const filename = getImageFilename(src, image.alt || image.title);
    return { src, filename };
  }

  const imageSourceElement = target.closest("[data-image-src], [data-src], [data-original], [data-lazy-src]");
  if (imageSourceElement instanceof HTMLElement) {
    const src = getDataImageSrc(imageSourceElement);
    if (isImageUrl(src)) {
      return {
        src,
        filename: getImageFilename(src, imageSourceElement.getAttribute("aria-label") || imageSourceElement.title),
      };
    }
  }

  const imageLink = target.closest("a[href]");
  if (imageLink instanceof HTMLAnchorElement && isImageUrl(imageLink.href)) {
    return {
      src: imageLink.href,
      filename: getImageFilename(
        imageLink.href,
        imageLink.download || imageLink.getAttribute("aria-label") || imageLink.title || imageLink.textContent
      ),
    };
  }

  return null;
}

export function getRightMenuSections(context: RightMenuContext): RightMenuSection[] {
  const sections: RightMenuSection[] = [
    {
      id: "navigation",
      compact: true,
      items: [
        { id: "history-back", icon: "fa6-solid:arrow-left" },
        { id: "history-forward", icon: "fa6-solid:arrow-right" },
        { id: "refresh-page", icon: "fa6-solid:arrow-rotate-right" },
        { id: "scroll-top", icon: "fa6-solid:arrow-up" },
      ],
    },
  ];

  if (context.textSelected) {
    sections.push({
      id: "text",
      items: [
        { id: "copy-selected-text", icon: "fa6-solid:copy", label: "复制选中文本" },
        ...(context.textInPostDetail
          ? [{ id: "quote-to-comment", icon: "fa6-solid:comment", label: "引用到评论" } as const]
          : []),
        { id: "search-local", icon: "fa6-solid:magnifying-glass", label: "站内搜索" },
        { id: "search-baidu", icon: "fa6-solid:magnifying-glass", label: "百度搜索" },
      ],
    });
  } else if (context.image) {
    sections.push({
      id: "image",
      items: [
        { id: "open-image", icon: "fa6-solid:up-right-from-square", label: "打开图片" },
        { id: "copy-image-url", icon: "fa6-solid:link", label: "复制图片地址" },
        { id: "download-image", icon: "fa6-solid:download", label: "下载图片" },
      ],
    });
  } else {
    sections.push({
      id: "browse",
      items: [
        { id: "random-post", icon: "fa6-solid:shuffle", label: "随便逛逛" },
        { id: "categories", icon: "fa6-solid:cube", label: "博客分类" },
        { id: "tags", icon: "fa6-solid:tags", label: "文章标签" },
      ],
    });
  }

  if (context.clickOnMusicPlayer) {
    sections.push({
      id: "music",
      items: [
        {
          id: "toggle-play-pause",
          icon: context.musicIsPlaying ? "fa6-solid:pause" : "fa6-solid:play",
          label: context.musicIsPlaying ? "暂停" : "播放",
        },
        { id: "previous-song", icon: "fa6-solid:backward-step", label: "上一首" },
        { id: "next-song", icon: "fa6-solid:forward-step", label: "下一首" },
        { id: "copy-song-name", icon: "fa6-solid:copy", label: "复制歌名" },
      ],
    });
  }

  sections.push({
    id: "common",
    items: [
      { id: "copy-url", icon: "fa6-solid:copy", label: "复制地址" },
      {
        id: "toggle-theme",
        icon: "fa6-solid:circle-half-stroke",
        label: context.darkMode ? "浅色模式" : "深色模式",
      },
      ...(context.hasCommentSection
        ? [
            {
              id: "toggle-comment-barrage",
              icon: "fa6-solid:comments",
              label: context.commentBarrageVisible ? "隐藏热评" : "显示热评",
            } as const,
          ]
        : []),
    ],
  });

  return sections;
}
