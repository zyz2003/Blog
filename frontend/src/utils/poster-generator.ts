/**
 * 海报生成工具函数
 * 与 anheyu-app 实现一致
 */

import QRCode from "qrcode";
import { BUILTIN_POST_DEFAULT_COVER_PATH } from "@/utils/same-origin-media-url";

/**
 * 海报生成配置
 */
export interface PosterConfig {
  title: string; // 文章标题
  description?: string; // 文章简介
  author: string; // 作者名称
  authorAvatar?: string; // 作者头像URL
  siteName?: string; // 站点名称
  siteSubtitle?: string; // 站点副标题
  articleUrl: string; // 文章URL
  coverImage?: string; // 文章封面图
  publishDate?: string; // 文章发布时间
}

/**
 * 与文章详情 PostHeader / 列表卡片一致：优先 top_img_url，其次 cover_url，再无则站点默认封面，最后内置占位图。
 * 保证分享海报在无自定义封面时仍能绘制与前台一致的默认封面区域。
 */
export function getPosterCoverImageUrl(
  article: {
    top_img_url?: string;
    cover_url?: string;
  },
  defaultCoverUrl?: string
): string {
  const raw = (article.top_img_url || article.cover_url || "").trim();
  if (raw !== "") {
    return raw;
  }
  const configured = (defaultCoverUrl || "").trim();
  return configured !== "" ? configured : BUILTIN_POST_DEFAULT_COVER_PATH;
}

function isInlineImageUrl(url: string): boolean {
  return url.startsWith("data:") || url.startsWith("blob:");
}

type ImageFetchCandidate = {
  url: string;
  mode: RequestMode;
  credentials: RequestCredentials;
};

/**
 * 为海报图片构造 fetch 候选。
 * 跨域 HTTP(S) 图优先走本站代理；代理不可用时再尝试 CORS 直取，覆盖图床本身已开放 CORS 的场景。
 */
function getImageFetchCandidates(imageUrl: string): ImageFetchCandidate[] {
  const trimmed = imageUrl.trim();
  if (trimmed === "" || isInlineImageUrl(trimmed)) {
    return [];
  }
  if (typeof window === "undefined") {
    return [{ url: trimmed, mode: "cors", credentials: "omit" }];
  }

  try {
    const resolved = new URL(trimmed, window.location.href);
    if (resolved.origin === window.location.origin) {
      return [{ url: trimmed, mode: "same-origin", credentials: "same-origin" }];
    }
    if (resolved.protocol !== "http:" && resolved.protocol !== "https:") {
      return [{ url: trimmed, mode: "cors", credentials: "omit" }];
    }

    const candidates: ImageFetchCandidate[] = [];
    if (!trimmed.includes("/api/proxy/download?")) {
      candidates.push({
        url: `/api/proxy/download?url=${encodeURIComponent(resolved.href)}`,
        mode: "same-origin",
        credentials: "same-origin",
      });
    }
    candidates.push({ url: resolved.href, mode: "cors", credentials: "omit" });
    return candidates;
  } catch {
    return [{ url: trimmed, mode: "cors", credentials: "omit" }];
  }
}

function loadImageElement(url: string, crossOrigin: boolean): Promise<HTMLImageElement> {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image();
    if (crossOrigin) {
      img.crossOrigin = "anonymous";
    }
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`Image load failed: ${url}`));
    img.src = url;
  });
}

/**
 * 加载图片时统一转为 Blob URL 后绘制。
 * 代理与 CORS 直取都失败时交给调用方降级占位，避免回退到远程 img 后污染 Canvas。
 */
async function loadImage(url: string): Promise<HTMLImageElement> {
  const trimmed = url.trim();

  if (!isInlineImageUrl(trimmed)) {
    const candidates = getImageFetchCandidates(trimmed);
    let lastError: unknown;

    for (const candidate of candidates) {
      try {
        const res = await fetch(candidate.url, {
          mode: candidate.mode,
          credentials: candidate.credentials,
          cache: "no-store",
        });
        if (!res.ok) {
          throw new Error(`Image fetch failed: ${res.status}`);
        }
        const blob = await res.blob();
        const blobUrl = URL.createObjectURL(blob);
        try {
          return await loadImageElement(blobUrl, false);
        } finally {
          URL.revokeObjectURL(blobUrl);
        }
      } catch (error) {
        lastError = error;
      }
    }

    if (lastError instanceof Error) {
      throw lastError;
    }
    throw new Error(`Image load failed: ${trimmed}`);
  }

  return loadImageElement(trimmed, false);
}

/**
 * 在圆形区域内绘制头像：从图源取中心正方形区域再缩放（等同 object-fit: cover），避免非正方形图片被压扁。
 */
