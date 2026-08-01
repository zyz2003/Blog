"use server";

import { revalidatePath } from "next/cache";

/**
 * 文章保存后重新验证 ISR 缓存。
 *
 * 文章详情页用 `fetch(..., { next: { revalidate: 60 } })` 做 ISR，
 * 后台改了文章（含 primary_color）后若不主动 revalidate，前台最长 60s 内仍显示旧缓存。
 * 保存成功后传入文章的 abbrlink / publicId，清掉对应路径缓存，下次访问即时拉新。
 */
export async function revalidateArticle(slugs: (string | undefined)[]) {
  for (const slug of slugs) {
    if (slug) {
      revalidatePath(`/posts/${slug}`, "page");
    }
  }
  // 列表/首页也展示文章封面与主色，一并刷新
  revalidatePath("/", "page");
}
