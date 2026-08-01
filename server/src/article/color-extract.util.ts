/**
 * 文章封面主色提取工具。
 *
 * 用 sharp 将图片缩到 64x64 后取所有像素 RGB 均值，作为主色（#RRGGBB）。
 * 均值法对大多数封面足够，且比调色板聚类轻量；失败返回 null，调用方静默降级。
 */
import sharp from 'sharp';

/**
 * 从图片 Buffer 提取主色，返回 #RRGGBB；失败返回 null。
 */
export async function extractPrimaryColorFromBuffer(buffer: Buffer): Promise<string | null> {
  try {
    const { data, info } = await sharp(buffer)
      .resize(64, 64, { fit: 'cover' })
      .raw()
      .toBuffer({ resolveWithObject: true });

    const channels = info.channels;
    if (channels < 3) return null;

    let r = 0;
    let g = 0;
    let b = 0;
    let count = 0;
    for (let i = 0; i + 2 < data.length; i += channels) {
      r += data[i];
      g += data[i + 1];
      b += data[i + 2];
      count++;
    }
    if (count === 0) return null;

    const toHex = (n: number) => Math.round(n / count).toString(16).padStart(2, '0');
    return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
  } catch {
    return null;
  }
}

/**
 * 按 URL 拉取图片为 Buffer。
 * 绝对地址（http/https）直接拉；相对路径（/api/uploads/...）拼上 serverOrigin 再拉。
 * 超时 5s，失败返回 null。
 */
export async function fetchImageBuffer(url: string, serverOrigin: string): Promise<Buffer | null> {
  try {
    const absoluteUrl = /^https?:\/\//i.test(url) ? url : `${serverOrigin}${url}`;
    const res = await fetch(absoluteUrl, {
      signal: AbortSignal.timeout(5000),
      headers: { 'User-Agent': 'anheyu-app/color-extract' },
    });
    if (!res.ok) return null;
    const arrayBuffer = await res.arrayBuffer();
    return Buffer.from(arrayBuffer);
  } catch {
    return null;
  }
}