function drawCircleAvatar(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  radius: number,
  image: HTMLImageElement
) {
  const iw = image.naturalWidth || image.width;
  const ih = image.naturalHeight || image.height;
  if (iw <= 0 || ih <= 0) {
    return;
  }

  let sx = 0;
  let sy = 0;
  let sSide = 0;
  if (iw >= ih) {
    sSide = ih;
    sx = (iw - ih) / 2;
    sy = 0;
  } else {
    sSide = iw;
    sx = 0;
    sy = (ih - iw) / 2;
  }

  const d = radius * 2;
  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, radius, 0, Math.PI * 2);
  ctx.closePath();
  ctx.clip();
  ctx.drawImage(image, sx, sy, sSide, sSide, cx - radius, cy - radius, d, d);
  ctx.restore();
}

/**
 * 文字换行处理
 */
function wrapText(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
  lineHeight: number,
  maxLines?: number
): number {
  const words = text.split("");
  let line = "";
  let currentY = y;
  let lineCount = 1;

  for (let i = 0; i < words.length; i++) {
    const testLine = line + words[i];
    const metrics = ctx.measureText(testLine);
    const testWidth = metrics.width;

    if (testWidth > maxWidth && i > 0) {
      ctx.fillText(line, x, currentY);
      line = words[i];
      lineCount++;
      if (maxLines && lineCount >= maxLines) {
        let lastLine = line;
        while (ctx.measureText(lastLine + "...").width > maxWidth && lastLine.length > 0) {
          lastLine = lastLine.slice(0, -1);
        }
        ctx.fillText(lastLine + "...", x, currentY + lineHeight);
        return currentY + lineHeight;
      }
      currentY += lineHeight;
    } else {
      line = testLine;
    }
  }
  if (line.length > 0) {
    ctx.fillText(line, x, currentY);
  }
  return currentY;
}

function truncateText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string {
  const normalized = text.trim();
  if (normalized === "" || maxWidth <= 0) {
    return "";
  }

  if (ctx.measureText(normalized).width <= maxWidth) {
    return normalized;
  }

  const ellipsis = "...";
  if (ctx.measureText(ellipsis).width > maxWidth) {
    return "";
  }

  let end = normalized.length;
  while (end > 0 && ctx.measureText(`${normalized.slice(0, end)}${ellipsis}`).width > maxWidth) {
    end--;
  }

  return end > 0 ? `${normalized.slice(0, end)}${ellipsis}` : "";
}

/**
 * 生成文章分享海报
 */
