import { revalidatePath } from "next/cache";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

// REVALIDATE_TOKEN 不再提供默认值。
// 为避免生产环境误用弱口令，必须显式配置；未设置或空串时接口全部返回 503，
// 迫使运维补齐配置而不是回退到可被猜中的硬编码默认值。
const REVALIDATE_TOKEN = (process.env.REVALIDATE_TOKEN ?? "").trim();

interface RevalidateBody {
  article?: string;
  articleID?: string;
  siteConfig?: boolean;
  categories?: boolean;
  tagsList?: boolean;
  tags?: string[];
  all?: boolean;
}

export async function POST(request: NextRequest) {
  if (!REVALIDATE_TOKEN) {
    console.error("[revalidate] REVALIDATE_TOKEN 未配置，接口已禁用；请在环境变量中设置后重启服务");
    return NextResponse.json({ error: "revalidate disabled: token not configured" }, { status: 503 });
  }

  const token = request.headers.get("x-revalidate-token");
  if (token !== REVALIDATE_TOKEN) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body: RevalidateBody = await request.json();
    const revalidated: string[] = [];

    if (body.all) {
      revalidatePath("/", "layout");
      revalidated.push("all");
    } else {
      const articleSlugs = new Set<string>();
      if (body.article) articleSlugs.add(body.article);
      if (body.articleID) articleSlugs.add(body.articleID);

      if (articleSlugs.size > 0) {
        for (const slug of articleSlugs) {
          revalidatePath(`/posts/${slug}`, "page");
          revalidatePath(`/doc/${slug}`, "page");
        }
        revalidatePath("/", "page");
        revalidatePath("/tags", "page");
        revalidatePath("/categories", "page");
        revalidated.push(`article:${[...articleSlugs].join(",")}`);
      }

      if (body.siteConfig) {
        revalidatePath("/", "layout");
        revalidated.push("siteConfig");
      }

      if (body.categories) {
        revalidatePath("/categories", "layout");
        revalidatePath("/", "page");
        revalidated.push("categories");
      }

      if (body.tagsList) {
        revalidatePath("/tags", "layout");
        revalidatePath("/", "page");
        revalidated.push("tags");
      }

      if (body.tags?.length) {
        revalidatePath("/link", "page");
        revalidated.push(`tags:${body.tags.join(",")}`);
      }
    }

    return NextResponse.json({ revalidated, now: Date.now() });
  } catch (error) {
    console.error("[revalidate] 处理请求失败:", error);
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }
}
