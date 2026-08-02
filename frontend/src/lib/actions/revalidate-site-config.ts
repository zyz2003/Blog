"use server";

import { revalidatePath } from "next/cache";

/**
 * 设置保存后重新验证根布局 ISR 缓存。
 *
 * 根布局用 `export const revalidate = 60` 做 ISR，后台改了站点配置
 * （自定义 HTML/CSS/JS、站点名、logo、一图流等）后若不主动 revalidate，
 * 前台最长 60s 内仍显示旧缓存。保存成功后清掉根布局缓存，下次访问即时拉新。
 *
 * 与 revalidate-article.ts 对称：文章保存刷文章页，设置保存刷根布局。
 */
export async function revalidateSiteConfig() {
  revalidatePath("/", "layout");
}