export async function generatePoster(config: PosterConfig): Promise<string> {
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    throw new Error("无法创建 Canvas 上下文");
  }

  // 海报尺寸（竖版，适合手机分享）
  const width = 750;
  const height = 1000;
  canvas.width = width;
  canvas.height = height;

  // 背景色
  const bgColor = "#ffffff";
  const primaryColor = "#3b82f6";
  const textColor = "#1f2937";
  const secondaryTextColor = "#6b7280";

  // 绘制背景
  ctx.fillStyle = bgColor;
  ctx.fillRect(0, 0, width, height);

  // 绘制封面图（无图、加载失败时与成功时使用同一封面区高度，避免默认封面 404 时顶部只剩窄条）
  let coverY = 0;
  const coverHeight = 420;

  /**
   * 在海报顶部绘制与「无自定义封面」一致的渐变占位块。
   */
  const drawFallbackCoverBand = () => {
    const gradient = ctx.createLinearGradient(0, 0, width, coverHeight);
    gradient.addColorStop(0, primaryColor);
    gradient.addColorStop(1, "#60a5fa");
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, width, coverHeight);
    coverY = coverHeight;
  };

  const coverSrc = (config.coverImage || "").trim();
  if (coverSrc !== "") {
    try {
      const coverImg = await loadImage(coverSrc);
      const coverWidth = width;

      const imgAspectRatio = coverImg.width / coverImg.height;
      const targetAspectRatio = coverWidth / coverHeight;

      let sourceX = 0;
      let sourceY = 0;
      let sourceWidth = coverImg.width;
      let sourceHeight = coverImg.height;

      if (imgAspectRatio > targetAspectRatio) {
        sourceWidth = coverImg.height * targetAspectRatio;
        sourceX = (coverImg.width - sourceWidth) / 2;
      } else {
        sourceHeight = coverImg.width / targetAspectRatio;
        sourceY = (coverImg.height - sourceHeight) / 2;
      }

      ctx.drawImage(coverImg, sourceX, sourceY, sourceWidth, sourceHeight, 0, coverY, coverWidth, coverHeight);
      coverY += coverHeight;
    } catch (error) {
      console.warn("封面图加载失败，使用渐变占位:", error);
      drawFallbackCoverBand();
    }
  } else {
    drawFallbackCoverBand();
  }

  // 绘制内容区域背景
  ctx.fillStyle = bgColor;
  ctx.fillRect(0, coverY, width, height - coverY);

  // 绘制标题
  ctx.fillStyle = textColor;
  ctx.font = "bold 48px -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";
  ctx.textAlign = "left";
  ctx.textBaseline = "top";

  const padding = 40;
  const titleX = padding;
  let titleY = coverY + 40;
  const titleMaxWidth = width - padding * 2;

  const titleLineHeight = 58;
  titleY = wrapText(ctx, config.title, titleX, titleY, titleMaxWidth, titleLineHeight) + 20;

  // 绘制文章简介
  let descY = titleY;
  const lineY = height - 200;

  if (config.description) {
    descY += 50;
    ctx.fillStyle = secondaryTextColor;
    ctx.font = "26px -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";
    const lineHeight = 38;
    const descMaxWidth = titleMaxWidth;
    const descText = config.description;

    const availableHeight = lineY - descY - 50;
    const maxDescLines = Math.max(1, Math.floor(availableHeight / lineHeight));

    const finalDescY = wrapText(ctx, descText, titleX, descY, descMaxWidth, lineHeight, maxDescLines);
    descY = finalDescY + 16;
  }

  // 绘制底部装饰线
  ctx.strokeStyle = "#e5e7eb";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(padding, lineY);
  ctx.lineTo(width - padding, lineY);
  ctx.stroke();

  // 底部区域布局
  const qrCodeSize = 120;
  const bottomAvatarSize = 50;
  const bottomTextSpacing = 14;
  const bottomSectionSpacing = 40;
  const bottomSectionPadding = padding;
  const bottomSectionMaxWidth = width - bottomSectionPadding * 2;

  ctx.font = "bold 26px -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";
  const siteNameText = config.siteName || config.author;
  const siteNameWidth = ctx.measureText(siteNameText).width;
  ctx.font = "18px -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";
  const subtitleText = config.siteSubtitle?.trim() || "";
  const subtitleWidth = subtitleText ? ctx.measureText(subtitleText).width : 0;
  const leftTextMaxWidth = Math.max(
    0,
    bottomSectionMaxWidth - bottomAvatarSize - bottomTextSpacing - bottomSectionSpacing - qrCodeSize
  );
  const leftTextWidth = Math.min(Math.max(siteNameWidth, subtitleWidth), leftTextMaxWidth);

  const bottomSectionWidth = bottomAvatarSize + bottomTextSpacing + leftTextWidth + bottomSectionSpacing + qrCodeSize;

  const bottomSectionStartX = Math.max(bottomSectionPadding, (width - bottomSectionWidth) / 2);
  const qrCodeY = lineY + 20;

  const bottomAvatarX = bottomSectionStartX;
  const baseAvatarY = qrCodeY + (qrCodeSize - bottomAvatarSize) / 2;
  const bottomAvatarY = baseAvatarY + 13;

  const qrCodeX = bottomSectionStartX + bottomAvatarSize + bottomTextSpacing + leftTextWidth + bottomSectionSpacing;

  // 绘制头像
  if (config.authorAvatar) {
    try {
      const avatarImg = await loadImage(config.authorAvatar);
      drawCircleAvatar(
        ctx,
        bottomAvatarX + bottomAvatarSize / 2,
        bottomAvatarY + bottomAvatarSize / 2,
        bottomAvatarSize / 2,
        avatarImg
      );
    } catch (error) {
      console.warn("头像加载失败，使用默认样式:", error);
      ctx.fillStyle = primaryColor;
      ctx.beginPath();
      ctx.arc(
        bottomAvatarX + bottomAvatarSize / 2,
        bottomAvatarY + bottomAvatarSize / 2,
        bottomAvatarSize / 2,
        0,
        Math.PI * 2
      );
      ctx.fill();
    }
  }

  // 绘制站点名称和副标题
  const bottomTextX = bottomAvatarX + bottomAvatarSize + bottomTextSpacing;
  const originalAvatarCenterY = baseAvatarY + bottomAvatarSize / 2;
  const siteNameY = originalAvatarCenterY - 6;
  const subtitleY = originalAvatarCenterY + 28;

  ctx.fillStyle = textColor;
  ctx.font = "bold 26px -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";
  ctx.textAlign = "left";
  ctx.fillText(truncateText(ctx, siteNameText, leftTextWidth), bottomTextX, siteNameY);

  if (subtitleText) {
    ctx.fillStyle = secondaryTextColor;
    ctx.font = "18px -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";
    ctx.fillText(truncateText(ctx, subtitleText, leftTextWidth), bottomTextX, subtitleY);
  }

  // 生成二维码
  try {
    const qrCodeDataUrl = await QRCode.toDataURL(config.articleUrl, {
      width: qrCodeSize,
      margin: 2,
      color: {
        dark: "#000000",
        light: "#FFFFFF",
      },
    });

    const qrImg = await loadImage(qrCodeDataUrl);
    ctx.drawImage(qrImg, qrCodeX, qrCodeY, qrCodeSize, qrCodeSize);
  } catch (error) {
    console.error("生成二维码失败:", error);
    throw new Error("生成二维码失败");
  }

  // 二维码下方提示文字
  ctx.fillStyle = secondaryTextColor;
  ctx.font = "18px -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";
  ctx.textAlign = "center";
  const qrTextY = qrCodeY + qrCodeSize + 12;
  ctx.fillText("扫码查看文章", qrCodeX + qrCodeSize / 2, qrTextY);

  return canvas.toDataURL("image/png", 1.0);
}

/**
 * 下载海报
 */
export function downloadPoster(dataUrl: string, filename: string = "poster.png") {
  const link = document.createElement("a");
  link.download = filename;
  link.href = dataUrl;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}
