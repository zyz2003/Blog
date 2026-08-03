import { NextRequest } from "next/server";

/**
 * 流式代理：/api/ai/chat -> 后端 8091/api/ai/chat
 *
 * 为什么不用 next.config.ts 的 rewrites 代理？
 * Next.js rewrites 通过 Node.js http 代理转发，会缓冲整个 SSE 响应体，
 * 导致前端 useChat 一次性收到全部内容（非流式）。
 * Route Handler 用 new Response(backendRes.body) 直接传递 ReadableStream，
 * 逐 chunk 转发，保留流式行为。
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const isDev = process.env.NODE_ENV === "development";
  const backendUrl = isDev
    ? process.env.BACKEND_URL || "http://localhost:8091"
    : process.env.API_URL || "http://anheyu:8091";

  const backendRes = await fetch(`${backendUrl}/api/ai/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: await req.text(),
    signal: req.signal,
  });

  return new Response(backendRes.body, {
    status: backendRes.status,
    headers: {
      "Content-Type":
        backendRes.headers.get("content-type") || "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
